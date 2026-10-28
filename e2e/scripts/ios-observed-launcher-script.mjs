import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs, TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import { verifyLauncherReport } from "./ios-native-launcher-observe.mjs";

const source = fileURLToPath(import.meta.url);
const sourceNames = [
  "ios-observed-launcher-script.mjs",
  "ios-observed-launcher-script.test.mjs",
];
const folderName = "observed-launcher-script";
export const scriptLimits = { files: 1, scriptBytes: 131072 };
const profileName = "indigo-visual-touch-trace";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ensure = (value, message) => {
  if (!value) throw new Error(message);
};
const limitation =
  "Post-test content at an observed path, not an exec inode, historical file contents, branch duration, native wait cause or display/capture proof. No file is executed and no device API or new process query is used.";

function scope({ candidate, attempt, device, profile }) {
  ensure(profile === profileName, "Launcher script profile differs");
  ensure(/^[a-f0-9]{40}$/.test(candidate), "Expected exact candidate SHA");
  ensure(attempt === 1, "Only an original attempt is supported");
  ensure(
    /^[A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12}$/.test(device),
    "Expected exact selected device identity",
  );
  ensure(process.version === "v20.19.4", "Expected project Node20.19.4");
}

function identity(stat) {
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    mode: Number(stat.mode),
    uid: Number(stat.uid),
    gid: Number(stat.gid),
    bytes: Number(stat.size),
    links: Number(stat.nlink),
    mtimeNs: String(stat.mtimeNs),
    ctimeNs: String(stat.ctimeNs),
  };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function parents(file, lstat = lstatSync) {
  const result = [];
  let current = path.dirname(file);
  while (true) {
    const stat = lstat(current, { bigint: true });
    ensure(
      stat.isDirectory() && !stat.isSymbolicLink(),
      "Linked launcher parent",
    );
    result.push([current, String(stat.dev), String(stat.ino)]);
    const next = path.dirname(current);
    if (next === current) return result;
    current = next;
  }
}

// Read once through a bounded regular descriptor. These reads happen only after
// the original test and log drain. The source path is never executed.
export function readBoundedRegular(
  file,
  maximum,
  io = { lstatSync, fstatSync, openSync, readSync, closeSync },
) {
  const absolute = path.resolve(file);
  const chain = parents(absolute, io.lstatSync);
  const stat = io.lstatSync(absolute, { bigint: true });
  ensure(
    stat.isFile() &&
      !stat.isSymbolicLink() &&
      stat.nlink === 1n &&
      stat.size > 0n &&
      stat.size <= BigInt(maximum),
    "Launcher file type, links or byte bound differs",
  );
  const expected = identity(stat);
  const began = {
    monotonicNs: String(process.hrtime.bigint()),
    wallTimeMs: Date.now(),
  };
  const fd = io.openSync(
    absolute,
    constants.O_RDONLY + constants.O_NOFOLLOW + constants.O_NONBLOCK,
  );
  try {
    ensure(
      same(identity(io.fstatSync(fd, { bigint: true })), expected),
      "Launcher descriptor identity changed",
    );
    const bytes = Buffer.alloc(expected.bytes + 1);
    let total = 0;
    while (total < bytes.length) {
      const count = io.readSync(fd, bytes, total, bytes.length - total, total);
      if (count === 0) break;
      total += count;
    }
    ensure(total === expected.bytes, "Incomplete or growing launcher file");
    const after = io.lstatSync(absolute, { bigint: true });
    ensure(
      after.isFile() &&
        !after.isSymbolicLink() &&
        same(identity(after), expected) &&
        same(identity(io.fstatSync(fd, { bigint: true })), expected) &&
        same(parents(absolute, io.lstatSync), chain),
      "Launcher file identity changed during read",
    );
    return {
      bytes: bytes.subarray(0, total),
      identity: expected,
      readBegin: began,
      readEnd: {
        monotonicNs: String(process.hrtime.bigint()),
        wallTimeMs: Date.now(),
      },
    };
  } finally {
    io.closeSync(fd);
  }
}

