// These calls run only after the first SDK click has returned, while its package
// still exists. AndroidDriver.close may uninstall it before final diagnostics.
export function nativeClickLine(line) {
  const match = line.match(/\bMaestroNativeInput\s*:\s*(\{.*\})\s*$/);
  if (!match) return undefined;
  const value = JSON.parse(match[1]);
  if (
    value.phase !== "native.click.complete" ||
    !Number.isInteger(value.x) ||
    !Number.isInteger(value.y) ||
    typeof value.accepted !== "boolean" ||
    !Number.isSafeInteger(value.completedUptimeMs) ||
    value.completedUptimeMs < 0
  )
    throw new Error("Invalid native click record");
  return value;
}

function packagePath(output) {
  const lines = output.trim().split(/\r?\n/);
  if (
    lines.length !== 1 ||
    !/^package:\/data\/app\/[A-Za-z0-9_./=+~-]+\/base\.apk$/.test(lines[0]) ||
    lines[0].includes("/../")
  )
    throw new Error("Expected one installed SDK server base APK");
  return lines[0].slice("package:".length);
}

export async function installedSDKIdentity(device, read) {
  if (!/^emulator-\d+$/.test(device))
    throw new Error("Expected selected emulator");
  const query = ["shell", "pm", "path", "dev.mobile.maestro.test"];
  const before = packagePath(await read(query));
  const output = await read(["shell", "sha256sum", before]);
  const match = output.trim().match(/^([a-f0-9]{64})\s+(.+)$/);
  if (!match || match[2] !== before)
    throw new Error("Installed SDK hash missing");
  const after = packagePath(await read(query));
  if (before !== after)
    throw new Error("Installed SDK path changed during capture");
  return {
    device,
    package: "dev.mobile.maestro.test",
    path: before,
    sha256: match[1],
  };
}
