import { spawn } from "node:child_process";
import {
  copyFileSync,
  createWriteStream,
  mkdirSync,
  readdirSync,
  statSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  ownedSimctlAge,
  sameOwnerProcess,
  selectedHostedLaunchd,
  uniqueHostedCoreSimulatorService,
  uniqueHostedSimLaunchHost,
} from "./native-diagnostics-processes.mjs";

// Keep collecting outside Maestro: a dead XCTest/UiAutomation session cannot
// reliably take its own final screenshot, hierarchy, or device logs.
const [platform, device, separator, command, ...args] = process.argv.slice(2);
if (
  !["ios", "android"].includes(platform) ||
  !device ||
  separator !== "--" ||
  !command
) {
  console.error(
    "Usage: node e2e/scripts/native-diagnostics.mjs <ios|android> <device-id> -- <command> [args...]",
  );
  process.exit(2);
}

const directory = path.resolve("e2e/reports/native-diagnostics");
const startedAt = Date.now();
mkdirSync(directory, { recursive: true });
const timeline = createWriteStream(path.join(directory, "timeline.log"));
const collectors = new Set();
const ownerPid = process.ppid;
let testPid;
let indigoBridge;
let processSamples = 0;
let interrupted = false;
const sampledSimctl = new Set();
const hostedCI =
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.RUNNER_ENVIRONMENT === "github-hosted";
const adb = (...parameters) => ["adb", ["-s", device, ...parameters]];
const simctl = (...parameters) => ["xcrun", ["simctl", ...parameters]];
const timestamp = () => new Date().toISOString();

function log(message) {
  const line = `${timestamp()} ${message}\n`;
  timeline.write(line);
  process.stdout.write(line);
}

function signalGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH")
      log(
        `Unable to signal owned group ${child.pid} (${child.spawnfile}): ${error.code}`,
      );
  }
}

// Diagnostics must not turn an unresponsive device into an unbounded CI hang.
function capture(file, [executable, parameters], timeout = 15000, observe) {
  if (interrupted) return Promise.resolve();
  return new Promise((resolve) => {
    const stream = createWriteStream(path.join(directory, file), {
      flags: "a",
    });
    stream.write(`\n${timestamp()} ${executable} ${parameters.join(" ")}\n`);
    const child = spawn(executable, parameters, {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    collectors.add(child);
    child.stdout.pipe(stream, { end: false });
    child.stderr.pipe(stream, { end: false });
    if (observe) child.stdout.on("data", observe);
    const timer = setTimeout(() => {
      stream.write(
        `\n${timestamp()} diagnostic timed out after ${timeout}ms\n`,
      );
      signalGroup(child, "SIGKILL");
    }, timeout);
    // simctl can leave a spawned log process holding its stdout after the
    // client exits. Allow buffered output to drain, then close those pipes so
    // a diagnostic collector cannot keep this wrapper alive indefinitely.
    let drainTimer;
    child.on("exit", () => {
      signalGroup(child, "SIGKILL");
      drainTimer = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
      }, 1000);
    });
    child.on("error", (error) => stream.write(`${error.message}\n`));
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      clearTimeout(drainTimer);
      collectors.delete(child);
      stream.end(`\n${timestamp()} exit=${code} signal=${signal}\n`);
      resolve();
    });
  });
}

function streamLogs(file, invocation, observe) {
  // A job timeout is the upper bound; cleanup stops these long-lived collectors.
  return capture(file, invocation, 90 * 60 * 1000, observe);
}

let terminationTimer;
let terminationNumber = 0;
let simulatorLogBuffer = "";
const xctestProcesses = new Map();
function observeIOSLog(chunk) {
  simulatorLogBuffer += chunk.toString();
  const lines = simulatorLogBuffer.split("\n");
  simulatorLogBuffer = lines.pop().slice(-65536);
  for (const line of lines) {
    const processMatch = line.match(
      /\b(testmanagerd|runningboardd|maestro-driver-iosUITests-Runner)\[(\d+)[:\]]/,
    );
    if (processMatch) xctestProcesses.set(processMatch[1], processMatch[2]);
    if (line.includes("[End] Terminating app")) clearTimeout(terminationTimer);
    if (!line.includes("[Start] Terminating app")) continue;
    clearTimeout(terminationTimer);
    terminationTimer = setTimeout(() => {
      const prefix = `termination-stall-${++terminationNumber}`;
      log(
        "App termination exceeded 8s; capturing XCTest and process-state stacks",
      );
      void capture(`${prefix}-processes.log`, [
        "ps",
        ["-A", "-o", "pid,ppid,state,pcpu,pmem,rss,args"],
      ]);
      // The stream is scoped to the selected simulator. Never sample another
      // simulator's runner or daemon by searching global process names.
      for (const [name, pid] of xctestProcesses) {
        void capture(`${prefix}-${name}.log`, [
          "sample",
          [
            pid,
            "3",
            "10",
            "-file",
            path.join(directory, `${prefix}-${name}-stack.txt`),
          ],
        ]);
      }
      const processManager = xctestProcesses.get("runningboardd");
      if (process.env.GITHUB_ACTIONS === "true" && processManager) {
        const kernelReport = path.join(
          directory,
          `${prefix}-runningboardd-kernel.txt`,
        );
        // CI samples found process-death delivery stopped in __bsdthread_ctl.
        // Include kernel frames for this PID only, rather than the whole host.
        void capture(`${prefix}-runningboardd-kernel.log`, [
          "sudo",
          [
            "-n",
            "spindump",
            processManager,
            "3",
            "10",
            "-onlyTarget",
            "-file",
            kernelReport,
          ],
        ]).then(() =>
          capture(`${prefix}-runningboardd-kernel.log`, [
            "sudo",
            ["-n", "chmod", "a+r", kernelReport],
          ]),
        );
      }
    }, 8000);
  }
}

