import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

export const INDIGO_PORT = 47655;

export function gestureFrames(gesture) {
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const point = (value) =>
    value && finite(value.x) && finite(value.y) && value.x >= 0 && value.y >= 0;
  if (
    !finite(gesture.duration) ||
    gesture.duration < 0 ||
    gesture.duration > 59
  )
    throw new Error("Invalid original gesture duration");
  if (gesture.kind === "touch" && point(gesture.point)) {
    return [
      { ...gesture.point, offset: 0, phase: "down" },
      { ...gesture.point, offset: gesture.duration, phase: "up" },
    ];
  }
  if (gesture.kind !== "swipe" || !point(gesture.start) || !point(gesture.end))
    throw new Error("Unsupported single-contact gesture");
  // EventRecord moves to the endpoint at +0.1s, then lifts at +0.1+duration.
  // Preserve those control points, interpolating that move at 60 Hz.
  const frames = Array.from({ length: 7 }, (_, index) => ({
    x:
      index === 6
        ? gesture.end.x
        : gesture.start.x + ((gesture.end.x - gesture.start.x) * index) / 6,
    y:
      index === 6
        ? gesture.end.y
        : gesture.start.y + ((gesture.end.y - gesture.start.y) * index) / 6,
    offset: index === 6 ? 0.1 : (0.1 * index) / 6,
    phase: "down",
  }));
  frames.push({ ...gesture.end, offset: 0.1 + gesture.duration, phase: "up" });
  return frames;
}

export async function startIndigoBridge({
  manifestPath,
  device,
  directory,
  own,
  port = INDIGO_PORT,
}) {
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(device))
    throw new Error("Indigo requires an explicit Simulator UDID");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const digest = (file) =>
    createHash("sha256").update(readFileSync(file)).digest("hex");
  for (const name of ["helper", "core", "kit"])
    if (digest(manifest[name].file) !== manifest[name].sha256)
      throw new Error(`Indigo ${name} provenance mismatch`);
  const log = createWriteStream(path.join(directory, "indigo-transport.jsonl"));
  const stderr = createWriteStream(path.join(directory, "indigo-host.stderr"));
  const record = (type, fields) =>
    log.write(
      `${JSON.stringify({ at: new Date().toISOString(), type, ...fields })}\n`,
    );
  const child = spawn(
    manifest.helper.file,
    [device, manifest.developer, manifest.core.file, manifest.kit.file],
    { detached: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  own(child);
  const closed = new Promise((resolve) => child.once("close", resolve));
  child.stderr.pipe(stderr);
  const pending = new Map();
  let sequence = 0;
  let fatal;
  let resolveReady;
  let rejectReady;
  let stopPromise;
  let busy = false;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  function fail(error) {
    fatal ??= error;
    rejectReady(error);
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  }
  const lines = readline.createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const message = JSON.parse(line);
      record("native", { message });
      if (message.type === "ready") {
        if (
          message.deviceUDID.toLowerCase() !== device.toLowerCase() ||
          message.clientInstances !== 1
        )
          throw new Error("HID client selected an unexpected device/session");
        resolveReady(message);
      } else if (message.type === "delivered") {
        const waiter = pending.get(message.id);
        if (!waiter) throw new Error("Unmatched native delivery response");
        if (message.acknowledged !== waiter.frames)
          throw new Error("Native delivery did not acknowledge every frame");
        pending.delete(message.id);
        waiter.resolve(message);
      } else
        throw new Error(message.error || "Unexpected native protocol message");
    } catch (error) {
      fail(error);
    }
  });
  child.on("error", fail);
  child.on("exit", (code, signal) => {
    record("native-exit", { code, signal });
    fail(new Error(`Indigo host exited code=${code} signal=${signal}`));
  });
  child.stdin.on("error", fail);
  const startup = setTimeout(
    () => fail(new Error("Indigo host startup timed out")),
    60000,
  );
  const server = http.createServer(async (request, response) => {
    let ownsRequest = false;
    try {
      if (request.method !== "POST" || request.url !== "/gesture") {
        response.writeHead(404).end();
        return;
      }
      if (fatal) throw fatal;
      if (busy) throw new Error("Concurrent gestures are unsupported");
      busy = true;
      ownsRequest = true;
      let body = "";
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 65536) throw new Error("Oversized gesture request");
      }
      const gesture = JSON.parse(body);
      if (
        typeof gesture.deviceUDID !== "string" ||
        gesture.deviceUDID.toLowerCase() !== device.toLowerCase()
      )
        throw new Error("Gesture belongs to another Simulator");
      const frames = gestureFrames(gesture);
      const id = ++sequence;
      record("request", { id, gesture, frames });
      const delivery = new Promise((resolve, reject) =>
        pending.set(id, { resolve, reject, frames: frames.length }),
      );
      child.stdin.write(
        `${JSON.stringify({ id, deviceUDID: device, frames })}\n`,
      );
      const result = await delivery;
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(result));
    } catch (error) {
      record("request-error", { error: error.message });
      response
        .writeHead(500, { "Content-Type": "application/json" })
        .end(JSON.stringify({ error: error.message }));
    } finally {
      if (ownsRequest) busy = false;
    }
  });
  async function stop() {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      fail(new Error("Indigo bridge stopped"));
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
      await closed;
      lines.close();
      log.end();
      stderr.end();
    })();
    return stopPromise;
  }
  try {
    const identity = await ready;
    clearTimeout(startup);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    record("bridge-ready", {
      identity,
      port: server.address().port,
      helperPid: child.pid,
      sourceSHA: digest(fileURLToPath(import.meta.url)),
    });
    return { stop, port: server.address().port };
  } catch (error) {
    clearTimeout(startup);
    await stop();
    throw error;
  }
}
