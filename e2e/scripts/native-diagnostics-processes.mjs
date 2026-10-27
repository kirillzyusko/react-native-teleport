import path from "node:path";

// ps reports elapsed process time independently of our polling interval. A
// 33-second client was missed when two nominal 15-second observations were
// only 14.831 seconds apart after the other diagnostic commands finished.
export function ownedSimctlAge(details, pid, parentPid) {
  for (const line of details.split("\n")) {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+(?:(\d+)-)?(?:(\d+):)?(\d{2}):(\d{2})\s+(\S+)\s+(privacy|terminate|launch)\b/,
    );
    if (
      match &&
      Number(match[1]) === pid &&
      Number(match[2]) === parentPid &&
      path.basename(match[7]) === "simctl" &&
      Number(match[5]) < 60 &&
      Number(match[6]) < 60 &&
      (!match[3] || (match[4] !== undefined && Number(match[4]) < 24))
    ) {
      return (
        Number(match[3] || 0) * 86400 +
        Number(match[4] || 0) * 3600 +
        Number(match[5]) * 60 +
        Number(match[6])
      );
    }
  }
  return undefined;
}

function processes(table) {
  return table.split("\n").flatMap((line) => {
    const match = line.match(
      /^\s*(\d+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/,
    );
    return match
      ? [{ pid: Number(match[1]), parent: Number(match[2]), command: match[3] }]
      : [];
  });
}

export function uniqueHostedSimLaunchHost(table, hosted) {
  if (!hosted) return undefined;
  const candidates = processes(table).filter(
    ({ pid, command }) =>
      pid > 1 &&
      /^\/Library\/Developer\/PrivateFrameworks\/CoreSimulator\.framework\/(?:Versions\/[^/]+\/)?XPCServices\/SimLaunchHost\.(arm64|x86_64)\.xpc\/Contents\/MacOS\/SimLaunchHost\.\1$/.test(
        command,
      ),
  );
  if (candidates.length !== 1) return undefined;
  const { pid, command } = candidates[0];
  return { pid, command };
}

// The log stream identifies daemons inside the selected simulator. Match those
// exact PIDs and runtime executables, then follow their direct parent. A global
// launchd_sim name search could select a different simulator.
export function selectedHostedLaunchd(table, scopedPids, hosted) {
  if (!hosted) return undefined;
  const rows = processes(table);
  const candidates = [];
  for (const name of ["testmanagerd", "runningboardd"]) {
    const child = rows.find(
      (row) =>
        row.pid === Number(scopedPids.get(name)) &&
        row.command.includes(".simruntime/Contents/Resources/RuntimeRoot/") &&
        path.basename(row.command) === name,
    );
    if (!child) continue;
    const parent = rows.find(
      (row) => row.pid === child.parent && row.command === "launchd_sim",
    );
    if (parent && parent.pid > 1) {
      candidates.push({
        pid: parent.pid,
        command: parent.command,
        childPid: child.pid,
        childCommand: child.command,
      });
    }
  }
  if (!candidates.length || new Set(candidates.map((p) => p.pid)).size !== 1)
    return undefined;
  return candidates[0];
}

export function sameOwnerProcess(details, expected, uid) {
  return details.split("\n").some((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
    return (
      match &&
      Number(match[1]) === expected.pid &&
      Number(match[2]) === uid &&
      match[3] === expected.command
    );
  });
}

// A hosted CI guest belongs to this job. Do not select a global service on a
// developer's machine or guess between several service processes.
export function uniqueHostedCoreSimulatorService(processTable, hosted) {
  if (!hosted) return undefined;
  const services = [];
  for (const line of processTable.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+\d+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/);
    if (
      match &&
      Number(match[1]) > 1 &&
      match[2].startsWith(
        "/Library/Developer/PrivateFrameworks/CoreSimulator.framework/",
      ) &&
      path.basename(match[2]) === "com.apple.CoreSimulator.CoreSimulatorService"
    ) {
      services.push({ pid: Number(match[1]), command: match[2] });
    }
  }
  return services.length === 1 ? services[0] : undefined;
}
