import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  ownedSimctlAge,
  ownedSimctlChildren,
  ownedSimctlLogStream,
  sameOwnerProcess,
  selectedHostedLaunchd,
  uniqueHostedCoreSimulatorService,
  uniqueHostedSimLaunchHost,
} from "./native-diagnostics-processes.mjs";

const execute = promisify(execFile);
const runner =
  process.env.TELEPORT_TEST_NATIVE_RUNNER ||
  fileURLToPath(new URL("native-diagnostics.mjs", import.meta.url));

const serviceCommand =
  "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/XPCServices/com.apple.CoreSimulator.CoreSimulatorService.xpc/Contents/MacOS/com.apple.CoreSimulator.CoreSimulatorService";
const serviceRow = (pid) => `${pid} 1 S 0.8 0.2 11344 ${serviceCommand}`;
const launchHostCommand =
  "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/Versions/A/XPCServices/SimLaunchHost.arm64.xpc/Contents/MacOS/SimLaunchHost.arm64";
const runtimeRoot =
  "/Library/Developer/CoreSimulator/Volumes/iOS_22F77/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS 18.5.simruntime/Contents/Resources/RuntimeRoot";
const daemonCommand = `${runtimeRoot}/usr/libexec/testmanagerd`;
const chainTable = `
1000003 1 S 0.0 0.0 100 ${launchHostCommand}
1000004 1 S 0.0 0.0 100 launchd_sim
1000005 1000004 S 0.0 0.0 100 ${daemonCommand}
1000008 1 S 0.0 0.0 100 launchd_sim
1000009 1000008 S 0.0 0.0 100 ${runtimeRoot}/usr/libexec/runningboardd`;

test("log stream identity requires the exact JVM, owner, executable and selected UDID", () => {
  const command =
    "/native/simctl spawn selected-device log stream --level debug";
  const row = `24915 9712 501 ${command}`;
  const identify = (details) =>
    ownedSimctlLogStream(details, 24915, 9712, 501, "selected-device");
  assert.deepEqual(identify(row), {
    pid: 24915,
    parent: 9712,
    uid: 501,
    command,
  });
  for (const changed of [
    row.replace("24915", "24916"),
    row.replace("9712", "9713"),
    row.replace("501", "502"),
    row.replace("/native/simctl", "/native/not-simctl"),
    row.replace("selected-device", "other-device"),
    row.replace("selected-device", "booted"),
    row.replace("log stream", "log show"),
    row.replace("spawn", "privacy"),
    `${row}\n${row}`,
  ]) {
    assert.equal(identify(changed), undefined);
  }
  assert.deepEqual(
    ownedSimctlChildren(
      "24915 9712 S 0 0 100 /native/simctl\n24916 9713 S 0 0 100 /native/simctl\n24917 9712 S 0 0 100 /native/other",
      9712,
    ),
    [24915],
  );
});

test("uses native process age when two polling observations are less than 15s apart", () => {
  const row = (age) =>
    `25112 13137 ${age} /native/simctl privacy selected-device grant location-always teleport.example`;
  assert.equal(ownedSimctlAge(row("00:24"), 25112, 13137), 24);
  assert.equal(ownedSimctlAge(row("00:14"), 25112, 13137), 14);
  assert.equal(ownedSimctlAge(row("01:02:03"), 25112, 13137), 3723);
  assert.equal(ownedSimctlAge(row("2-03:04:05"), 25112, 13137), 183845);
  assert.equal(ownedSimctlAge(row("00:24"), 25113, 13137), undefined);
  assert.equal(ownedSimctlAge(row("00:24"), 25112, 13138), undefined);
  assert.equal(ownedSimctlAge(row("00:60"), 25112, 13137), undefined);
  assert.equal(ownedSimctlAge(row("2-24:00:00"), 25112, 13137), undefined);
  assert.equal(ownedSimctlAge(row("bad"), 25112, 13137), undefined);
  assert.equal(
    ownedSimctlAge(
      row("00:24").replace("/native/simctl", "/native/other"),
      25112,
      13137,
    ),
    undefined,
  );
  assert.equal(
    ownedSimctlAge(row("00:24").replace(" privacy ", " spawn "), 25112, 13137),
    undefined,
  );
});

