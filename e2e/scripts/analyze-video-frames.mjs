import { readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const MAX_BLACK_PERCENT = 90;
const BLACK_PIXEL_THRESHOLD = 32;

function findRecordings(input) {
  if (statSync(input).isFile()) {
    return input.toLowerCase().endsWith(".mp4") ? [input] : [];
  }

  return readdirSync(input, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(input, entry.name);
    if (entry.isDirectory()) return findRecordings(entryPath);
    return entry.isFile() && entry.name.toLowerCase().endsWith(".mp4")
      ? [entryPath]
      : [];
  });
}

function analyzeRecording(recording) {
  // Analyze the feed area, excluding black app chrome around the video.
  const filter = [
    "crop=trunc(iw*0.9/2)*2:trunc(ih*0.48/2)*2:trunc(iw*0.05/2)*2:trunc(ih*0.08/2)*2",
    `blackframe=amount=0:threshold=${BLACK_PIXEL_THRESHOLD}`,
  ].join(",");
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      recording,
      "-vf",
      filter,
      "-an",
      "-f",
      "null",
      "-",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`FFmpeg exited with ${result.status}\n${result.stderr}`);
  }

  const frames = [...result.stderr.matchAll(/pblack:([\d.]+).*?t:([\d.]+)/g)].map(
    ([, blackPercent, timeSeconds]) => ({
      blackPercent: Number(blackPercent),
      timeSeconds: Number(timeSeconds),
    }),
  );
  if (frames.length === 0) throw new Error("FFmpeg did not decode any frames");

  // Screen recorders can emit black encoder-priming frames at the boundaries.
  const firstVisible = frames.findIndex(
    (frame) => frame.blackPercent < MAX_BLACK_PERCENT,
  );
  const lastVisible = frames.findLastIndex(
    (frame) => frame.blackPercent < MAX_BLACK_PERCENT,
  );
  if (firstVisible === -1) throw new Error("Every decoded frame is black");

  const intermediateFrames = frames.slice(firstVisible, lastVisible + 1);
  const blackFrames = intermediateFrames.filter(
    (frame) => frame.blackPercent >= MAX_BLACK_PERCENT,
  );
  const darkestFrame = intermediateFrames.reduce((darkest, frame) =>
    frame.blackPercent > darkest.blackPercent ? frame : darkest,
  );

  if (blackFrames.length > 0) {
    const first = blackFrames[0];
    throw new Error(
      `${blackFrames.length} black frame(s); first at ${first.timeSeconds.toFixed(3)}s`,
    );
  }

  return { frameCount: frames.length, darkestFrame };
}

try {
  const input = path.resolve(process.argv[2] ?? "e2e/videos");
  const recordings = findRecordings(input).sort();
  if (recordings.length === 0) throw new Error(`No MP4 recordings found in ${input}`);

  let failed = false;
  for (const recording of recordings) {
    try {
      const { frameCount, darkestFrame } = analyzeRecording(recording);
      console.log(
        `PASS ${path.relative(process.cwd(), recording)}: ${frameCount} frames, ` +
          `maximum black area ${darkestFrame.blackPercent}%`,
      );
    } catch (error) {
      failed = true;
      console.error(`FAIL ${path.relative(process.cwd(), recording)}: ${error.message}`);
    }
  }

  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
