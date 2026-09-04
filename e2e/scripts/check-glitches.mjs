import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const MAX_BLACK_PERCENT = 90;
const BLACK_PIXEL_THRESHOLD = 32;
const MAX_DOMINANT_COLOR_PERCENT = 90;
const DOMINANT_COLOR_DISTANCE = 24;
const SAMPLE_SIZE = 64;
const BYTES_PER_PIXEL = 3;
const FRAME_SIZE = SAMPLE_SIZE * SAMPLE_SIZE * BYTES_PER_PIXEL;

function findRecordings(input) {
  if (!existsSync(input)) return [];

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

function medianChannel(frame, channel) {
  const histogram = new Uint32Array(256);
  for (let i = channel; i < frame.length; i += BYTES_PER_PIXEL) {
    histogram[frame[i]]++;
  }

  const midpoint = Math.ceil((SAMPLE_SIZE * SAMPLE_SIZE) / 2);
  let count = 0;
  for (let value = 0; value < histogram.length; value++) {
    count += histogram[value];
    if (count >= midpoint) return value;
  }

  throw new Error("Unable to calculate the median frame color");
}

function dominantColorPercent(frame) {
  // The median is stable even when a small amount of UI or compression noise
  // remains in an otherwise solid frame. No particular color is assumed.
  const median = [
    medianChannel(frame, 0),
    medianChannel(frame, 1),
    medianChannel(frame, 2),
  ];
  let dominantPixels = 0;

  for (let i = 0; i < frame.length; i += BYTES_PER_PIXEL) {
    if (
      Math.abs(frame[i] - median[0]) <= DOMINANT_COLOR_DISTANCE &&
      Math.abs(frame[i + 1] - median[1]) <= DOMINANT_COLOR_DISTANCE &&
      Math.abs(frame[i + 2] - median[2]) <= DOMINANT_COLOR_DISTANCE
    ) {
      dominantPixels++;
    }
  }

  return (dominantPixels * 100) / (SAMPLE_SIZE * SAMPLE_SIZE);
}

function analyzeRecording(recording) {
  // Analyze the feed area, excluding app chrome around the video. Keep the
  // original-resolution black measurement for encoder-boundary detection and
  // decode a small RGB copy for color-independent uniformity detection.
  const filter = [
    "crop=trunc(iw*0.9/2)*2:trunc(ih*0.48/2)*2:trunc(iw*0.05/2)*2:trunc(ih*0.08/2)*2",
    `blackframe=amount=0:threshold=${BLACK_PIXEL_THRESHOLD}`,
    `scale=${SAMPLE_SIZE}:${SAMPLE_SIZE}:flags=neighbor`,
    "format=rgb24",
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
      "-fps_mode",
      "passthrough",
      "-pix_fmt",
      "rgb24",
      "-f",
      "rawvideo",
      "-",
    ],
    { maxBuffer: 256 * 1024 * 1024 },
  );

  if (result.error) throw result.error;
  const stderr = result.stderr.toString("utf8");
  if (result.status !== 0) {
    throw new Error(`FFmpeg exited with ${result.status}\n${stderr}`);
  }

  const frameMetadata = [
    ...stderr.matchAll(/pblack:([\d.]+).*?t:([\d.]+)/g),
  ].map(([, blackPercent, timeSeconds]) => ({
    blackPercent: Number(blackPercent),
    timeSeconds: Number(timeSeconds),
  }));
  if (frameMetadata.length === 0)
    throw new Error("FFmpeg did not decode any frames");
  if (result.stdout.length % FRAME_SIZE !== 0) {
    throw new Error("FFmpeg returned an incomplete RGB frame");
  }

  const decodedFrameCount = result.stdout.length / FRAME_SIZE;
  if (decodedFrameCount !== frameMetadata.length) {
    throw new Error(
      `FFmpeg returned ${decodedFrameCount} RGB frames but ${frameMetadata.length} metadata records`,
    );
  }

  const frames = frameMetadata.map((metadata, index) => ({
    ...metadata,
    dominantColorPercent: dominantColorPercent(
      result.stdout.subarray(index * FRAME_SIZE, (index + 1) * FRAME_SIZE),
    ),
  }));

  // Screen recorders can emit black encoder-priming frames at the boundaries.
  const firstVisible = frames.findIndex(
    (frame) => frame.blackPercent < MAX_BLACK_PERCENT,
  );
  const lastVisible = frames.findLastIndex(
    (frame) => frame.blackPercent < MAX_BLACK_PERCENT,
  );
  if (firstVisible === -1) throw new Error("Every decoded frame is black");

  const intermediateFrames = frames.slice(firstVisible, lastVisible + 1);
  const blankFrames = intermediateFrames.filter(
    (frame) =>
      frame.blackPercent >= MAX_BLACK_PERCENT ||
      frame.dominantColorPercent >= MAX_DOMINANT_COLOR_PERCENT,
  );
  const mostUniformFrame = intermediateFrames.reduce((mostUniform, frame) =>
    frame.dominantColorPercent > mostUniform.dominantColorPercent
      ? frame
      : mostUniform,
  );

  if (blankFrames.length > 0) {
    const first = blankFrames[0];
    throw new Error(
      `${blankFrames.length} blank frame(s); first at ${first.timeSeconds.toFixed(3)}s ` +
        `(${first.dominantColorPercent.toFixed(1)}% dominant color, ` +
        `${first.blackPercent.toFixed(1)}% black)`,
    );
  }

  return { frameCount: frames.length, mostUniformFrame };
}

function main() {
  const args = process.argv.slice(2);
  const allowEmpty = args.includes("--allow-empty");
  const inputs = args.filter((argument) => argument !== "--allow-empty");
  if (inputs.length > 1) {
    throw new Error("Usage: check-glitches.mjs [path] [--allow-empty]");
  }

  const input = path.resolve(inputs[0] ?? "e2e/videos");
  const recordings = findRecordings(input).sort();
  if (recordings.length === 0 && allowEmpty) {
    console.log(`SKIP: No MP4 recordings found in ${input}`);
    return;
  }
  if (recordings.length === 0) {
    throw new Error(`No MP4 recordings found in ${input}`);
  }

  let failed = false;
  for (const recording of recordings) {
    try {
      const { frameCount, mostUniformFrame } = analyzeRecording(recording);
      console.log(
        `PASS ${path.relative(process.cwd(), recording)}: ${frameCount} frames, ` +
          `maximum dominant-color area ${mostUniformFrame.dominantColorPercent.toFixed(1)}%`,
      );
    } catch (error) {
      failed = true;
      console.error(
        `FAIL ${path.relative(process.cwd(), recording)}: ${error.message}`,
      );
    }
  }

  if (failed) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
