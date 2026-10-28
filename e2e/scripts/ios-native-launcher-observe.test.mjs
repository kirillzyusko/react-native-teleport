import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
const {
  createLauncherObserver,
  ownedLauncherBranch,
  ownedLauncherIdentity,
  ownedLauncherSnapshot,
  verifyLauncherReport,
} = await import(
  process.env.TELEPORT_TEST_LAUNCHER_MODULE ||
    "./ios-native-launcher-observe.mjs"
);

const xcodebuild =
  "/Applications/Xcode_16.4.app/Contents/Developer/usr/bin/xcodebuild";
const table = `11307 10628 S 0 0 100 /mock/java
12939 11307 S 0 0 100 ${xcodebuild}
30043 11307 S 0 0 100 /native/simctl
30770 11307 S 0 0 100 /bin/bash
30815 30770 R 0 0 100 ${xcodebuild}`;
const details = `11307 10628 501 00:24 /mock/java -cp fixture
30770 11307 501 00:20 /bin/bash /usr/bin/xcrun simctl terminate selected-device teleport.example
30815 30770 501 00:20 ${xcodebuild} -find simctl
`;

test("selects the observed JVM-owned shell branch instead of the long-lived SDK/log stream", () => {
  const branch = ownedLauncherBranch(table, 11307, 10628);
  assert.equal(branch.launcher.pid, 30770);
  assert.equal(branch.child.pid, 30815);
  assert.equal(branch.test.pid, 11307);
});

test("rejects ambiguous, stale, foreign, cyclic and similarly named launcher trees", () => {
  for (const changed of [
    table.replace("11307 10628", "11307 10629"),
    table.replace("30770 11307", "30770 11308"),
    table.replace("30815 30770", "30815 30771"),
    table.replace("/bin/bash", "/tmp/bash"),
    table.replaceAll(xcodebuild, "/tmp/xcodebuild"),
    table.replace("/mock/java", "/mock/not-java"),
    table.replace("30770 11307", "30770 30815"),
    `${table}\n30815 30770 R 0 0 100 ${xcodebuild}`,
    `${table}\n30816 30770 R 0 0 100 ${xcodebuild}`,
    `${table}\n30771 11307 S 0 0 100 /bin/bash\n30816 30771 R 0 0 100 ${xcodebuild}`,
  ])
    assert.equal(ownedLauncherBranch(changed, 11307, 10628), undefined);
  assert.equal(ownedLauncherBranch(table, 1, 10628), undefined);
  assert.equal(ownedLauncherBranch(table, 11307, 11307), undefined);
});

test("revalidates all three exact PIDs, parent edges, owner and full executable paths", () => {
  const branch = ownedLauncherBranch(table, 11307, 10628);
  const result = ownedLauncherIdentity(details, branch, 501);
  assert.equal(result.launcher.elapsedSeconds, 20);
  assert.equal(result.child.command, `${xcodebuild} -find simctl`);
  for (const changed of [
    details.replace("30770 11307", "30771 11307"),
    details.replace("30770 11307", "30770 11308"),
    details.replace("30815 30770", "30815 30771"),
    details.replace("30815 30770 501", "30815 30770 502"),
    details.replace("/bin/bash", "/tmp/bash"),
    details.replace("/mock/java", "/tmp/java"),
    details.replace("00:20", "00:60"),
    details.replace("00:20", "9999999999999999999999:00:01"),
    details.split("\n").slice(1).join("\n"),
    details + details.split("\n")[0] + "\n",
  ])
    assert.equal(ownedLauncherIdentity(changed, branch, 501), undefined);
  assert.equal(ownedLauncherIdentity(details, branch, 502), undefined);
});

const executableHeader = "TELEPORT_EXECUTABLE".padEnd(256, "_");
const snapshotFormat = `pid=,ppid=,uid=,etime=,comm=${executableHeader},args=`;
const row = (pid, parent, executable, command, age = "00:20") =>
  `${pid} ${parent} 501 ${age} ${executable.padEnd(256)} ${command}\n`;
const snapshot = (java = "/mock/java") =>
  executableHeader +
  "\n" +
  row(10628, 1, "/mock/node", "node wrapper.mjs", "00:30") +
  row(11307, 10628, java, `${java} -cp fixture`, "00:24") +
  row(
    30770,
    11307,
    "/bin/bash",
    "/bin/bash /usr/bin/xcrun simctl terminate selected-device teleport.example",
  ) +
  row(30815, 30770, xcodebuild, `${xcodebuild} -runFirstLaunch`);
const snapshotDetails = snapshot();

async function fixture(stdout = snapshotDetails) {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "teleport-launcher-identity-"),
  );
  const calls = [];
  const observer = createLauncherObserver({
    directory,
    device: "selected-device",
    ownerPID: 10628,
    uid: 501,
    log() {},
    async capture(file, command, timeout, observe) {
      calls.push({ file, command, timeout });
      const output =
        typeof stdout === "function" ? stdout(calls.length) : stdout;
      const raw = Buffer.from(output);
      observe(raw.subarray(0, 17));
      observe(raw.subarray(17));
      await writeFile(
        path.join(directory, file),
        `\n2026-10-28T02:36:24.000Z ${command[0]} ${command[1].join(" ")}\n${output}\n2026-10-28T02:36:24.100Z exit=0 signal=null\n`,
      );
    },
  });
  return { directory, calls, observer };
}

