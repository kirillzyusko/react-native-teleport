import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { activeTouchCancellations } from "./check-ios-touch-cancellations.mjs";

export function checkHIDDelivery(
  records,
  simulatorLog,
  minimum = 100,
  xctestLog = "",
) {
  const errors = [];
  const native = records
    .filter((r) => r.type === "native")
    .map((r) => r.message);
  const ready = native.filter((r) => r.type === "ready");
  const bridge = records.filter((r) => r.type === "bridge-ready");
  const requests = records.filter((r) => r.type === "request");
  const delivered = native.filter((r) => r.type === "delivered");
  const routed = [
    ...xctestLog.matchAll(
      /\[FlyingFox\].*request: POST \/(touch|swipe)(?:V2)?\s*$/gm,
    ),
  ].map((m) => m[1]);
  const routeCounts = Object.fromEntries(
    ["touch", "swipe"].map((kind) => [
      kind,
      routed.filter((v) => v === kind).length,
    ]),
  );
  const gestureCounts = Object.fromEntries(
    ["touch", "swipe"].map((kind) => [
      kind,
      requests.filter((r) => r.gesture.kind === kind).length,
    ]),
  );
  if (!gestureCounts.touch || !gestureCounts.swipe)
    errors.push(
      "Both touch and swipe delivery are required for the original full suite",
    );
  if (
    routed.length !== requests.length ||
    routed.some((kind, i) => requests[i]?.gesture.kind !== kind)
  )
    errors.push(
      "XCTest touch/swipe routes do not correspond to native requests",
    );
  const cancelled = activeTouchCancellations(simulatorLog);
  if (cancelled.length)
    errors.push(
      "Active contact cancellation recorded, including non-Recap senders",
    );
  const identity = ready[0];
  const geometry =
    identity &&
    Array.isArray(identity.pixels) &&
    identity.pixels.length === 2 &&
    identity.pixels.every(
      (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
    ) &&
    typeof identity.scale === "number" &&
    Number.isFinite(identity.scale) &&
    identity.scale > 0;
  if (!geometry) errors.push("Missing selected display geometry");
  if (!/^[a-f0-9]{64}$/.test(bridge[0]?.sourceSHA || ""))
    errors.push("Missing actual bridge source identity");
  if (
    ready.length !== 1 ||
    ready[0].clientInstances !== 1 ||
    bridge.length !== 1
  )
    errors.push("Expected exactly one persistent native client and bridge");
  if (requests.length < minimum)
    errors.push(`Too few gestures: ${requests.length}`);
  if (
    records.some((r) => r.type === "request-error") ||
    native.some((r) => r.type === "fatal")
  )
    errors.push("Native input error recorded");
  if (delivered.length !== requests.length)
    errors.push("Incomplete native deliveries");
  const markers = [
    ...simulatorLog.matchAll(
      /\[teleport-maestro-input\] backend=indigo action=(\d+) acknowledged=(\d+)/g,
    ),
  ];
  if (markers.length !== delivered.length)
    errors.push("XCTest did not confirm every bridge delivery");
  for (let index = 0; index < requests.length; index++) {
    const request = requests[index];
    const result = delivered[index];
    const gesture = request.gesture;
    const first = request.frames[0],
      last = request.frames.at(-1);
    const start = gesture.kind === "touch" ? gesture.point : gesture.start;
    const end = gesture.kind === "touch" ? gesture.point : gesture.end;
    if (
      !["touch", "swipe"].includes(gesture.kind) ||
      !Number.isFinite(gesture.duration) ||
      first?.offset !== 0 ||
      last?.offset !==
        gesture.duration + (gesture.kind === "swipe" ? 0.1 : 0) ||
      first?.x !== start?.x ||
      first?.y !== start?.y ||
      last?.x !== end?.x ||
      last?.y !== end?.y
    )
      errors.push(
        `Original gesture control points changed action ${index + 1}`,
      );
    if (
      gesture.kind === "swipe" &&
      (request.frames.at(-2)?.offset !== 0.1 ||
        request.frames.at(-2)?.x !== end?.x ||
        request.frames.at(-2)?.y !== end?.y)
    )
      errors.push(`Original swipe move time changed action ${index + 1}`);
    if (
      request.id !== index + 1 ||
      result?.id !== request.id ||
      result?.action !== index + 1
    )
      errors.push(`Nonsequential/duplicate action ${index + 1}`);
    if (
      typeof request.gesture.deviceUDID !== "string" ||
      typeof identity?.deviceUDID !== "string" ||
      request.gesture.deviceUDID.toLowerCase() !==
        identity.deviceUDID.toLowerCase()
    )
      errors.push(`Wrong Simulator action ${index + 1}`);
    if (
      result?.acknowledged !== request.frames.length ||
      result?.frames?.length !== request.frames.length
    )
      errors.push(`Incomplete acknowledgement action ${index + 1}`);
    for (let frame = 0; frame < request.frames.length; frame++) {
      const wanted = request.frames[frame];
      const sent = result?.frames?.[frame];
      if (sent?.phase !== wanted.phase || sent?.requested !== wanted.offset)
        errors.push(`Changed gesture timeline action ${index + 1}`);
      if (
        geometry &&
        (!Number.isFinite(wanted.x) ||
          !Number.isFinite(wanted.y) ||
          !Number.isFinite(sent?.xRatio) ||
          !Number.isFinite(sent?.yRatio) ||
          Math.abs(
            sent.xRatio - (wanted.x * identity.scale) / identity.pixels[0],
          ) > 1e-12 ||
          Math.abs(
            sent.yRatio - (wanted.y * identity.scale) / identity.pixels[1],
          ) > 1e-12)
      )
        errors.push(`Changed display coordinates action ${index + 1}`);
    }
    if (
      Number(markers[index]?.[1]) !== index + 1 ||
      Number(markers[index]?.[2]) !== request.frames.length
    )
      errors.push(`Wrong XCTest acknowledgement action ${index + 1}`);
  }
  return {
    clientInstances: ready.length,
    requests: requests.length,
    routeCounts,
    gestureCounts,
    activeCancellations: cancelled.map((r) => r.senderId),
    acknowledgedActions: delivered.length,
    xctestMarkers: markers.length,
    bridgeSourceSHA: bridge[0]?.sourceSHA,
    deviceUDID: identity?.deviceUDID,
    errors,
  };
}

export function checkHIDFiles(directory, xctestLog) {
  const records = readFileSync(
    path.join(directory, "indigo-transport.jsonl"),
    "utf8",
  )
    .trim()
    .split("\n")
    .map(JSON.parse);
  return checkHIDDelivery(
    records,
    readFileSync(path.join(directory, "simulator.log"), "utf8"),
    100,
    readFileSync(xctestLog, "utf8"),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [directory, output, xctestLog] = process.argv.slice(2);
  if (!directory || !output || !xctestLog || process.argv.length !== 5)
    throw new Error(
      "Expected native diagnostics directory, output JSON and actual XCTest log",
    );
  const result = checkHIDFiles(directory, xctestLog);
  writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
  if (result.errors.length) process.exitCode = 1;
}