test("selects a unique hosted SimLaunchHost executable", () => {
  assert.deepEqual(uniqueHostedSimLaunchHost(chainTable, true), {
    pid: 1000003,
    command: launchHostCommand,
  });
  assert.equal(uniqueHostedSimLaunchHost(chainTable, false), undefined);
  assert.equal(
    uniqueHostedSimLaunchHost(
      `${chainTable}\n1000010 1 S 0 0 100 ${launchHostCommand}`,
      true,
    ),
    undefined,
  );
  assert.equal(
    uniqueHostedSimLaunchHost(
      chainTable.replace("/Library/Developer/PrivateFrameworks/", "/tmp/"),
      true,
    ),
    undefined,
  );
});

test("uses selected simulator daemon parentage instead of a global launchd name", () => {
  const scoped = new Map([["testmanagerd", "1000005"]]);
  assert.deepEqual(selectedHostedLaunchd(chainTable, scoped, true), {
    pid: 1000004,
    command: "launchd_sim",
    childPid: 1000005,
    childCommand: daemonCommand,
  });
  assert.equal(selectedHostedLaunchd(chainTable, scoped, false), undefined);
  assert.equal(selectedHostedLaunchd(chainTable, new Map(), true), undefined);
});

test("rejects stale PID reuse and conflicting selected simulator parents", () => {
  const scoped = new Map([["testmanagerd", "1000005"]]);
  assert.equal(
    selectedHostedLaunchd(
      chainTable.replace(daemonCommand, "/usr/libexec/testmanagerd"),
      scoped,
      true,
    ),
    undefined,
  );
  assert.equal(
    selectedHostedLaunchd(
      chainTable,
      new Map([...scoped, ["runningboardd", "1000009"]]),
      true,
    ),
    undefined,
  );
});