test("captures selection and identity from each same-output snapshot without a PID re-query", async () => {
  const { directory, calls, observer } = await fixture();
  try {
    await observer.observe(table, 11307);
    await observer.observe(table, 11307);
    assert.deepEqual(
      calls.map((call) => call.command),
      Array(2).fill(["ps", ["-A", "-o", snapshotFormat]]),
    );
    assert(calls.every((call) => call.timeout === 15000));
    const checked = verifyLauncherReport(directory);
    assert.equal(checked.version, 2);
    assert.equal(checked.snapshots, 2);
    assert.equal(checked.observations, 1);
    assert.equal(checked.deviceAPICalls, 0);
    assert.equal(checked.final_stability_credit, false);
    const file = path.join(directory, calls[0].file);
    await writeFile(
      file,
      (await readFile(file, "utf8")).replace("exit=0", "exit=17"),
    );
    assert.throws(() => verifyLauncherReport(directory), /raw command/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retains a snapshot without an owned branch without claiming absence of a wait", async () => {
  const { directory, calls, observer } = await fixture(
    snapshotDetails.split("\n").slice(0, 3).join("\n") + "\n",
  );
  try {
    await observer.observe(table, 11307);
    assert.equal(calls.length, 1);
    assert.equal(verifyLauncherReport(directory).observations, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing, malformed or oversized captured identities fail the separate diagnostic gate", async () => {
  for (const output of [
    details, // A v1 two-query identity file is not a complete v2 snapshot.
    snapshotDetails.replace("11307 10628 501", "11307 10629 501"),
    snapshotDetails.replace("30815 30770 501", "30815 30770 502"),
    snapshotDetails.replace(
      `${xcodebuild.padEnd(256)} ${xcodebuild}`,
      `${xcodebuild.padEnd(256)} /tmp/foreign`,
    ),
    snapshotDetails + "x".repeat(8 * 1024 * 1024 + 1),
    snapshotDetails.replace("-runFirstLaunch", "x".repeat(131073)),
  ]) {
    const { directory, observer } = await fixture(output);
    try {
      await observer.observe(table, 11307);
      assert.throws(
        () => verifyLauncherReport(directory),
        /Invalid launcher observation report/,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("changed provenance, parent identity or extra raw files cannot qualify", async () => {
  for (const mode of ["source", "parent", "bytes", "extra-file"]) {
    const { directory, observer } = await fixture();
    try {
      await observer.observe(table, 11307);
      const file = path.join(directory, "native-launcher-observation.json");
      const report = JSON.parse(await readFile(file, "utf8"));
      if (mode === "source")
        report.sourceHashes["native-diagnostics.mjs"] = "a".repeat(64);
      if (mode === "parent") report.observations[0].child.parent++;
      if (mode === "bytes") report.snapshots[0].bytes++;
      if (mode === "extra-file")
        await writeFile(
          path.join(directory, "native-launcher-snapshot-extra.log"),
          "extra",
        );
      await writeFile(file, JSON.stringify(report));
      assert.throws(() => verifyLauncherReport(directory));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("the observation bound stops further host queries and keeps a failed diagnostic gate", async () => {
  const { directory, calls, observer } = await fixture((index) =>
    snapshotDetails
      .replaceAll("30770", String(40000 + index * 2))
      .replaceAll("30815", String(40001 + index * 2)),
  );
  try {
    for (let i = 0; i < 67; i++) await observer.observe(table, 11307);
    assert.equal(calls.length, 65);
    const report = JSON.parse(
      await readFile(path.join(directory, "native-launcher-observation.json")),
    );
    assert.equal(report.observations.length, 64);
    assert.deepEqual(report.errors, ["Launcher observation limit exceeded"]);
    assert.throws(() => verifyLauncherReport(directory));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("selects current identities from the captured output even when the legacy table is stale", async () => {
  const { directory, calls, observer } = await fixture();
  try {
    await observer.observe("", 11307);
    const report = JSON.parse(
      await readFile(path.join(directory, "native-launcher-observation.json")),
    );
    assert.equal(report.observations.length, 1);
    assert.equal(report.observations[0].launcher.pid, 30770);
    assert.equal(report.observations[0].child.pid, 30815);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command[1][0], "-A");
    assert.equal(verifyLauncherReport(directory).observations, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("same-output parser keeps exact executable paths with spaces and rejects conflicts", () => {
  const spaced = snapshot("/mock/Java SDK/bin/java");
  assert.equal(
    ownedLauncherSnapshot(
      snapshotDetails.replace(
        row(11307, 10628, "/mock/java", "/mock/java -cp fixture", "00:24"),
        row(11307, 10628, "/bin/bash", "/bin/bash maestro-script"),
      ),
      11307,
      10628,
      501,
    ),
    undefined,
  );
  const identity = ownedLauncherSnapshot(spaced, 11307, 10628, 501);
  assert.equal(identity.test.executable, "/mock/Java SDK/bin/java");
  assert.equal(identity.child.command, `${xcodebuild} -runFirstLaunch`);
  assert.throws(
    () =>
      ownedLauncherSnapshot(
        spaced + spaced.split("\n")[1] + "\n",
        11307,
        10628,
        501,
      ),
    /Duplicate/,
  );
  assert.throws(
    () =>
      ownedLauncherSnapshot(
        spaced.replace("10628 1 501", "10628 1 502"),
        11307,
        10628,
        501,
      ),
    /wrapper identity/,
  );
  assert.equal(
    ownedLauncherSnapshot(
      spaced + row(30816, 30770, xcodebuild, `${xcodebuild} -runFirstLaunch`),
      11307,
      10628,
      501,
    ),
    undefined,
  );
});
