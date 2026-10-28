import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
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

// Darwin truncates a non-final comm column to its header width, even with -ww.
// Its explicit header fixes that width; args remains the unlimited final column.
const executableWidth = 256;
const executableHeader = "TELEPORT_EXECUTABLE".padEnd(executableWidth, "_");
const snapshotFormat = `pid=,ppid=,uid=,etime=,comm=${executableHeader},args=`;
const limits = {
  snapshotBytes: 8 * 1024 * 1024,
  totalSnapshotBytes: 32 * 1024 * 1024,
  snapshots: 512,
  observations: maximumObservations,
  identityBytes: maximumIdentityBytes,
};

// Selection and identity come from this one captured output. ps does not
// promise an atomic OS snapshot, so inconsistent matching rows still fail.
export function ownedLauncherSnapshot(text, testPID, ownerPID, uid) {
  if (!validPID(testPID) || !validPID(ownerPID) || !Number.isInteger(uid))
    throw new Error("Invalid launcher snapshot owner");
  const lines = text.split("\n").filter((line) => line.trim());
  if (lines.shift()?.trim() !== executableHeader)
    throw new Error("Launcher executable column header differs");
  const rows = lines.map((raw) => {
    const match = raw.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
    if (!match) throw new Error("Malformed launcher snapshot row");
    const tail = match[5];
    if (tail.length <= executableWidth || tail[executableWidth] !== " ")
      throw new Error("Malformed launcher executable column");
    const executable = tail.slice(0, executableWidth).trimEnd();
    return {
      pid: Number(match[1]),
      parent: Number(match[2]),
      uid: Number(match[3]),
      elapsedSeconds: elapsedSeconds(match[4]),
      executable,
      command: tail.slice(executableWidth + 1),
      raw,
    };
  });
  if (new Set(rows.map((row) => row.pid)).size !== rows.length)
    throw new Error("Duplicate launcher snapshot PID");
  const owner = rows.find((row) => row.pid === ownerPID);
  if (
    !owner ||
    owner.uid !== uid ||
    path.basename(owner.executable || "") !== "node"
  )
    throw new Error("Launcher snapshot wrapper identity differs");
  const test = rows.find((row) => row.pid === testPID);
  if (!test) return undefined; // The original test may already have exited.
  if (
    test.parent !== ownerPID ||
    test.uid !== uid ||
    test.executable.length >= executableWidth
  )
    throw new Error("Launcher snapshot JVM identity differs");
  // The original child can still be its launch script before execing Java.
  if (path.basename(test.executable) !== "java") return undefined;
  const branches = [];
  for (const launcher of rows.filter(
    (row) => row.parent === testPID && row.executable === "/bin/bash",
  )) {
    const descendants = rows.filter((row) => row.parent === launcher.pid);
    const children = descendants.filter((row) =>
      xcodebuild(row.executable || ""),
    );
    if (children.length > 1) return undefined;
    if (children.length === 1)
      branches.push({ test, launcher, child: children[0] });
  }
  if (branches.length !== 1) return undefined;
  const branch = branches[0];
  if (
    new Set([ownerPID, ...Object.values(branch).map((row) => row.pid)]).size !==
    4
  )
    throw new Error("Cyclic launcher snapshot identity");
  const result = {};
  for (const role of ["test", "launcher", "child"]) {
    const row = branch[role];
    if (
      !validPID(row.pid) ||
      row.uid !== uid ||
      row.elapsedSeconds === undefined ||
      row.executable.length >= executableWidth ||
      !(
        row.command === row.executable ||
        row.command.startsWith(row.executable + " ") ||
        (role === "test" &&
          (row.command === "java" || row.command.startsWith("java ")))
      )
    )
      throw new Error("Incomplete owned launcher snapshot identity");
    result[role] = {
      pid: row.pid,
      parent: row.parent,
      uid: row.uid,
      elapsedSeconds: row.elapsedSeconds,
      command: row.command,
      executable: row.executable,
    };
  }
  const selected =
    rows
      .filter((row) =>
        Object.values(branch).some((item) => item.pid === row.pid),
      )
      .map((row) => row.raw)
      .join("\n") + "\n";
  const bytes = Buffer.from(selected);
  if (bytes.length > limits.identityBytes)
    throw new Error("Launcher selected identity exceeds bounds");
  return { ...result, identityBytes: bytes.length, identitySHA256: sha(bytes) };
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
    version: 2,
    enabled: true,
    ownerPID,
    uid,
    device,
    nodeVersion: process.version,
    scope:
      "Selection and identity from one captured host PS output; no atomic OS snapshot or wait cause claimed.",
    sourceHashes: {},
    limits,
    snapshotsObserved: 0,
    snapshotBytes: 0,
    snapshots: [],
    observations: [],
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
  };
  const sources = path.join(directory, "native-launcher-source");
  mkdirSync(sources);
  for (const file of [source, wrapper]) {
    const bytes = readFileSync(file),
      name = path.basename(file);
    report.sourceHashes[name] = sha(bytes);
    writeFileSync(path.join(sources, name), bytes, { flag: "wx" });
  }
  const file = path.join(directory, "native-launcher-observation.json");
  const write = () =>
    writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  const seen = new Set();
  write();
  return {
    async observe(legacyProcessTable, testPID) {
      if (report.errors.length) return;
      if (typeof legacyProcessTable !== "string" || !validPID(testPID)) {
        report.errors.push("Invalid launcher snapshot request");
        write();
        return;
      }
      // The legacy table remains for its original consumers. It is deliberately
      // not used to select a branch for a later, different identity query.
      report.snapshotsObserved++;
      if (report.snapshotsObserved > limits.snapshots) {
        report.errors.push("Launcher snapshot count exceeded");
        write();
        return;
      }
      const name = `native-launcher-snapshot-${String(report.snapshotsObserved).padStart(6, "0")}.log`;
      const chunks = [];
      let bytes = 0;
      await capture(
        name,
        ["ps", ["-A", "-o", snapshotFormat]],
        15000,
        (chunk) => {
          bytes += chunk.length;
          if (bytes <= limits.snapshotBytes) chunks.push(chunk);
        },
      );
      report.snapshotBytes += bytes;
      const raw = Buffer.concat(chunks);
      const snapshot = {
        index: report.snapshotsObserved,
        file: name,
        testPID,
        bytes,
        SHA256: bytes <= limits.snapshotBytes ? sha(raw) : null,
      };
      report.snapshots.push(snapshot);
      try {
        if (
          bytes > limits.snapshotBytes ||
          report.snapshotBytes > limits.totalSnapshotBytes
        )
          throw new Error("Launcher snapshot byte bound exceeded");
        const identity = ownedLauncherSnapshot(
          raw.toString(),
          testPID,
          ownerPID,
          uid,
        );
        if (identity) {
          const key = `${identity.launcher.pid}-${identity.child.pid}`;
          if (!seen.has(key)) {
            if (seen.size >= limits.observations)
              throw new Error("Launcher observation limit exceeded");
            seen.add(key);
            report.observations.push({
              snapshotIndex: snapshot.index,
              verifiedOwnership: true,
              ...identity,
              operationAssociation:
                "Exact current argv retained; App state and wait cause unclassified.",
            });
          }
        }
      } catch (error) {
        report.errors.push(error.message);
      }
      write();
      log(
        `Passive launcher snapshot ${snapshot.index}: ${report.errors.length ? "invalid" : "preserved"}`,
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
    report.version !== 2 ||
    report.enabled !== true ||
    !validPID(report.ownerPID) ||
    !Number.isInteger(report.uid) ||
    report.uid < 0 ||
    report.nodeVersion !== "v20.19.4" ||
    !Number.isSafeInteger(report.snapshotsObserved) ||
    report.snapshotsObserved < 1 ||
    report.snapshotsObserved > limits.snapshots ||
    report.deviceAPICalls !== 0 ||
    report.final_stability_credit !== false ||
    JSON.stringify(report.limits) !== JSON.stringify(limits) ||
    !Array.isArray(report.errors) ||
    report.errors.length ||
    !Array.isArray(report.snapshots) ||
    report.snapshots.length !== report.snapshotsObserved ||
    !Array.isArray(report.observations) ||
    report.observations.length > limits.observations ||
    !report.sourceHashes ||
    Object.keys(report.sourceHashes).length !== 2
  )
    fail("Invalid launcher observation report");
  for (const file of [source, wrapper]) {
    const name = path.basename(file),
      saved = readFileSync(
        path.join(directory, "native-launcher-source", name),
      );
    if (
      sha(saved) !== report.sourceHashes[name] ||
      sha(readFileSync(file)) !== report.sourceHashes[name]
    )
      fail("Launcher source provenance differs");
  }
  const seen = new Set(),
    expected = [],
    files = new Set();
  let total = 0;
  for (let i = 0; i < report.snapshots.length; i++) {
    const snapshot = report.snapshots[i];
    const name = `native-launcher-snapshot-${String(i + 1).padStart(6, "0")}.log`;
    if (
      snapshot.index !== i + 1 ||
      snapshot.file !== name ||
      !validPID(snapshot.testPID) ||
      !Number.isSafeInteger(snapshot.bytes) ||
      snapshot.bytes < 1 ||
      snapshot.bytes > limits.snapshotBytes
    )
      fail("Launcher snapshot identity/bounds differ");
    files.add(name);
    const file = path.join(directory, name);
    if (statSync(file).size > limits.snapshotBytes + 4096)
      fail("Launcher raw snapshot exceeds bounds");
    const raw = readFileSync(file, "utf8"),
      time = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z";
    const command = `ps -A -o ${snapshotFormat}`;
    const match = raw.match(
      new RegExp(
        `^\\n${time} ${command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n([\\s\\S]*)\\n${time} exit=0 signal=null\\n$`,
      ),
    );
    if (
      !match ||
      Buffer.byteLength(match[1]) !== snapshot.bytes ||
      sha(match[1]) !== snapshot.SHA256
    )
      fail("Launcher raw command/exit/snapshot bytes differ");
    total += snapshot.bytes;
    const identity = ownedLauncherSnapshot(
      match[1],
      snapshot.testPID,
      report.ownerPID,
      report.uid,
    );
    if (identity) {
      const key = `${identity.launcher.pid}-${identity.child.pid}`;
      if (!seen.has(key)) {
        seen.add(key);
        expected.push({
          snapshotIndex: snapshot.index,
          verifiedOwnership: true,
          ...identity,
          operationAssociation:
            "Exact current argv retained; App state and wait cause unclassified.",
        });
      }
    }
  }
  const actualFiles = readdirSync(directory).filter((name) =>
    /^native-launcher-snapshot-.*\.log$/.test(name),
  );
  if (
    actualFiles.length !== files.size ||
    actualFiles.some((name) => !files.has(name))
  )
    fail("Unexpected launcher snapshot file");
  if (
    total !== report.snapshotBytes ||
    total > limits.totalSnapshotBytes ||
    JSON.stringify(expected) !== JSON.stringify(report.observations)
  )
    fail("Launcher same-snapshot observations differ");
  return {
    version: 2,
    snapshots: report.snapshots.length,
    observations: expected.length,
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