test("revalidates exact process PID, owner and executable", () => {
  const expected = { pid: 1000003, command: launchHostCommand };
  const details = `1000003 501 ${launchHostCommand}`;
  assert.equal(sameOwnerProcess(details, expected, 501), true);
  assert.equal(sameOwnerProcess(details, expected, 502), false);
  assert.equal(
    sameOwnerProcess(details, { ...expected, pid: 1000004 }, 501),
    false,
  );
  assert.equal(
    sameOwnerProcess(
      details.replace(launchHostCommand, "/tmp/SimLaunchHost.arm64"),
      expected,
      501,
    ),
    false,
  );
});

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
  if (process.env.SERVICE_PROBE) {
    console.log("testmanagerd[1000005:abcd] selected simulator daemon");
  }
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
  if (process.env.SDK_CLICK_PROBE) {
    const clickTimer = setInterval(() => {
      if (!fs.existsSync("test.pid")) return;
      clearInterval(clickTimer);
      const line = '10-27 11:00:00.123 1234 1235 I MaestroNativeInput: {"phase":"native.click.complete","x":540,"y":1512,"accepted":true,"completedUptimeMs":12345}';
      process.stdout.write(line.slice(0, 100));
      setTimeout(() => { console.log(line.slice(100)); console.log(line); }, 10);
    }, 25);
  }
  setInterval(() => {}, 1000);
} else if (name === "adb" && args.includes("path")) {
  fs.appendFileSync("sdk-identity-queries.log", JSON.stringify(args) + "\\n");
  console.log("package:/data/app/~~fixture/dev.mobile.maestro.test-fixture/base.apk");
} else if (name === "adb" && args.includes("sha256sum")) {
  fs.appendFileSync("sdk-identity-queries.log", JSON.stringify(args) + "\\n");
  console.log("a".repeat(64) + "  /data/app/~~fixture/dev.mobile.maestro.test-fixture/base.apk");
} else if (name === "ps") {
  if (process.env.LAUNCHER_PROBE && fs.existsSync("test.pid")) {
    const testPid = fs.readFileSync("test.pid", "utf8");
    const xcodebuild = "/Applications/Xcode_16.4.app/Contents/Developer/usr/bin/xcodebuild";
    const executableHeader = "TELEPORT_EXECUTABLE".padEnd(256, "_");
    if (args.includes("pid=,ppid=,uid=,etime=,comm=" + executableHeader + ",args=")) {
      fs.appendFileSync("launcher-identity-queries.log", JSON.stringify(args) + "\\n");
      console.log(executableHeader);
      const row = (pid, parent, executable, argv) => console.log(pid, parent, process.getuid(), "00:20", executable.padEnd(256), argv);
      row(process.ppid, 1, "/mock/node", "node wrapper.mjs");
      row(testPid, process.ppid, "/mock/java", "/mock/java -cp fixture");
      row("1000101", testPid, "/bin/bash", "/bin/bash /usr/bin/xcrun simctl terminate test-device teleport.example");
      row("1000102", "1000101", xcodebuild, xcodebuild + " -find simctl");
      row("1000103", "1", "/bin/bash", "/bin/bash foreign");
      row("1000104", "1000103", xcodebuild, xcodebuild + " foreign");
    } else if (args.includes("-A")) {
      console.log(testPid, process.ppid, "S 0.0 0.0 100 /mock/java");
      console.log("1000101", testPid, "S 0.0 0.0 100 /bin/bash");
      console.log("1000102 1000101 R 0.0 0.0 100", xcodebuild);
      console.log("1000103 1 S 0.0 0.0 100 /bin/bash");
      console.log("1000104 1000103 R 0.0 0.0 100", xcodebuild);
    } else if (args.some((arg) => arg.includes("1000101"))) {
      fs.appendFileSync("launcher-identity-queries.log", JSON.stringify(args) + "\\n");
      console.log(testPid, process.ppid, process.getuid(), "00:24 /mock/java -cp fixture");
      console.log("1000101", testPid, process.getuid(), "00:20 /bin/bash /usr/bin/xcrun simctl terminate test-device teleport.example");
      console.log("1000102 1000101", process.getuid(), "00:20", xcodebuild, "-find simctl");
    }
    process.exit(0);
  }
  if (process.env.SERVICE_PROBE && fs.existsSync("test.pid")) {
    const testPid = fs.readFileSync("test.pid", "utf8");
    const service = ${JSON.stringify(serviceCommand)};
    if (args.includes("-A")) {
      console.log("1000001", testPid, "S 0.0 0.0 100 /mock/simctl");
      console.log("1000006", testPid, "S 0.0 0.0 100 /mock/simctl");
      console.log("1000007", testPid, "S 0.0 0.0 100 /mock/simctl");
      console.log("1000002 1 S 0.0 0.0 100", service);
      console.log(${JSON.stringify(chainTable)});
    } else if (args.includes("1000001")) {
      console.log("1000001", testPid, "00:20 /mock/simctl privacy test-device grant location-always teleport.example");
    } else if (args.includes("1000002")) {
      console.log("1000002", process.getuid(), service);
    } else if (args.includes("1000003")) {
      console.log("1000003", process.getuid(), ${JSON.stringify(launchHostCommand)});
    } else if (args.includes("1000004")) {
      console.log("1000004", process.getuid(), "launchd_sim");
    } else if (args.includes("1000005")) {
      console.log("1000005 1000004", ${JSON.stringify(daemonCommand)});
    } else if (args.includes("1000006")) {
      console.log("1000006", testPid, process.getuid(), "/mock/simctl spawn test-device log stream --level debug");
    } else if (args.includes("1000007")) {
      console.log("1000007", testPid, process.getuid(), "/mock/simctl spawn other-device log stream --level debug");
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
        // Each mocked case opts in explicitly, independently of its CI job.
        MAESTRO_IOS_ARCHIVE_FRAMES: "false",
        TELEPORT_IOS_LAUNCHER_OBSERVE: "0",
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
    assert.match(
      await readFile(path.join(logs, "timeline.log"), "utf8"),
      /iOS native wait-chain diagnostics=1/,
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
          // The native client is already 20s old at the first sighting. The
          // wrapper must capture it before a second 15s sample is needed.
          TEST_DURATION_MS: "24000",
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
    for (const prefix of [
      "simctl-1000001",
      "simctl-1000001-service-1000002",
      "simctl-1000001-launch-host-1000003",
      "simctl-1000001-launchd-1000004",
      "simctl-1000001-log-stream-1000006",
    ]) {
      assert.match(
        await readFile(path.join(logs, `${prefix}-stack.txt`), "utf8"),
        /stack for selected pid 100000[12346]/,
      );
    }
    assert.match(
      await readFile(
        path.join(logs, "simctl-1000001-service-1000002-host.log"),
        "utf8",
      ),
      /log show --last 3m --info --style compact --predicate processIdentifier == 1000002/,
    );
    assert.match(
      await readFile(
        path.join(logs, "simctl-1000001-launchd-1000004-child-identity.log"),
        "utf8",
      ),
      /1000005 1000004/,
    );
    await assert.rejects(
      readFile(path.join(logs, "simctl-1000001-launchd-1000008-stack.txt")),
      {
        code: "ENOENT",
      },
    );
    await assert.rejects(
      readFile(path.join(logs, "simctl-1000001-log-stream-1000007-stack.txt")),
      { code: "ENOENT" },
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

test("ios: owner exit during persistent HID startup stops only owned helper/collectors", async () => {
  const { directory, options } = await fixture();
  const selectedDevice = randomUUID();
  try {
    const helper = path.join(directory, "hid-startup-helper");
    const source = `#!${process.execPath}\nrequire('node:fs').writeFileSync('hid-startup.pid',String(process.pid));setInterval(()=>{},1000);\n`;
    await writeFile(helper, source, { mode: 0o755 });
    const entry = {
      file: helper,
      sha256: createHash("sha256").update(source).digest("hex"),
    };
    const manifest = path.join(directory, "hid-manifest.json");
    await writeFile(
      manifest,
      JSON.stringify({
        helper: entry,
        core: entry,
        kit: entry,
        developer: directory,
      }),
    );
    const owner = path.join(directory, "hid-owner.mjs");
    await writeFile(
      owner,
      `
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const out=fs.openSync('hid-owner.log','a');
const child=spawn(process.execPath,${JSON.stringify([runner, "ios", selectedDevice, "--", "test-command", "0"])},{stdio:['ignore',out,out]});
child.unref();fs.writeFileSync('hid-wrapper.pid',String(child.pid));
const start=Date.now();setInterval(()=>{if(fs.existsSync('hid-startup.pid'))process.exit(0);if(Date.now()-start>10000)process.exit(22);},10);
`,
    );
    await execute(process.execPath, [owner], {
      ...options,
      timeout: 15000,
      env: {
        ...options.env,
        MAESTRO_IOS_INPUT_BACKEND: "indigo",
        MAESTRO_IOS_HID_MANIFEST: manifest,
      },
    });
    const ids = await Promise.all(
      ["hid-startup.pid", "hid-wrapper.pid", "collector.pid"].map(
        async (file) =>
          Number(await readFile(path.join(directory, file), "utf8")),
      ),
    );
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const live = ids.some((pid) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      });
      if (!live) break;
      await delay(20);
    }
    for (const pid of ids) await assertExited(pid);
    assert.match(
      await readFile(path.join(directory, "hid-owner.log"), "utf8"),
      /exited during HID startup/,
    );
    await assert.rejects(readFile(path.join(directory, "test.pid")), {
      code: "ENOENT",
    });
  } finally {
    for (const file of [
      "hid-startup.pid",
      "hid-wrapper.pid",
      "collector.pid",
    ]) {
      try {
        const pid = Number(await readFile(path.join(directory, file), "utf8"));
        const { stdout } = await execute("/bin/ps", [
          "-p",
          String(pid),
          "-o",
          "command=",
        ]);
        if (
          stdout.includes(directory) ||
          (stdout.includes(selectedDevice) && stdout.includes(runner))
        )
          process.kill(pid, "SIGKILL");
      } catch (error) {
        if (!["ENOENT", "ESRCH", 1].includes(error.code)) throw error;
      }
    }
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

test("ios: opt-in launcher observation captures only the current JVM-owned branch", async () => {
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
          MAESTRO_IOS_PROFILE: "indigo-visual-touch-trace",
          TELEPORT_IOS_LAUNCHER_OBSERVE: "1",
          LAUNCHER_PROBE: "true",
          // Keep this mock command alive through the existing 15s host
          // sample. No application/device interaction or deadline changes.
          TEST_DURATION_MS: "18000",
        },
        timeout: 30000,
      },
    );
    const logs = path.join(directory, "e2e/reports/native-diagnostics");
    const report = JSON.parse(
      await readFile(
        path.join(logs, "native-launcher-observation.json"),
        "utf8",
      ),
    );
    assert.equal(report.enabled, true);
    assert.deepEqual(report.errors, []);
    assert.equal(report.observations.length, 1);
    const observation = report.observations[0];
    assert.equal(observation.verifiedOwnership, true);
    assert.equal(observation.launcher.pid, 1000101);
    assert.equal(observation.child.pid, 1000102);
    assert.match(
      observation.launcher.command,
      /xcrun simctl terminate test-device/,
    );
    assert.match(observation.child.command, /xcodebuild -find simctl$/);
    assert.equal(report.deviceAPICalls, 0);
    assert.equal(report.final_stability_credit, false);
    const queries = (
      await readFile(
        path.join(directory, "launcher-identity-queries.log"),
        "utf8",
      )
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0], [
      "-A",
      "-o",
      `pid=,ppid=,uid=,etime=,comm=${"TELEPORT_EXECUTABLE".padEnd(256, "_")},args=`,
    ]);
    const { verifyLauncherReport } = await import(
      "./ios-native-launcher-observe.mjs"
    );
    assert.equal(verifyLauncherReport(logs).version, 2);
    await assertExited(
      Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
    );
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});

test("ios: launcher observation stays off by default with the same visible branch", async () => {
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
          MAESTRO_IOS_PROFILE: "indigo-visual-touch-trace",
          LAUNCHER_PROBE: "true",
        },
      },
    );
    for (const file of [
      "e2e/reports/native-diagnostics/native-launcher-observation.json",
      "launcher-identity-queries.log",
    ]) {
      await assert.rejects(readFile(path.join(directory, file)), {
        code: "ENOENT",
      });
    }
    await assertExited(
      Number(await readFile(path.join(directory, "collector.pid"), "utf8")),
    );
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});

