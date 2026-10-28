import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(import.meta.url);
const wrapper = fileURLToPath(
  new URL("native-diagnostics.mjs", import.meta.url),
);
const maximumObservations = 64;
const maximumIdentityBytes = 131072;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const validPID = (value) => Number.isSafeInteger(value) && value > 1;
const xcodebuild = (command) =>
  /^\/Applications\/Xcode(?:_[0-9.]+)?\.app\/Contents\/Developer\/usr\/bin\/xcodebuild$/.test(
    command,
  );

// A saved CI snapshot contained JVM -> bash -> xcodebuild while the original
// native stop was pending. Its argv was missing. Select that exact ownership
// shape; this does not identify which operation the launcher is performing.
export function ownedLauncherBranch(table, testPID, ownerPID) {
  if (!validPID(testPID) || !validPID(ownerPID)) return undefined;
  const rows = table.split("\n").flatMap((line) => {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/,
    );
    return match
      ? [
          {
            pid: Number(match[1]),
            parent: Number(match[2]),
            executable: match[3],
          },
        ]
      : [];
  });
  if (new Set(rows.map((row) => row.pid)).size !== rows.length)
    return undefined;
  const test = rows.find(
    (row) =>
      row.pid === testPID &&
      row.parent === ownerPID &&
      path.basename(row.executable) === "java",
  );
  if (!test) return undefined;
  const branches = [];
  for (const launcher of rows.filter(
    (row) =>
      validPID(row.pid) &&
      row.parent === testPID &&
      row.executable === "/bin/bash",
  )) {
    const children = rows.filter(
      (row) =>
        validPID(row.pid) &&
        row.parent === launcher.pid &&
        xcodebuild(row.executable),
    );
    if (children.length === 1)
      branches.push({ test, launcher, child: children[0] });
    else if (children.length > 1) return undefined;
  }
  if (branches.length !== 1) return undefined;
  const branch = branches[0];
  return new Set([
    ownerPID,
    branch.test.pid,
    branch.launcher.pid,
    branch.child.pid,
  ]).size === 4
    ? branch
    : undefined;
}

function elapsedSeconds(value) {
  const match = value.match(/^(?:(\d+)-)?(?:(\d+):)?(\d{2}):(\d{2})$/);
  if (
    !match ||
    Number(match[3]) >= 60 ||
    Number(match[4]) >= 60 ||
    (match[1] && (match[2] === undefined || Number(match[2]) >= 24))
  )
    return undefined;
  const seconds =
    Number(match[1] || 0) * 86400 +
    Number(match[2] || 0) * 3600 +
    Number(match[3]) * 60 +
    Number(match[4]);
  return Number.isSafeInteger(seconds) ? seconds : undefined;
}

export function ownedLauncherIdentity(details, branch, uid) {
  const lines = details.split("\n").filter((line) => line.trim());
  if (lines.length !== 3 || !Number.isInteger(uid) || uid < 0) return undefined;
  const rows = lines.map((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+([^\n]+)$/);
    if (!match) return undefined;
    return {
      pid: Number(match[1]),
      parent: Number(match[2]),
      uid: Number(match[3]),
      elapsedSeconds: elapsedSeconds(match[4]),
      command: match[5],
    };
  });
  if (
    rows.some((row) => !row) ||
    new Set(rows.map((row) => row.pid)).size !== 3
  )
    return undefined;
  const result = {};
  for (const role of ["test", "launcher", "child"]) {
    const expected = branch[role];
    const row = rows.find((candidate) => candidate.pid === expected.pid);
    if (
      !row ||
      row.parent !== expected.parent ||
      row.uid !== uid ||
      row.elapsedSeconds === undefined ||
      !(
        row.command === expected.executable ||
        row.command.startsWith(expected.executable + " ")
      )
    )
      return undefined;
    result[role] = { ...row, executable: expected.executable };
  }
  return result;
}

export function createLauncherObserver({
  directory,
  device,
  capture,
  log,
  ownerPID = process.pid,
  uid = process.getuid(),
}) {
  const report = {
    version: 1,
    enabled: true,
    ownerPID,
    uid,
    device,
    nodeVersion: process.version,
    scope:
      "Passive host launcher identities only; operation association and blocking cause are unclassified.",
    sourceHashes: {},
    snapshotsObserved: 0,
    observations: [],
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
  };
  const sources = path.join(directory, "native-launcher-source");
  mkdirSync(sources);
  for (const file of [source, wrapper]) {
    const bytes = readFileSync(file);
    const name = path.basename(file);
    report.sourceHashes[name] = sha(bytes);
    writeFileSync(path.join(sources, name), bytes, { flag: "wx" });
  }
  const file = path.join(directory, "native-launcher-observation.json");
  const write = () =>
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  const seen = new Set();
  write();
  return {
    async observe(table, testPID) {
      report.snapshotsObserved++;
      const branch = ownedLauncherBranch(table, testPID, ownerPID);
      if (!branch) {
        write();
        return;
      }
      const key = `${branch.launcher.pid}-${branch.child.pid}`;
      if (seen.has(key)) {
        write();
        return;
      }
      if (seen.size >= maximumObservations) {
        if (!report.errors.includes("Launcher observation limit exceeded"))
          report.errors.push("Launcher observation limit exceeded");
        write();
        return;
      }
      seen.add(key);
      const identityFile = `native-launcher-${key}-identity.log`;
      const command = [
        "ps",
        [
          "-p",
          [testPID, branch.launcher.pid, branch.child.pid].join(","),
          "-o",
          "pid=,ppid=,uid=,etime=,args=",
        ],
      ];
      const chunks = [];
      let bytes = 0;
      await capture(identityFile, command, 15000, (chunk) => {
        bytes += chunk.length;
        if (bytes <= maximumIdentityBytes) chunks.push(chunk);
      });
      const details = Buffer.concat(chunks);
      const identity =
        bytes <= maximumIdentityBytes
          ? ownedLauncherIdentity(details.toString(), branch, uid)
          : undefined;
      const observation = {
        at: new Date().toISOString(),
        testPID,
        identityFile,
        identityBytes: bytes,
        identitySHA256: bytes <= maximumIdentityBytes ? sha(details) : null,
        verifiedOwnership: Boolean(identity),
        ...(identity || { observedBranch: branch }),
        operationAssociation:
          "Unclassified; exact argv retained for offline review. No App state or host wait cause inferred.",
      };
      report.observations.push(observation);
      if (!identity)
        report.errors.push(`Incomplete or changed launcher identity: ${key}`);
      write();
      log(
        `Passive launcher identity ${key}: ${identity ? "verified" : "incomplete"}`,
      );
    },
  };
}

