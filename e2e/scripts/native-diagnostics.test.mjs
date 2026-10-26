import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const execute = promisify(execFile);
const runner = fileURLToPath(
  new URL("native-diagnostics.mjs", import.meta.url),
);

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
  else setTimeout(() => process.exit(Number(args[0])), Number(process.env.TEST_DURATION_MS || 0));
} else if ((name === "xcrun" && args.includes("stream")) ||
           (name === "adb" && args.includes("logcat"))) {
  if (process.env.FORK_COLLECTOR === "true") {
    const { spawn } = require("node:child_process");
    const child = spawn(process.execPath, ["-e", 'setInterval(() => console.log("native log stream"), 25)'], { stdio: "inherit" });
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
  console.error("diagnostic deliberately unavailable");
  process.exit(17);
} else if (name === "sample") {
  fs.writeFileSync(args[args.indexOf("-file") + 1], "stack for selected pid " + args[0]);
  console.log(name, args.join(" "));
} else if (name === "sudo" && args.includes("spindump")) {
  fs.writeFileSync(args[args.indexOf("-file") + 1], "kernel stack for selected pid " + args[2]);
  console.log(name, args.join(" "));
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
        HOME: directory,
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

test("exits when a collector's descendant holds stdout after its parent exits", async () => {
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
