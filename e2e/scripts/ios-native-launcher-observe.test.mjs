import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createLauncherObserver,
  ownedLauncherBranch,
  ownedLauncherIdentity,
  verifyLauncherReport,
} from "./ios-native-launcher-observe.mjs";

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

async function fixture(stdout = details) {
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
      const output = typeof stdout === "function" ? stdout(command) : stdout;
      const raw = Buffer.from(output);
      // Split an arbitrary boundary to exercise the original chunk stream.
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

test("captures one bounded combined host identity per observed branch and checks exact raw provenance", async () => {
  const { directory, calls, observer } = await fixture();
  try {
    await observer.observe(table, 11307);
    await observer.observe(table, 11307);
    assert.deepEqual(
      calls.map((call) => call.command),
      [
        [
          "ps",
          ["-p", "11307,30770,30815", "-o", "pid=,ppid=,uid=,etime=,args="],
        ],
      ],
    );
    assert.equal(calls[0].timeout, 15000);
    const checked = verifyLauncherReport(directory);
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

test("no complete owned branch performs no extra host query and makes no absence-of-wait claim", async () => {
  const { directory, calls, observer } = await fixture();
  try {
    await observer.observe(table.replace("/bin/bash", "/tmp/bash"), 11307);
    assert.equal(calls.length, 0);
    assert.equal(verifyLauncherReport(directory).observations, 0);
    const report = JSON.parse(
      await readFile(
        path.join(directory, "native-launcher-observation.json"),
        "utf8",
      ),
    );
    assert.match(report.scope, /unclassified/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing, malformed or oversized host identities fail the separate diagnostic gate", async () => {
  for (const stdout of [
    details.split("\n").slice(1).join("\n"),
    details + "foreign row\n",
    "x".repeat(131073),
  ]) {
    const { directory, observer } = await fixture(stdout);
    try {
      await observer.observe(table, 11307);
      const report = JSON.parse(
        await readFile(
          path.join(directory, "native-launcher-observation.json"),
          "utf8",
        ),
      );
      assert.equal(report.errors.length, 1);
      assert.equal(report.observations[0].verifiedOwnership, false);
      assert.throws(() => verifyLauncherReport(directory), /Invalid launcher/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("changed provenance, parent identity or extra raw bytes cannot qualify", async () => {
  const { directory, observer, calls } = await fixture();
  try {
    await observer.observe(table, 11307);
    const reportFile = path.join(directory, "native-launcher-observation.json");
    const original = await readFile(reportFile, "utf8");
    const report = JSON.parse(original);
    report.observations[0].launcher.parent++;
    await writeFile(reportFile, JSON.stringify(report));
    assert.throws(() => verifyLauncherReport(directory), /identity chain/);
    await writeFile(reportFile, original);
    const raw = await readFile(path.join(directory, calls[0].file), "utf8");
    await writeFile(
      path.join(directory, calls[0].file),
      raw + "unclassified extra bytes\n",
    );
    assert.throws(() => verifyLauncherReport(directory), /raw command/);
    await writeFile(path.join(directory, calls[0].file), raw);
    await writeFile(
      path.join(directory, "native-launcher-source", "native-diagnostics.mjs"),
      "changed",
    );
    assert.throws(() => verifyLauncherReport(directory), /source provenance/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the observation bound stops further host queries and keeps a failed diagnostic gate", async () => {
  const { directory, observer, calls } = await fixture((command) => {
    const [, root, child] = command[1][1].split(",");
    return details.replaceAll("30770", root).replaceAll("30815", child);
  });
  try {
    for (let i = 0; i < 65; i++) {
      await observer.observe(
        table
          .replaceAll("30770", String(40000 + i))
          .replaceAll("30815", String(50000 + i)),
        11307,
      );
    }
    const report = JSON.parse(
      await readFile(
        path.join(directory, "native-launcher-observation.json"),
        "utf8",
      ),
    );
    assert.equal(calls.length, 64);
    assert.equal(report.observations.length, 64);
    assert.deepEqual(report.errors, ["Launcher observation limit exceeded"]);
    assert.throws(() => verifyLauncherReport(directory), /Invalid launcher/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
