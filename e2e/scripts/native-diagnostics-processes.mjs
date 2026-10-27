import path from "node:path";

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