for (const scope of [
  {
    platform: "android",
    hosted: "github-hosted",
    profile: "indigo-visual-touch-trace",
  },
  {
    platform: "ios",
    hosted: "self-hosted",
    profile: "indigo-visual-touch-trace",
  },
  { platform: "ios", hosted: "github-hosted", profile: "native-driver" },
]) {
  test(`launcher opt-in rejects unsupported scope ${scope.platform}/${scope.hosted}/${scope.profile}`, async () => {
    const { directory, options } = await fixture();
    try {
      await assert.rejects(
        execute(
          process.execPath,
          [runner, scope.platform, "test-device", "--", "test-command", "0"],
          {
            ...options,
            env: {
              ...options.env,
              GITHUB_ACTIONS: "true",
              RUNNER_ENVIRONMENT: scope.hosted,
              MAESTRO_IOS_PROFILE: scope.profile,
              TELEPORT_IOS_LAUNCHER_OBSERVE: "1",
            },
          },
        ),
        (error) =>
          error.code === 1 &&
          /requires the hosted iOS visual diagnostic profile/.test(
            error.stderr,
          ),
      );
      await assert.rejects(readFile(path.join(directory, "test.pid")), {
        code: "ENOENT",
      });
      await assert.rejects(readFile(path.join(directory, "collector.pid")), {
        code: "ENOENT",
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

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

test("android: first post-click marker captures live selected SDK APK exactly once", async () => {
  const { directory, options } = await fixture();
  try {
    options.env.SDK_CLICK_PROBE = "1";
    options.env.TELEPORT_SDK_CLICK_TRACE = "1";
    options.env.TEST_DURATION_MS = "1200";
    await execute(
      process.execPath,
      [runner, "android", "emulator-5554", "--", "test-command", "0"],
      options,
    );
    const native = path.join(directory, "e2e/reports/native-diagnostics");
    const identity = JSON.parse(
      await readFile(path.join(native, "native-click-installed.json"), "utf8"),
    );
    assert.equal(identity.device, "emulator-5554");
    assert.equal(identity.sha256, "a".repeat(64));
    assert.equal(identity.error, undefined);
    const queries = (
      await readFile(path.join(directory, "sdk-identity-queries.log"), "utf8")
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(queries.length, 3);
    assert.ok(queries.every((q) => q[0] === "-s" && q[1] === "emulator-5554"));
    assert.equal(queries.filter((q) => q.includes("sha256sum")).length, 1);
    const pid = Number(
      await readFile(path.join(directory, "collector.pid"), "utf8"),
    );
    await assertExited(pid);
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});

test("android: ordinary suite never captures SDK package identity", async () => {
  const { directory, options } = await fixture();
  try {
    options.env.SDK_CLICK_PROBE = "1";
    options.env.TEST_DURATION_MS = "600";
    delete options.env.TELEPORT_SDK_CLICK_TRACE;
    await execute(
      process.execPath,
      [runner, "android", "emulator-5554", "--", "test-command", "0"],
      options,
    );
    await assert.rejects(
      readFile(path.join(directory, "sdk-identity-queries.log")),
      { code: "ENOENT" },
    );
  } finally {
    await cleanupCollector(directory);
    await rm(directory, { recursive: true, force: true });
  }
});