async function sample() {
  let processTable = "";
  await capture(
    "host-processes.log",
    ["ps", ["-A", "-o", "pid,ppid,state,pcpu,pmem,rss,comm"]],
    15000,
    (chunk) => {
      processTable += chunk.toString();
    },
  );
  if (platform === "ios") {
    if (hostedCI) {
      await capture("host-foreground.log", ["lsappinfo", ["-names", "front"]]);
    }
    await capture("host-memory.log", ["vm_stat", []]);
    await capture("host-memory.log", [
      "sysctl",
      ["kern.memorystatus_vm_pressure_level", "vm.swapusage"],
    ]);
    // A real privacy stall waits inside CoreSimulator's lookup/host-support
    // XPC route. Avoid adding periodic device RPCs just to observe processes.
    await sampleStalledSimctl(processTable);
  } else {
    await capture("host-memory.log", ["free", ["-m"]]);
    // Includes zombie shells and their parents, which preceded adbd's death in
    // run 39647963672. ARGS identifies which helper started each shell.
    await capture(
      "device-processes.log",
      adb("shell", "ps -A -o PID,PPID,S,NAME,ARGS"),
    );
    await capture("device-memory.log", adb("shell", "cat /proc/meminfo"));
    await capture("device-uptime.log", adb("shell", "cat /proc/uptime"));
  }
  // Captures a stuck permission setup/APK transfer before a later ADB failure
  // hides the original wait. Maestro's Unix launcher execs the JVM in place.
  if (testPid && ++processSamples % 4 === 0) {
    await capture("host-jvm-threads.log", [
      "jcmd",
      [String(testPid), "Thread.print"],
    ]);
  }
}

async function sampleStalledSimctl(processTable) {
  if (!testPid) return;
  for (const line of processTable.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/,
    );
    if (
      !match ||
      Number(match[2]) !== testPid ||
      path.basename(match[3]) !== "simctl"
    )
      continue;
    const pid = Number(match[1]);
    if (sampledSimctl.has(pid)) continue;
    let details = "";
    await capture(
      `simctl-${pid}-arguments.log`,
      ["ps", ["-p", String(pid), "-o", "pid,ppid,etime,args="]],
      15000,
      (chunk) => {
        details += chunk.toString();
      },
    );
    const elapsedSeconds = ownedSimctlAge(details, pid, testPid);
    if (elapsedSeconds === undefined || elapsedSeconds < 15) continue;
    sampledSimctl.add(pid);
    log(
      `Owned simctl ${pid} elapsed=${elapsedSeconds}s; capturing native stack and open descriptors`,
    );
    await Promise.all([
      capture(`simctl-${pid}-sample.log`, [
        "sample",
        [
          String(pid),
          "3",
          "10",
          "-file",
          path.join(directory, `simctl-${pid}-stack.txt`),
        ],
      ]),
      capture(`simctl-${pid}-descriptors.log`, [
        "lsof",
        ["-nP", "-p", String(pid)],
      ]),
      sampleHostedWaitChain(processTable, pid),
    ]);
  }
}

async function sampleHostedWaitChain(processTable, clientPid) {
  const targets = [
    ["service", uniqueHostedCoreSimulatorService(processTable, hostedCI)],
    ["launch-host", uniqueHostedSimLaunchHost(processTable, hostedCI)],
    ["launchd", selectedHostedLaunchd(processTable, xctestProcesses, hostedCI)],
  ];
  await Promise.all(
    targets.map(([kind, target]) =>
      target ? sampleHostedProcess(kind, target, clientPid) : undefined,
    ),
  );
}