function launcherInput(directory, device) {
  const file = path.join(directory, "native-launcher-observation.json");
  const before = readBoundedRegular(file, 16 * 1024 * 1024);
  const proof = verifyLauncherReport(directory);
  const after = readBoundedRegular(file, 16 * 1024 * 1024);
  ensure(
    before.bytes.equals(after.bytes) && same(before.identity, after.identity),
    "Launcher input changed during validation",
  );
  const report = JSON.parse(after.bytes.toString("utf8"));
  ensure(
    report.device === device && report.nodeVersion === process.version,
    "Launcher input device or Node differs",
  );
  return { report, proof, SHA256: sha(after.bytes) };
}

export function selectedScripts(report) {
  const selections = [];
  for (const observation of report.observations) {
    const { test, launcher, child, snapshotIndex } = observation;
    const executable = child.executable;
    ensure(
      /^\/Applications\/Xcode(?:_[0-9.]+)?\.app\/Contents\/Developer\/usr\/bin\/xcodebuild$/.test(
        executable,
      ),
      "Observed Xcode executable path differs",
    );
    const scriptPath = path.join(path.dirname(executable), "simctl");
    // Other already-qualified bash branches remain outside this file scope.
    // They are retained in the original v2 report, never treated as no wait.
    if (!launcher.command.startsWith(`/bin/bash ${scriptPath} `)) continue;
    ensure(
      child.command === `${executable} -runFirstLaunch`,
      "Observed bootstrap command differs",
    );
    ensure(
      launcher.executable === "/bin/bash" &&
        launcher.parent === test.pid &&
        child.parent === launcher.pid &&
        test.parent === report.ownerPID &&
        [test, launcher, child].every((r) => r.uid === report.uid) &&
        new Set([report.ownerPID, test.pid, launcher.pid, child.pid]).size ===
          4 &&
        Number.isSafeInteger(snapshotIndex) &&
        snapshotIndex > 0,
      "Observed launcher ownership differs",
    );
    selections.push({
      snapshotIndex,
      testPID: test.pid,
      launcherPID: launcher.pid,
      childPID: child.pid,
      identitySHA256: observation.identitySHA256,
      scriptPath,
      launcherCommand: launcher.command,
      childCommand: child.command,
    });
  }
  ensure(
    new Set(selections.map((s) => s.scriptPath)).size <= scriptLimits.files,
    "More than one observed Xcode script path",
  );
  return selections;
}

function scriptBytes(bytes) {
  ensure(
    bytes.length > 0 && bytes.length <= scriptLimits.scriptBytes,
    "Script byte bound differs",
  );
  ensure(
    bytes.subarray(0, 2).equals(Buffer.from("#!")),
    "Script does not begin with a shell header",
  );
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  ensure(
    !text.includes("\0") && /^#![^\r\n]*\b(?:ba)?sh(?:\s|\r?\n)/.test(text),
    "Observed launcher is not a complete UTF8 shell script",
  );
}

function sourceProof(directory) {
  const hashes = {};
  mkdirSync(directory);
  for (const name of sourceNames) {
    const bytes = readFileSync(path.join(path.dirname(source), name));
    ensure(
      bytes.length > 0 && bytes.length <= scriptLimits.scriptBytes,
      "Collector source byte bound differs",
    );
    hashes[name] = sha(bytes);
    writeFileSync(path.join(directory, name), bytes, {
      flag: "wx",
      mode: 0o600,
    });
  }
  return hashes;
}

