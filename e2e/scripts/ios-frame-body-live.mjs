import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(import.meta.url);
const worker = source.replace(/\.mjs$/, ".py");
const hash = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
export const inputBufferBytes = 8 * 1024 * 1024;

// Only the explicit archive profile imports/starts this observer. Its feed never
// waits for disk I/O or applies backpressure to the existing log stream/test.
export function startLiveFrameBodies({
  enabled,
  device,
  directory,
  artifact = "e2e/reports/maestro-ios-input",
  devicesRoot,
  onCopy,
  spawnProcess = spawn,
}) {
  if (!enabled) return;
  const file = path.join(directory, "live-frame-body-process.json");
  const command = [
    "python3",
    "-B",
    worker,
    "--device",
    device,
    "--artifact",
    artifact,
    "--output",
    path.join(directory, "live-frame-bodies"),
  ];
  if (devicesRoot) command.push("--devices-root", devicesRoot);
  const receipt = {
    version: 1,
    device,
    parentPID: process.pid,
    parentCommand: process.argv,
    wrapperSourceSHA256: hash(path.resolve(process.argv[1])),
    nodeVersion: process.version,
    command,
    workerSourceSHA256: hash(worker),
    adapterSourceSHA256: hash(source),
    inputBufferBytes,
    clock: "host_node_hrtime_bigint_ns",
    startedMonotonicNs: process.hrtime.bigint().toString(),
    startedWallTimeMs: Date.now(),
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
  };
  writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
  const save = () =>
    writeFileSync(file, JSON.stringify(receipt, null, 2) + "\n");
  const fail = (message) => {
    if (!receipt.errors.includes(message)) receipt.errors.push(message);
    save();
  };
  const child = spawnProcess(command[0], command.slice(1), {
    stdio: ["pipe", "pipe", "pipe"],
  });
  receipt.pid = child.pid;
  save();
  let exited = false;
  let stopped = false;
  let stderrBytes = 0;
  let progressBuffer = "";
  receipt.copiedPNGsObserved = 0;
  child.stdout.on("data", (chunk) => {
    progressBuffer += chunk.toString();
    if (progressBuffer.length > 65536) {
      fail("Exporter progress buffer bound exceeded");
      progressBuffer = "";
      return;
    }
    const lines = progressBuffer.split("\n");
    progressBuffer = lines.pop();
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (row.workerPID !== child.pid)
          throw new Error("progress PID differs");
        if (row.phase === "finished") {
          if (
            row.PNGs !== receipt.copiedPNGsObserved ||
            !Array.isArray(row.errors) ||
            row.errors.length ||
            row.deviceAPICalls !== 0
          )
            throw new Error("worker completion proof differs");
          receipt.workerFinished = true;
          continue;
        }
        if (
          row.phase !== "copied" ||
          row.PNGs !== receipt.copiedPNGsObserved + 2 ||
          row.PNGs > 2048
        )
          throw new Error("progress phase/count differs");
        receipt.copiedPNGsObserved = row.PNGs;
        onCopy?.(row);
      } catch (error) {
        fail(`Exporter progress error: ${error.message}`);
      }
    }
  });
  receipt.stderr = "";
  child.stderr.on("data", (chunk) => {
    stderrBytes += chunk.length;
    if (stderrBytes <= 65536) receipt.stderr += chunk.toString();
    else fail("Exporter stderr bound exceeded");
  });
  child.on("error", (error) =>
    fail(`Exporter process error: ${error.message}`),
  );
  child.stdin.on("error", (error) =>
    fail(`Exporter stdin error: ${error.message}`),
  );
  child.on("exit", () => {
    exited = true;
  });
  const done = new Promise((resolve) => {
    child.on("close", (code, signal) => {
      if (progressBuffer) fail("Exporter progress ended with a partial record");
      if (code === 0 && !receipt.workerFinished)
        fail("Exporter worker completion proof missing");
      receipt.exit = code;
      receipt.signal = signal;
      receipt.finishedMonotonicNs = process.hrtime.bigint().toString();
      receipt.finishedWallTimeMs = Date.now();
      if (code !== 0 || signal) fail("Exporter did not finish normally");
      save();
      resolve(receipt);
    });
  });
  const signalOwned = (signal) => {
    if (exited || !child.pid) return;
    execFile(
      "ps",
      ["-p", String(child.pid), "-o", "pid=,ppid=,uid=,command="],
      { timeout: 2000 },
      (error, stdout) => {
        if (exited) return;
        const match = stdout?.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
        if (
          error ||
          !match ||
          Number(match[1]) !== child.pid ||
          Number(match[2]) !== process.pid ||
          Number(match[3]) !== process.getuid() ||
          !match[4].endsWith(` ${command.slice(1).join(" ")}`)
        ) {
          fail("Exporter teardown ownership could not be revalidated");
          return;
        }
        receipt.teardownIdentity = stdout.trim();
        receipt.teardownSignal = signal;
        save();
        child.kill(signal);
      },
    );
  };
  return {
    feed(chunk) {
      if (stopped || exited || child.stdin.destroyed) {
        fail("Exporter ended before original log stream");
        return;
      }
      if (receipt.errors.length) return;
      if (child.stdin.writableLength + chunk.length > inputBufferBytes) {
        fail("Exporter input buffer bound exceeded");
        child.stdin.end();
        return;
      }
      child.stdin.write(chunk);
    },
    async stop() {
      if (!stopped) {
        stopped = true;
        receipt.inputEnded = true;
        if (!child.stdin.destroyed) child.stdin.end();
        save();
      }
      // This bound is for observer teardown after the original test/log stream,
      // never a UI settling wait or a changed test deadline.
      const timer = setTimeout(() => {
        fail("Exporter teardown exceeded 30 seconds");
        signalOwned("SIGTERM");
      }, 30000);
      const forceTimer = setTimeout(() => signalOwned("SIGKILL"), 35000);
      try {
        return await done;
      } finally {
        clearTimeout(timer);
        clearTimeout(forceTimer);
      }
    },
  };
}