async function sampleHostedProcess(kind, service, clientPid) {
  let details = "";
  const prefix = `simctl-${clientPid}-${kind}-${service.pid}`;
  await capture(
    `${prefix}-identity.log`,
    ["ps", ["-p", String(service.pid), "-o", "pid,uid,comm="]],
    15000,
    (chunk) => {
      details += chunk.toString();
    },
  );
  if (!sameOwnerProcess(details, service, process.getuid?.())) {
    log(`Hosted ${kind} ${service.pid} identity/owner changed; skipping`);
    return;
  }
  if (service.childPid) {
    let childDetails = "";
    await capture(
      `${prefix}-child-identity.log`,
      ["ps", ["-p", String(service.childPid), "-o", "pid,ppid,comm="]],
      15000,
      (chunk) => {
        childDetails += chunk.toString();
      },
    );
    const childLive = childDetails.split("\n").some((line) => {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
      return (
        match &&
        Number(match[1]) === service.childPid &&
        Number(match[2]) === service.pid &&
        match[3] === service.childCommand
      );
    });
    if (!childLive) {
      log(`Selected simulator's child ${service.childPid} changed; skipping`);
      return;
    }
  }
  log(
    `Capturing hosted ${kind === "service" ? "CoreSimulatorService" : kind} ${service.pid} while owned simctl ${clientPid} is stalled`,
  );
  await Promise.all([
    capture(`${prefix}-sample.log`, [
      "sample",
      [
        String(service.pid),
        "3",
        "10",
        "-file",
        path.join(directory, `${prefix}-stack.txt`),
      ],
    ]),
    capture(`${prefix}-descriptors.log`, [
      "lsof",
      ["-nP", "-p", String(service.pid)],
    ]),
    capture(`${prefix}-host.log`, [
      "log",
      [
        "show",
        "--last",
        "3m",
        "--info",
        "--style",
        "compact",
        "--predicate",
        `processIdentifier == ${service.pid}`,
      ],
    ]),
  ]);
}

async function finalState() {
  await sample();
  if (platform === "ios") {
    await capture("devices.log", simctl("list", "devices", "--json"));
    await capture(
      "screenshot.log",
      simctl("io", device, "screenshot", path.join(directory, "final.png")),
    );
    const reports =
      process.env.TELEPORT_DIAGNOSTIC_REPORTS_DIR ||
      path.join(homedir(), "Library/Logs/DiagnosticReports");
    try {
      for (const name of readdirSync(reports)) {
        const source = path.join(reports, name);
        const info = statSync(source);
        if (
          info.isFile() &&
          info.mtimeMs >= startedAt &&
          /TeleportExample|maestro|testmanagerd|runningboardd|Simulator|SpringBoard|JetsamEvent/i.test(
            name,
          )
        ) {
          const destination = path.join(directory, "DiagnosticReports");
          mkdirSync(destination, { recursive: true });
          copyFileSync(source, path.join(destination, name));
        }
      }
    } catch (error) {
      log(`Could not collect crash reports: ${error.message}`);
    }
  } else {
    // An adbd restart also disconnects our live logcat reader. Read the
    // retained buffer through the new daemon to recover its final messages.
    await capture(
      "logcat-final-lifecycle.log",
      adb(
        "logcat",
        "-b",
        "all",
        "-d",
        "-v",
        "threadtime",
        "-s",
        "livelock:I",
        "UiAutomationManager:I",
        "UiAutomation:W",
        "*:S",
      ),
    );
    await capture("adb-state.log", ["adb", ["devices", "-l"]]);
    for (const service of ["activity", "window", "meminfo", "SurfaceFlinger"]) {
      await capture(`dumpsys-${service}.log`, adb("shell", "dumpsys", service));
    }
    await capture("kernel.log", adb("shell", "dmesg"));
    if (
      process.env.GITHUB_ACTIONS === "true" &&
      device.startsWith("emulator-")
    ) {
      // Userdebug emulators can expose the kernel ring via su without
      // restarting adbd. Run after the test so its lifecycle remains intact.
      await capture("kernel.log", adb("shell", "su 0 dmesg"));
    }
    const screenshot = "/data/local/tmp/teleport-e2e-final.png";
    await capture(
      "screenshot.log",
      adb("shell", "screencap", "-p", screenshot),
    );
    await capture(
      "screenshot.log",
      adb("pull", screenshot, path.join(directory, "final.png")),
    );
    await capture("screenshot.log", adb("shell", "rm", "-f", screenshot));
  }
}

