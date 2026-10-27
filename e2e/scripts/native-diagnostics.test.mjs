import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { uniqueHostedCoreSimulatorService } from "./native-diagnostics-processes.mjs";

const execute = promisify(execFile);
const runner =
  process.env.TELEPORT_TEST_NATIVE_RUNNER ||
  fileURLToPath(new URL("native-diagnostics.mjs", import.meta.url));

const serviceCommand =
  "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/com.apple.CoreSimulator.CoreSimulatorService";
const serviceRow = (pid) => `${pid} 1 S 0.8 0.2 11344 ${serviceCommand}`;

test("selects the unique actual hosted CoreSimulator service path", () => {
  assert.deepEqual(uniqueHostedCoreSimulatorService(serviceRow(1463), true), {
    pid: 1463,
    command: serviceCommand,
  });
});

test("does not select global services on developer or self-hosted machines", () => {
  assert.equal(
    uniqueHostedCoreSimulatorService(serviceRow(1463), false),
    undefined,
  );
});

test("does not guess between multiple CoreSimulator service processes", () => {
  assert.equal(
    uniqueHostedCoreSimulatorService(
      `${serviceRow(1463)}\n${serviceRow(2001)}`,
      true,
    ),
    undefined,
  );
});

test("rejects similarly named processes outside the actual framework path", () => {
  assert.equal(
    uniqueHostedCoreSimulatorService(
      "1463 1 S 0.8 0.2 11344 /tmp/com.apple.CoreSimulator.CoreSimulatorService",
      true,
    ),
    undefined,
  );
});

async function cleanupCollector(directory) {
  try {
    const pid = Number(
      await readFile(path.join(directory, "collector.pid"), "utf8"),
    );
    const { stdout } = await execute("/bin/ps", [
      "-p",
      String(pid),
      "-o",
      "command=",
    ]);
    if (stdout.includes(directory)) process.kill(pid, "SIGKILL");
  } catch (error) {
    if (!["ENOENT", "ESRCH", 1].includes(error.code)) throw error;
  }
}

async function assertExited(pid) {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      process.kill(pid, 0);
    } catch (error) {
      assert.equal(error.code, "ESRCH");
      return;
    }
    await delay(20);
  }
  assert.fail(`Collector ${pid} did not exit`);
}

// Fake every native tool, so these checks never inspect or operate a device.
async function fixture(forkCollector = false) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "teleport-diagnostics-"),
  );
  const bin = path.join(directory, "bin");
  await mkdir(bin);
  const source = `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const name = path.basename(process.argv[1]);
const args = process.argv.slice(2);
if (name === "test-command") {
  if (args[0] === "--version") console.log("test version");
  else {
    fs.writeFileSync("test.pid", String(process.pid));
    setTimeout(() => process.exit(Number(args[0])), Number(process.env.TEST_DURATION_MS || 0));
  }
} else if (name === "adb" && args.includes("logcat") && args.includes("-d")) {
  console.log("retained lifecycle events after adbd restart");
  console.log(name, args.join(" "));
} else if ((name === "xcrun" && args.includes("stream")) ||
           (name === "adb" && args.includes("logcat"))) {
  if (process.env.FORK_COLLECTOR === "true") {
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", 'process.stdout.on("error", () => {}); setInterval(() => console.log("native log stream"), 25)', process.cwd()], { stdio: "inherit" });
    fs.writeFileSync("collector.pid", String(child.pid));
    process.exit(0);
  }
  fs.writeFileSync("collector.pid", String(process.pid));
  console.log("native log stream");
  if (process.env.TERMINATION_PROBE) {
    console.log("testmanagerd[1234:abcd] selected simulator daemon");
    console.log("runningboardd[3456:abcd] selected simulator process manager");
    process.stdout.write("maestro-driver-iosUITests-Runner[5678:abcd] [Start] Terminat");
    setTimeout(() => {
      console.log("ing app teleport.example");
      if (process.env.TERMINATION_PROBE === "completed") {
        console.log("maestro-driver-iosUITests-Runner[5678:abcd] [End] Terminating app teleport.example");
      }
    }, 10);
  }
  setInterval(() => {}, 1000);
} else if (name === "ps") {
  if (process.env.SERVICE_PROBE && fs.existsSync("test.pid")) {
    const testPid = fs.readFileSync("test.pid", "utf8");
    const service = ${JSON.stringify(serviceCommand)};
    if (args.includes("-A")) {
      console.log("1000001", testPid, "S 0.0 0.0 100 /mock/simctl");
      console.log("1000002 1 S 0.0 0.0 100", service);
    } else if (args.includes("1000001")) {
      console.log("1000001", testPid, "/mock/simctl privacy test-device grant location-always teleport.example");
    } else if (args.includes("1000002")) {
      console.log("1000002", process.getuid(), service);
    }
    process.exit(0);
  }
  console.error("diagnostic deliberately unavailable");
  process.exit(17);
} else if (name === "sample") {
  fs.writeFileSync(args[args.indexOf("-file") + 1], "stack for selected pid " + args[0]);
  console.log(name, args.join(" "));
} else if (name === "sudo" && args.includes("spindump")) {
  fs.writeFileSync(args[args.indexOf("-file") + 1], "kernel stack for selected pid " + args[2]);
  console.log(name, args.join(" "));
} else if (name === "adb" && args[args.length - 1] === "dmesg" && process.env.KERNEL_PERMISSION_DENIED) {
  console.error("dmesg: Permission denied");
  process.exit(1);
} else console.log(name, args.join(" "));
`;
  for (const name of [
    "test-command",
    "xcrun",
    "xcodebuild",
    "uname",
    "sw_vers",
    "sysctl",
    "ps",
    "df",
    "vm_stat",
    "free",
    "adb",
    "sample",
    "sudo",
    "lsappinfo",
    "lsof",
    "log",
    "jcmd",
  ]) {
    await writeFile(path.join(bin, name), source, { mode: 0o755 });
  }
  return {
    directory,
    options: {
      cwd: directory,
      env: {
        ...process.env,
        PATH: bin,
        TELEPORT_DIAGNOSTIC_REPORTS_DIR: path.join(directory, "crash-reports"),
        FORK_COLLECTOR: String(forkCollector),
      },
      timeout: 10000,
    },
  };
}

