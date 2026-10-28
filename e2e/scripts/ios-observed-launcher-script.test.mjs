import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createLauncherObserver } from "./ios-native-launcher-observe.mjs";
import {
  collectLauncherScript,
  readBoundedRegular,
  scriptLimits,
  selectedScripts,
  verifyLauncherScript,
} from "./ios-observed-launcher-script.mjs";

const device = "DC4CD8B3-4457-4153-9087-A0D7A2F9BFD9";
const executable =
  "/Applications/Xcode_16.4.app/Contents/Developer/usr/bin/xcodebuild";
const script = path.join(path.dirname(executable), "simctl");
const header = "TELEPORT_EXECUTABLE".padEnd(256, "_");
const row = (pid, parent, command, args) =>
  `${pid} ${parent} 501 00:20 ${command.padEnd(256)} ${args}\n`;
const snapshot = (matching) =>
  header +
  "\n" +
  row(10628, 1, "/mock/node", "node wrapper.mjs") +
  row(11307, 10628, "/mock/java", "/mock/java -cp fixture") +
  row(
    30770,
    11307,
    "/bin/bash",
    matching
      ? `/bin/bash ${script} list -j`
      : "/bin/bash /usr/bin/xcrun simctl list -j",
  ) +
  row(30815, 30770, executable, `${executable} -runFirstLaunch`);