log(`Starting ${platform} diagnostics for ${device}; output=${directory}`);
if (platform === "ios") log("iOS native wait-chain diagnostics=1");
log(
  `Runner: os=${process.env.RUNNER_OS} arch=${process.env.RUNNER_ARCH} image=${process.env.ImageOS}/${process.env.ImageVersion}; Node=${process.version}`,
);
await capture("versions.log", [command, ["--version"]]);
await capture("versions.log", ["uname", ["-a"]]);
await capture("disk.log", ["df", ["-h"]]);
if (platform === "ios") {
  await capture("versions.log", ["xcodebuild", ["-version"]]);
  await capture("versions.log", ["sw_vers", []]);
  await capture("versions.log", [
    "sysctl",
    ["hw.memsize", "hw.logicalcpu", "hw.model", "kern.osversion"],
  ]);
  await capture("devices.log", simctl("list", "--json"));
  void streamLogs(
    "simulator.log",
    simctl(
      "spawn",
      device,
      "log",
      "stream",
      "--style",
      "compact",
      "--level",
      "debug",
      "--predicate",
      'process == "TeleportExample" OR process CONTAINS "maestro" OR process == "testmanagerd" OR process == "runningboardd" OR process == "backboardd" OR process == "SpringBoard"',
    ),
    observeIOSLog,
  );
} else {
  await capture("versions.log", adb("shell", "getprop"));
  await capture("versions.log", adb("shell", "date", "-u"));
  void streamLogs(
    "logcat.log",
    adb("logcat", "-b", "all", "-v", "threadtime", "-T", "1"),
  );
}

await sample();
let sampling;
const interval = setInterval(() => {
  // Do not pile up adb/simctl requests if a previous sample is still blocked.
  if (!sampling) {
    sampling = sample().finally(() => {
      sampling = undefined;
    });
  }
}, 15000);

if (platform === "ios" && process.env.MAESTRO_IOS_INPUT_BACKEND === "indigo") {
  const startupOwner = setInterval(() => {
    if (process.ppid !== ownerPid) {
      log(`Owner ${ownerPid} exited during HID startup; stopping owned groups`);
      interrupted = true;
      for (const child of collectors) signalGroup(child, "SIGKILL");
    }
  }, 1000);
  try {
    if (process.ppid !== ownerPid)
      throw new Error("Owner exited before HID startup");
    const { startIndigoBridge } = await import("./ios-hid-bridge.mjs");
    indigoBridge = await startIndigoBridge({
      manifestPath: process.env.MAESTRO_IOS_HID_MANIFEST,
      device,
      directory,
      own(child) {
        collectors.add(child);
        child.once("close", () => collectors.delete(child));
      },
    });
    if (interrupted || process.ppid !== ownerPid) {
      await indigoBridge.stop();
      throw new Error("Owner exited during HID startup");
    }
    log("Persistent Indigo bridge ready for the selected Simulator");
  } catch (error) {
    log(`HID startup failed: ${error.message}`);
    interrupted = true;
    clearInterval(interval);
    for (const child of collectors) signalGroup(child, "SIGKILL");
    await sampling;
    timeline.end();
    throw error;
  } finally {
    clearInterval(startupOwner);
  }
}

const test = spawn(command, args, { stdio: "inherit", detached: true });
testPid = test.pid;
let stopCompletion;
function stop(signal, reason) {
  if (interrupted) return;
  interrupted = true;
  clearInterval(interval);
  clearTimeout(terminationTimer);
  log(`${reason}; stopping test and diagnostic process groups`);
  signalGroup(test, signal);
  for (const child of collectors) signalGroup(child, "SIGKILL");
  if (indigoBridge) void indigoBridge.stop();
  stopCompletion = new Promise((resolve) => {
    setTimeout(() => {
      signalGroup(test, "SIGKILL");
      resolve();
    }, 2000);
  });
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stop(signal, `Received ${signal}`));
}
// Actions can kill only the owning shell on a step timeout. In that case this
// wrapper receives no signal and is reparented, so it must stop its own groups.
const checkOwner = () => {
  if (process.ppid !== ownerPid) stop("SIGINT", `Owner ${ownerPid} exited`);
};
const ownerInterval = setInterval(checkOwner, 1000);
ownerInterval.unref();
checkOwner();
test.on("error", (error) =>
  log(`Failed to start ${command}: ${error.message}`),
);
const exitCode = await new Promise((resolve) => {
  test.on("close", (code, signal) => {
    testPid = undefined;
    log(`Test finished: exit=${code} signal=${signal}`);
    resolve(interrupted ? 1 : (code ?? 1));
  });
});
clearInterval(interval);
clearTimeout(terminationTimer);
await sampling;
if (indigoBridge) await indigoBridge.stop();
if (!interrupted) await finalState();
for (const child of collectors) signalGroup(child, "SIGKILL");
if (stopCompletion) await stopCompletion;
clearInterval(ownerInterval);
timeline.end();
// Diagnostic failures never replace the test's exit status or retry a failure.
process.exitCode = exitCode;