export function verifyLauncherReport(directory) {
  const report = JSON.parse(
    readFileSync(
      path.join(directory, "native-launcher-observation.json"),
      "utf8",
    ),
  );
  const fail = (message) => {
    throw new Error(message);
  };
  if (
    report.version !== 1 ||
    report.enabled !== true ||
    !validPID(report.ownerPID) ||
    !Number.isInteger(report.uid) ||
    report.uid < 0 ||
    report.nodeVersion !== "v20.19.4" ||
    !Number.isSafeInteger(report.snapshotsObserved) ||
    report.snapshotsObserved < 1 ||
    report.deviceAPICalls !== 0 ||
    report.final_stability_credit !== false ||
    !Array.isArray(report.errors) ||
    report.errors.length ||
    !Array.isArray(report.observations) ||
    report.observations.length > maximumObservations ||
    report.observations.length > report.snapshotsObserved ||
    !report.sourceHashes ||
    Object.keys(report.sourceHashes).length !== 2
  )
    fail("Invalid launcher observation report");
  for (const file of [source, wrapper]) {
    const name = path.basename(file);
    const saved = readFileSync(
      path.join(directory, "native-launcher-source", name),
    );
    if (
      sha(saved) !== report.sourceHashes[name] ||
      sha(readFileSync(file)) !== report.sourceHashes[name]
    )
      fail("Launcher source provenance differs");
  }
  const seen = new Set();
  for (const observation of report.observations) {
    const { test, launcher, child } = observation;
    if (
      !observation.verifiedOwnership ||
      !test ||
      !launcher ||
      !child ||
      test.pid !== observation.testPID ||
      test.parent !== report.ownerPID ||
      launcher.parent !== test.pid ||
      child.parent !== launcher.pid ||
      [test, launcher, child].some((row) => !validPID(row.pid)) ||
      new Set([report.ownerPID, test.pid, launcher.pid, child.pid]).size !==
        4 ||
      path.basename(test.executable) !== "java" ||
      launcher.executable !== "/bin/bash" ||
      !xcodebuild(child.executable) ||
      !Number.isInteger(observation.identityBytes) ||
      observation.identityBytes < 1 ||
      observation.identityBytes > maximumIdentityBytes ||
      observation.identityFile !==
        `native-launcher-${launcher.pid}-${child.pid}-identity.log`
    )
      fail("Launcher identity chain differs");
    if (seen.has(observation.identityFile)) fail("Duplicate launcher identity");
    seen.add(observation.identityFile);
    const identityFile = path.join(directory, observation.identityFile);
    if (statSync(identityFile).size > maximumIdentityBytes + 4096)
      fail("Launcher raw identity exceeds bounds");
    const raw = readFileSync(identityFile, "utf8");
    const command = `ps -p ${test.pid},${launcher.pid},${child.pid} -o pid=,ppid=,uid=,etime=,args=`;
    const escaped = command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const time = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";
    const match = raw.match(
      new RegExp(
        `^\\n${time} ${escaped}\\n([\\s\\S]*)\\n${time} exit=0 signal=null\\n$`,
      ),
    );
    if (
      !match ||
      Buffer.byteLength(match[1]) !== observation.identityBytes ||
      sha(match[1]) !== observation.identitySHA256
    )
      fail("Launcher raw command/exit/identity bytes differ");
    const identityRows = match[1];
    const branch = Object.fromEntries(
      ["test", "launcher", "child"].map((role) => [role, observation[role]]),
    );
    const checked = ownedLauncherIdentity(identityRows, branch, report.uid);
    if (
      !checked ||
      ["test", "launcher", "child"].some(
        (role) =>
          JSON.stringify(checked[role]) !== JSON.stringify(observation[role]),
      )
    )
      fail("Raw launcher identity differs");
  }
  return {
    version: 1,
    observations: report.observations.length,
    sourceHashes: report.sourceHashes,
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === source) {
  try {
    if (process.argv[2] !== "check" || process.argv.length !== 4)
      throw new Error(
        "Usage: ios-native-launcher-observe.mjs check <diagnostic-directory>",
      );
    console.log(JSON.stringify(verifyLauncherReport(process.argv[3])));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