async function fixture(t, matching = true) {
  const directory = fs.mkdtempSync(
    path.join(fs.realpathSync(os.tmpdir()), "teleport-script-evidence-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const data = snapshot(matching);
  const observer = createLauncherObserver({
    directory,
    ownerPID: 10628,
    uid: 501,
    device,
    capture: async (name, command, timeout, onChunk) => {
      assert.equal(timeout, 15000);
      onChunk(Buffer.from(data));
      fs.writeFileSync(
        path.join(directory, name),
        `\n2026-10-28T08:00:00.000Z ${command[0]} ${command[1].join(" ")}\n${data}\n2026-10-28T08:00:00.010Z exit=0 signal=null\n`,
      );
    },
    log: () => {},
  });
  await observer.observe("original legacy consumers unchanged", 11307);
  const local = path.join(directory, "fixture-script");
  fs.writeFileSync(
    local,
    '#!/bin/bash\n# retained raw fixture only\nexec /native/simctl "$@"\n',
  );
  const options = {
    directory,
    candidate: "a".repeat(40),
    attempt: 1,
    device,
    profile: "indigo-visual-touch-trace",
  };
  const reads = [];
  const read = (file, limit) => {
    reads.push({ file, limit });
    assert.equal(file, script);
    return readBoundedRegular(local, limit);
  };
  const reportFile = path.join(
    directory,
    "observed-launcher-script/report.json",
  );
  const rewrite = (change) => {
    const report = JSON.parse(fs.readFileSync(reportFile));
    change(report);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  };
  return { directory, options, read, reads, local, reportFile, rewrite };
}

test("retains the one observed script once and verifies the exact archived source and bytes", async (t) => {
  const f = await fixture(t);
  const r = collectLauncherScript(f.options, f.read);
  assert.deepEqual(r.errors, []);
  assert.equal(r.files.length, 1);
  assert.equal(f.reads.length, 1);
  assert.equal(f.reads[0].limit, scriptLimits.scriptBytes);
  assert.equal(r.files[0].observedPath, script);
  assert.match(r.limitation, /not an exec inode/);
  fs.writeFileSync(f.local, "changed after the one collection; do not recopy");
  assert.equal(verifyLauncherScript(f.options).scripts, 1);
  assert.equal(f.reads.length, 1);
  assert.throws(() => collectLauncherScript(f.options, f.read), /EEXIST/);
});

test("zero relevant branches retains no script and makes no absence-of-wait claim", async (t) => {
  const f = await fixture(t, false);
  const r = collectLauncherScript(f.options, f.read);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.selections, []);
  assert.deepEqual(r.files, []);
  assert.equal(f.reads.length, 0);
  assert.equal(verifyLauncherScript(f.options).scripts, 0);
});

test("outside the diagnostic profile returns before any supplied file reader", () => {
  let reads = 0;
  const r = collectLauncherScript({ profile: "native-driver" }, () => {
    reads++;
    throw new Error("unexpected read");
  });
  assert.deepEqual(r, { enabled: false, deviceAPICalls: 0, fileReads: 0 });
  assert.equal(reads, 0);
});

test("candidate, attempt and selected device mismatches fail before source or script access", async (t) => {
  const f = await fixture(t);
  for (const change of [
    { candidate: "main" },
    { attempt: 2 },
    { attempt: 0 },
    { device: "all" },
  ])
    assert.throws(() =>
      collectLauncherScript({ ...f.options, ...change }, f.read),
    );
  assert.equal(f.reads.length, 0);
});

test("raw launcher ownership and source failures are preserved as a failed collection", async (t) => {
  const f = await fixture(t);
  const file = path.join(f.directory, "native-launcher-observation.json");
  const report = JSON.parse(fs.readFileSync(file));
  report.observations[0].launcher.parent++;
  fs.writeFileSync(file, JSON.stringify(report));
  const r = collectLauncherScript(f.options, f.read);
  assert.equal(r.errors.length, 1);
  assert.equal(f.reads.length, 0);
  assert.throws(() => verifyLauncherScript(f.options));
  assert.equal(JSON.parse(fs.readFileSync(f.reportFile)).errors.length, 1);
});

test("matching observed scripts require the exact bootstrap argv and unique Xcode directory", async (t) => {
  const f = await fixture(t);
  const r = JSON.parse(
    fs.readFileSync(path.join(f.directory, "native-launcher-observation.json")),
  );
  for (const change of [
    (x) => {
      x.observations[0].child.command += " -other";
    },
    (x) => {
      x.observations[0].launcher.parent++;
    },
    (x) => {
      x.observations[0].child.uid++;
    },
    (x) => {
      x.observations[0].child.executable = "/tmp/xcodebuild";
    },
    (x) => {
      x.observations.push({
        ...x.observations[0],
        child: {
          ...x.observations[0].child,
          executable: executable.replace("16.4", "16.3"),
          command: executable.replace("16.4", "16.3") + " -runFirstLaunch",
        },
        launcher: {
          ...x.observations[0].launcher,
          command: `/bin/bash ${script.replace("16.4", "16.3")} list -j`,
        },
      });
    },
  ]) {
    const value = JSON.parse(JSON.stringify(r));
    change(value);
    assert.throws(() => selectedScripts(value));
  }
});

test("bounded descriptor read rejects symlinks, linked parents, hard links, directories and oversized files", async (t) => {
  const f = await fixture(t);
  const link = path.join(f.directory, "link");
  fs.symlinkSync(f.local, link);
  assert.throws(() => readBoundedRegular(link, 131072));
  const parent = path.join(f.directory, "linked-parent");
  fs.symlinkSync(f.directory, parent);
  assert.throws(() =>
    readBoundedRegular(path.join(parent, "fixture-script"), 131072),
  );
  assert.throws(() => readBoundedRegular(f.directory, 131072));
  assert.throws(() => readBoundedRegular(f.local, 1));
  fs.linkSync(f.local, path.join(f.directory, "hardlink"));
  assert.throws(() => readBoundedRegular(f.local, 131072));
});

test("incomplete, changed and foreign descriptor reads fail and always close the owned descriptor", async (t) => {
  const f = await fixture(t);
  for (const mode of ["incomplete", "changed", "foreign"]) {
    fs.writeFileSync(f.local, "#!/bin/bash\necho fixture\n");
    let closes = 0;
    const io = {
      ...fs,
      closeSync: (fd) => {
        closes++;
        return fs.closeSync(fd);
      },
    };
    if (mode === "incomplete") io.readSync = () => 0;
    if (mode === "foreign")
      io.fstatSync = (fd, options) => ({
        ...fs.fstatSync(fd, options),
        ino: 1n,
      });
    if (mode === "changed")
      io.readSync = (...args) => {
        const n = fs.readSync(...args);
        fs.appendFileSync(f.local, "# change\n");
        return n;
      };
    assert.throws(() => readBoundedRegular(f.local, 131072, io));
    assert.equal(closes, 1);
  }
});

for (const [label, bytes] of [
  ["empty", Buffer.alloc(0)],
  ["oversize", Buffer.alloc(131073)],
  ["binary", Buffer.from([0xff, 0xfe])],
  ["nul", Buffer.from("#!/bin/bash\n\0")],
  ["bom", Buffer.from("\ufeff#!/bin/bash\n")],
  ["not-shell", Buffer.from("unobserved binary or text\n")],
])
  test(`malformed ${label} script is retained as an explicit failed gate without repair`, async (t) => {
    const f = await fixture(t);
    fs.writeFileSync(f.local, bytes);
    const r = collectLauncherScript(f.options, f.read);
    assert.equal(r.errors.length, 1);
    const retained = label === "empty" || label === "oversize" ? 0 : 1;
    assert.equal(r.files.length, retained);
    if (retained)
      assert.deepEqual(
        fs.readFileSync(
          path.join(f.directory, "observed-launcher-script/simctl.script"),
        ),
        bytes,
      );
    assert.equal(f.reads.length, 1);
    assert.throws(() => verifyLauncherScript(f.options));
  });

test("the exact maximum-sized complete script is accepted without a second source read", async (t) => {
  const f = await fixture(t);
  fs.writeFileSync(f.local, "#!/bin/bash\n" + "#".repeat(131072 - 12));
  const r = collectLauncherScript(f.options, f.read);
  assert.deepEqual(r.errors, []);
  assert.equal(r.files[0].bytes, 131072);
  assert.equal(verifyLauncherScript(f.options).scripts, 1);
  assert.equal(f.reads.length, 1);
});

for (const [label, change] of [
  [
    "candidate",
    (r) => {
      r.candidate = "b".repeat(40);
    },
  ],
  [
    "attempt",
    (r) => {
      r.attempt = 2;
    },
  ],
  [
    "device",
    (r) => {
      r.device = "other";
    },
  ],
  [
    "path",
    (r) => {
      r.files[0].observedPath = "/tmp/simctl";
    },
  ],
  [
    "hash",
    (r) => {
      r.files[0].SHA256 = "0".repeat(64);
    },
  ],
  [
    "length",
    (r) => {
      r.files[0].bytes++;
    },
  ],
  [
    "descriptor",
    (r) => {
      r.files[0].identity.links = 2;
    },
  ],
  [
    "clock",
    (r) => {
      r.files[0].readBegin.monotonicNs = r.files[0].readEnd.monotonicNs + "0";
    },
  ],
  [
    "missing",
    (r) => {
      r.files = [];
    },
  ],
  [
    "duplicate",
    (r) => {
      r.files.push(r.files[0]);
    },
  ],
  [
    "selection",
    (r) => {
      r.selections[0].launcherPID++;
    },
  ],
  [
    "raw",
    (r) => {
      r.launcherInputSHA256 = "0".repeat(64);
    },
  ],
  [
    "failed",
    (r) => {
      r.errors.push("retained failure");
    },
  ],
  [
    "source",
    (r) => {
      r.sourceHashes["ios-observed-launcher-script.mjs"] = "0".repeat(64);
    },
  ],
])
  test(`independent post-check rejects ${label} evidence tampering`, async (t) => {
    const f = await fixture(t);
    assert.deepEqual(collectLauncherScript(f.options, f.read).errors, []);
    f.rewrite(change);
    assert.throws(() => verifyLauncherScript(f.options));
  });

test("extra files and altered saved bytes are rejected without touching the original path", async (t) => {
  const f = await fixture(t);
  collectLauncherScript(f.options, f.read);
  const output = path.join(f.directory, "observed-launcher-script");
  fs.writeFileSync(path.join(output, "extra"), "not in coverage");
  assert.throws(() => verifyLauncherScript(f.options));
  fs.unlinkSync(path.join(output, "extra"));
  fs.writeFileSync(
    path.join(output, "simctl.script"),
    "#!/bin/bash\nchanged\n",
  );
  assert.throws(() => verifyLauncherScript(f.options));
  assert.equal(f.reads.length, 1);
});

test("the CLI rejects scope overrides and unknown arguments before collection", async (t) => {
  const f = await fixture(t);
  const module = new URL("./ios-observed-launcher-script.mjs", import.meta.url)
    .pathname;
  const args = [
    module,
    "collect",
    "--directory",
    f.directory,
    "--candidate",
    f.options.candidate,
    "--attempt",
    "1",
    "--device",
    device,
    "--profile",
    f.options.profile,
  ];
  const changed = spawnSync(process.execPath, args, {
    env: { ...process.env, GITHUB_SHA: "b".repeat(40) },
    encoding: "utf8",
  });
  assert.equal(changed.status, 1);
  assert.match(changed.stderr, /Current CI candidate differs/);
  assert.equal(
    fs.existsSync(path.join(f.directory, "observed-launcher-script")),
    false,
  );
  const unknown = spawnSync(
    process.execPath,
    [...args, "--read-root", "/tmp"],
    { encoding: "utf8" },
  );
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown option/);
  const duplicate = spawnSync(
    process.execPath,
    [...args, "--candidate", f.options.candidate],
    { encoding: "utf8" },
  );
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /scope option exactly once/);
  assert.equal(
    fs.existsSync(path.join(f.directory, "observed-launcher-script")),
    false,
  );
});