for (const platform of ["ios", "android"]) {
  for (const code of [0, 7]) {
    test(`${platform}: preserves test exit ${code} despite diagnostic errors and stops collectors`, async () => {
      const { directory, options } = await fixture();
      try {
        let result;
        try {
          result = await execute(
            process.execPath,
            [
              runner,
              platform,
              "test-device",
              "--",
              "test-command",
              String(code),
            ],
            options,
          );
          assert.equal(code, 0);
        } catch (error) {
          assert.equal(error.code, code);
          result = error;
        }
        assert.match(result.stdout, new RegExp(`Test finished: exit=${code}`));
        const logs = path.join(directory, "e2e/reports/native-diagnostics");
        assert.match(
          await readFile(path.join(logs, "host-processes.log"), "utf8"),
          /exit=17/,
        );
        if (platform === "ios") {
          await assert.rejects(
            readFile(path.join(logs, "device-processes.log"), "utf8"),
            { code: "ENOENT" },
          );
        }
        assert.match(
          await readFile(
            path.join(
              logs,
              platform === "ios" ? "simulator.log" : "logcat.log",
            ),
            "utf8",
          ),
          /native log stream/,
        );
        const pid = Number(
          await readFile(path.join(directory, "collector.pid"), "utf8"),
        );
        await assertExited(pid);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}

test("requires an explicit native platform, device and command", async () => {
  await assert.rejects(execute(process.execPath, [runner, "ios"]), { code: 2 });
});

test("ios: hosted foreground observation adds no device RPC or activation", async () => {
  const { directory, options } = await fixture();
  try {
    await execute(
      process.execPath,
      [runner, "ios", "test-device", "--", "test-command", "0"],
      {
        ...options,
        env: {
          ...options.env,
          GITHUB_ACTIONS: "true",
          RUNNER_ENVIRONMENT: "github-hosted",
        },
      },
    );
    const logs = path.join(directory, "e2e/reports/native-diagnostics");
    const foreground = await readFile(
      path.join(logs, "host-foreground.log"),
      "utf8",
    );
    assert.match(foreground, /lsappinfo -names front/);
    assert.doesNotMatch(foreground, /setfront|launch|activate/);
    await assert.rejects(
      readFile(path.join(logs, "device-processes.log"), "utf8"),
      { code: "ENOENT" },
    );
    await assertExited(
      Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ios: a long owned client captures the identified hosted service without device RPCs", async () => {
  const { directory, options } = await fixture();
  try {
    const result = await execute(
      process.execPath,
      [runner, "ios", "test-device", "--", "test-command", "0"],
      {
        ...options,
        timeout: 70000,
        env: {
          ...options.env,
          // The first sighting is at the first 15s sample. Allow a third
          // sample so small scheduling differences cannot hide the 15s age.
          TEST_DURATION_MS: "51000",
          SERVICE_PROBE: "true",
          GITHUB_ACTIONS: "true",
          RUNNER_ENVIRONMENT: "github-hosted",
        },
      },
    );
    assert.match(result.stdout, /Test finished: exit=0/);
    assert.match(
      result.stdout,
      /Capturing hosted CoreSimulatorService 1000002/,
    );
    const logs = path.join(directory, "e2e/reports/native-diagnostics");
    for (const prefix of ["simctl-1000001", "simctl-1000001-service-1000002"]) {
      assert.match(
        await readFile(path.join(logs, `${prefix}-stack.txt`), "utf8"),
        /stack for selected pid 100000[12]/,
      );
    }
    assert.match(
      await readFile(
        path.join(logs, "simctl-1000001-service-1000002-host.log"),
        "utf8",
      ),
      /log show --last 3m --info --style compact --predicate processIdentifier == 1000002/,
    );
    await assert.rejects(readFile(path.join(logs, "device-processes.log")), {
      code: "ENOENT",
    });
    await assertExited(
      Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
    );
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});

test("android: CI emulator kernel capture does not restart adbd", async () => {
  const { directory, options } = await fixture();
  try {
    await execute(
      process.execPath,
      [runner, "android", "emulator-ci", "--", "test-command", "0"],
      {
        ...options,
        env: {
          ...options.env,
          GITHUB_ACTIONS: "true",
          KERNEL_PERMISSION_DENIED: "true",
        },
      },
    );
    const kernel = await readFile(
      path.join(directory, "e2e/reports/native-diagnostics/kernel.log"),
      "utf8",
    );
    assert.match(kernel, /Permission denied/);
    assert.match(kernel, /adb -s emulator-ci shell su 0 dmesg/);
    assert.doesNotMatch(kernel, /adb -s emulator-ci root/);
    const retained = await readFile(
      path.join(
        directory,
        "e2e/reports/native-diagnostics/logcat-final-lifecycle.log",
      ),
      "utf8",
    );
    assert.match(retained, /retained lifecycle events after adbd restart/);
    assert.match(retained, /logcat -b all -d .*livelock:I/);
    await assertExited(
      Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("stops collector descendants that ignore closed stdout after their parent exits", async () => {
  const { directory, options } = await fixture(true);
  try {
    const result = await execute(
      process.execPath,
      [runner, "ios", "test-device", "--", "test-command", "0"],
      options,
    );
    assert.match(result.stdout, /Test finished: exit=0/);
    const pid = Number(
      await readFile(path.join(directory, "collector.pid"), "utf8"),
    );
    await assertExited(pid);
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});

for (const state of ["stalled", "completed"]) {
  test(`ios: ${state} termination ${state === "stalled" ? "captures" : "does not capture"} selected simulator stacks`, async () => {
    const { directory, options } = await fixture();
    try {
      const result = await execute(
        process.execPath,
        [runner, "ios", "test-device", "--", "test-command", "0"],
        {
          ...options,
          timeout: 15000,
          env: {
            ...options.env,
            TEST_DURATION_MS: "9000",
            TERMINATION_PROBE: state,
            GITHUB_ACTIONS: "true",
          },
        },
      );
      assert.match(result.stdout, /Test finished: exit=0/);
      const logs = path.join(directory, "e2e/reports/native-diagnostics");
      for (const [name, pid] of [
        ["testmanagerd", "1234"],
        ["runningboardd", "3456"],
        ["maestro-driver-iosUITests-Runner", "5678"],
      ]) {
        const file = path.join(logs, `termination-stall-1-${name}.log`);
        if (state === "stalled") {
          assert.match(
            await readFile(file, "utf8"),
            new RegExp(`sample ${pid} 3`),
          );
          assert.equal(
            await readFile(
              path.join(logs, `termination-stall-1-${name}-stack.txt`),
              "utf8",
            ),
            `stack for selected pid ${pid}`,
          );
        } else {
          await assert.rejects(readFile(file), { code: "ENOENT" });
        }
      }
      const kernel = path.join(
        logs,
        "termination-stall-1-runningboardd-kernel.txt",
      );
      if (state === "stalled") {
        assert.equal(
          await readFile(kernel, "utf8"),
          "kernel stack for selected pid 3456",
        );
        assert.match(
          await readFile(
            path.join(logs, "termination-stall-1-runningboardd-kernel.log"),
            "utf8",
          ),
          /sudo -n spindump 3456 3 10 -onlyTarget/,
        );
      } else {
        await assert.rejects(readFile(kernel), { code: "ENOENT" });
      }
      await assertExited(
        Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