export function collectLauncherScript(
  options,
  readScript = readBoundedRegular,
) {
  if (options.profile !== profileName)
    return { enabled: false, deviceAPICalls: 0, fileReads: 0 };
  scope(options);
  const directory = path.resolve(options.directory);
  const output = path.join(directory, folderName);
  mkdirSync(output); // Never overwrite or repair an earlier collection.
  const report = {
    version: 1,
    enabled: true,
    candidate: options.candidate,
    attempt: options.attempt,
    device: options.device,
    profile: options.profile,
    nodeVersion: process.version,
    phase: "after-original-test-and-log-drain",
    limits: scriptLimits,
    sourceHashes: {},
    launcherInputSHA256: null,
    launcherProof: null,
    selections: [],
    files: [],
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
    limitation,
  };
  try {
    report.sourceHashes = sourceProof(path.join(output, "source"));
    const input = launcherInput(directory, options.device);
    report.launcherInputSHA256 = input.SHA256;
    report.launcherProof = input.proof;
    report.selections = selectedScripts(input.report);
    if (report.selections.length) {
      const observedPath = report.selections[0].scriptPath;
      const result = readScript(observedPath, scriptLimits.scriptBytes);
      const name = "simctl.script";
      writeFileSync(path.join(output, name), result.bytes, {
        flag: "wx",
        mode: 0o600,
      });
      report.files.push({
        file: name,
        observedPath,
        bytes: result.bytes.length,
        SHA256: sha(result.bytes),
        identity: result.identity,
        readBegin: result.readBegin,
        readEnd: result.readEnd,
      });
      // Preserve bounded descriptor-read bytes before classifying their format.
      // A malformed script still fails the diagnostic and is never executed.
      scriptBytes(result.bytes);
    }
  } catch (error) {
    report.errors.push(error.message);
  }
  writeFileSync(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
  return report;
}

export function verifyLauncherScript(options) {
  scope(options);
  const directory = path.resolve(options.directory);
  const output = path.join(directory, folderName);
  const reportBytes = readBoundedRegular(
    path.join(output, "report.json"),
    1024 * 1024,
  ).bytes;
  const report = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(reportBytes),
  );
  ensure(
    reportBytes.equals(Buffer.from(JSON.stringify(report, null, 2) + "\n")),
    "Noncanonical or duplicate script report fields",
  );
  ensure(
    same(
      Object.keys(report).sort(),
      [
        "version",
        "enabled",
        "candidate",
        "attempt",
        "device",
        "profile",
        "nodeVersion",
        "phase",
        "limits",
        "sourceHashes",
        "launcherInputSHA256",
        "launcherProof",
        "selections",
        "files",
        "errors",
        "deviceAPICalls",
        "final_stability_credit",
        "limitation",
      ].sort(),
    ),
    "Script report fields differ",
  );
  ensure(
    report.version === 1 &&
      report.enabled === true &&
      report.candidate === options.candidate &&
      report.attempt === options.attempt &&
      report.device === options.device &&
      report.profile === options.profile &&
      report.nodeVersion === process.version &&
      report.phase === "after-original-test-and-log-drain" &&
      same(report.limits, scriptLimits) &&
      same(report.errors, []) &&
      report.deviceAPICalls === 0 &&
      report.final_stability_credit === false &&
      report.limitation === limitation,
    "Observed script scope or failed collection differs",
  );
  const input = launcherInput(directory, options.device);
  const selections = selectedScripts(input.report);
  ensure(
    report.launcherInputSHA256 === input.SHA256 &&
      same(report.launcherProof, input.proof) &&
      same(report.selections, selections),
    "Observed script raw selection differs",
  );
  ensure(
    report.sourceHashes &&
      Object.keys(report.sourceHashes).length === sourceNames.length,
    "Collector source coverage differs",
  );
  for (const name of sourceNames) {
    const saved = readBoundedRegular(
      path.join(output, "source", name),
      scriptLimits.scriptBytes,
    ).bytes;
    ensure(
      sha(saved) === report.sourceHashes[name] &&
        sha(readFileSync(path.join(path.dirname(source), name))) ===
          report.sourceHashes[name],
      "Collector source provenance differs",
    );
  }
  ensure(
    same(
      readdirSync(path.join(output, "source")).sort(),
      [...sourceNames].sort(),
    ),
    "Extra collector source file",
  );
  ensure(
    Array.isArray(report.files) &&
      report.files.length === (selections.length ? 1 : 0),
    "Missing or duplicate observed script",
  );
  if (selections.length) {
    const row = report.files[0];
    ensure(
      row.file === "simctl.script" &&
        row.observedPath === selections[0].scriptPath,
      "Observed script path differs",
    );
    const bytes = readBoundedRegular(
      path.join(output, row.file),
      scriptLimits.scriptBytes,
    ).bytes;
    scriptBytes(bytes);
    const id = row.identity;
    ensure(
      same(
        Object.keys(row).sort(),
        [
          "file",
          "observedPath",
          "bytes",
          "SHA256",
          "identity",
          "readBegin",
          "readEnd",
        ].sort(),
      ) &&
        id &&
        same(
          Object.keys(id).sort(),
          [
            "device",
            "inode",
            "mode",
            "uid",
            "gid",
            "bytes",
            "links",
            "mtimeNs",
            "ctimeNs",
          ].sort(),
        ),
      "Script descriptor fields differ",
    );
    ensure(
      row.bytes === bytes.length &&
        row.SHA256 === sha(bytes) &&
        id &&
        id.bytes === bytes.length &&
        id.links === 1 &&
        Number.isSafeInteger(id.mode) &&
        id.mode >= 0o100000 &&
        id.mode <= 0o107777 &&
        [id.device, id.inode, id.mtimeNs, id.ctimeNs].every(
          (n) => typeof n === "string" && /^\d+$/.test(n),
        ) &&
        Number.isSafeInteger(id.uid) &&
        id.uid >= 0 &&
        Number.isSafeInteger(id.gid) &&
        id.gid >= 0,
      "Observed script bytes or descriptor evidence differs",
    );
    ensure(
      row.readBegin &&
        row.readEnd &&
        [row.readBegin, row.readEnd].every((r) =>
          same(Object.keys(r).sort(), ["monotonicNs", "wallTimeMs"].sort()),
        ) &&
        [row.readBegin.monotonicNs, row.readEnd.monotonicNs].every(
          (n) => typeof n === "string" && /^\d+$/.test(n),
        ) &&
        BigInt(row.readBegin.monotonicNs) <= BigInt(row.readEnd.monotonicNs) &&
        Number.isSafeInteger(row.readBegin.wallTimeMs) &&
        row.readBegin.wallTimeMs > 0 &&
        Number.isSafeInteger(row.readEnd.wallTimeMs) &&
        row.readEnd.wallTimeMs >= row.readBegin.wallTimeMs,
      "Observed script read clocks differ",
    );
  }
  ensure(
    same(
      readdirSync(output).sort(),
      [
        "report.json",
        "source",
        ...(selections.length ? ["simctl.script"] : []),
      ].sort(),
    ),
    "Extra observed script artifact file",
  );
  return {
    version: 1,
    candidate: options.candidate,
    attempt: options.attempt,
    observations: selections.length,
    scripts: report.files.length,
    sourceHashes: report.sourceHashes,
    errors: [],
    deviceAPICalls: 0,
    final_stability_credit: false,
    limitation,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === source) {
  try {
    const mode = process.argv[2];
    ensure(mode === "collect" || mode === "check", "Expected collect or check");
    const { values, tokens } = parseArgs({
      args: process.argv.slice(3),
      options: {
        directory: { type: "string" },
        candidate: { type: "string" },
        attempt: { type: "string" },
        device: { type: "string" },
        profile: { type: "string" },
      },
      strict: true,
      tokens: true,
      allowPositionals: false,
    });
    ensure(
      tokens.length === 5 &&
        new Set(tokens.map((t) => t.name)).size === 5 &&
        values.attempt === "1",
      "Expected each original scope option exactly once",
    );
    ensure(
      !process.env.GITHUB_SHA || values.candidate === process.env.GITHUB_SHA,
      "Current CI candidate differs",
    );
    ensure(
      !process.env.GITHUB_RUN_ATTEMPT ||
        values.attempt === process.env.GITHUB_RUN_ATTEMPT,
      "Current CI attempt differs",
    );
    const options = { ...values, attempt: Number(values.attempt) };
    const report =
      mode === "collect"
        ? collectLauncherScript(options)
        : verifyLauncherScript(options);
    console.log(JSON.stringify(report));
    ensure(
      !report.errors?.length,
      "Observed launcher script collection failed",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
