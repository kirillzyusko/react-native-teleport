import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { checkHIDDelivery } from "./check-ios-hid-delivery.mjs";

function fixture(touches = 1) {
  const frames = [
    { phase: "down", offset: 0, x: 201, y: 193 },
    { phase: "up", offset: 0.1, x: 201, y: 193 },
  ];
  const records = [
    {
      type: "native",
      message: {
        type: "ready",
        clientInstances: 1,
        deviceUDID: "test-id",
        pixels: [1206, 2622],
        scale: 3,
      },
    },
    { type: "bridge-ready", sourceSHA: "a".repeat(64) },
    {
      type: "request",
      id: 1,
      gesture: {
        deviceUDID: "test-id",
        kind: "touch",
        point: { x: 201, y: 193 },
        duration: 0.1,
      },
      frames,
    },
    {
      type: "native",
      message: {
        type: "delivered",
        id: 1,
        action: 1,
        acknowledged: 2,
        frames: frames.map((f) => ({
          phase: f.phase,
          requested: f.offset,
          xRatio: (f.x * 3) / 1206,
          yRatio: (f.y * 3) / 2622,
        })),
      },
    },
  ];
  for (let id = 2; id <= touches; id++) {
    const request = JSON.parse(JSON.stringify(records[2]));
    const result = JSON.parse(JSON.stringify(records[3]));
    request.id = id;
    result.message.id = id;
    result.message.action = id;
    records.push(request, result);
  }
  const swipeFrames = [
    { phase: "down", offset: 0, x: 100, y: 200 },
    { phase: "down", offset: 0.1, x: 140, y: 200 },
    { phase: "up", offset: 3.1, x: 140, y: 200 },
  ];
  records.push(
    {
      type: "request",
      id: touches + 1,
      gesture: {
        deviceUDID: "test-id",
        kind: "swipe",
        start: { x: 100, y: 200 },
        end: { x: 140, y: 200 },
        duration: 3,
      },
      frames: swipeFrames,
    },
    {
      type: "native",
      message: {
        type: "delivered",
        id: touches + 1,
        action: touches + 1,
        acknowledged: 3,
        frames: swipeFrames.map((f) => ({
          phase: f.phase,
          requested: f.offset,
          xRatio: (f.x * 3) / 1206,
          yRatio: (f.y * 3) / 2622,
        })),
      },
    },
  );
  return records;
}
const marker =
  "[teleport-maestro-input] backend=indigo action=1 acknowledged=2\n[teleport-maestro-input] backend=indigo action=2 acknowledged=3";
const routeLog =
  "[FlyingFox] request: POST /touch\n[FlyingFox] request: POST /swipeV2\n";
test("qualifies a single persistent client with complete native/XCTest correspondence", () => {
  assert.deepEqual(checkHIDDelivery(fixture(), marker, 2, routeLog).errors, []);
  assert.ok(
    checkHIDDelivery(fixture(), marker, 100, routeLog).errors.some((e) =>
      e.includes("Too few"),
    ),
  );
});
test("rejects incomplete/duplicate delivery, changed timeline, missing marker and wrong device", () => {
  for (const mutate of [
    (r) => {
      r.pop();
    },
    (r) => {
      r.push(r[0]);
    },
    (r) => {
      r[3].message.frames[1].requested = 0.15;
    },
    (r) => {
      r[2].gesture.deviceUDID = "other";
    },
    (r) => {
      r[3].message.acknowledged = 1;
    },
    (r) => {
      r[3].message.frames[0].xRatio = 0;
    },
    (r) => {
      r.push({ type: "request-error" });
    },
  ]) {
    const records = fixture();
    mutate(records);
    assert.ok(checkHIDDelivery(records, marker, 2, routeLog).errors.length);
  }
  assert.ok(checkHIDDelivery(fixture(), "", 2, routeLog).errors.length);
});

test("rejects acknowledged touch-only cohorts and omitted or reordered HTTP swipe routes", () => {
  const records = fixture().slice(0, 4);
  assert.ok(
    checkHIDDelivery(records, marker.split("\n")[0], 1, routeLog).errors.some(
      (e) => e.includes("Both touch and swipe"),
    ),
  );
  assert.ok(
    checkHIDDelivery(
      fixture(),
      marker,
      2,
      routeLog.replace("swipeV2", "touch"),
    ).errors.some((e) => e.includes("routes")),
  );
  assert.ok(
    checkHIDDelivery(fixture(), marker, 2, "").errors.some((e) =>
      e.includes("routes"),
    ),
  );
});

test("rejects active-contact cancellation from a persistent non-Recap digitizer", () => {
  const cancelled =
    "backboardd[1:2] cancel -- digitizer did disappear:<senderID: 0x123; contacts: [pathIndex: 1; touching; locked]>";
  assert.ok(
    checkHIDDelivery(
      fixture(),
      marker + "\n" + cancelled,
      2,
      routeLog,
    ).errors.some((e) => e.includes("Active contact cancellation")),
  );
});

test("CLI keeps the legacy Recap gate and requires complete raw HID proof for its explicit alternative", async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), "teleport-hid-audit-"));
  const execute = promisify(execFile);
  const checker = fileURLToPath(
    new URL("check-ios-touch-cancellations.mjs", import.meta.url),
  );
  const simulator = path.join(folder, "simulator.log");
  const routes = path.join(folder, "xctest.log");
  const output = path.join(folder, "report.json");
  const records = fixture(100);
  const markers = records
    .filter((r) => r.type === "native" && r.message.type === "delivered")
    .map(
      (r) =>
        `[teleport-maestro-input] backend=indigo action=${r.message.action} acknowledged=${r.message.acknowledged}`,
    )
    .join("\n");
  const routeText = records
    .filter((r) => r.type === "request")
    .map(
      (r) =>
        `[FlyingFox] request: POST /${r.gesture.kind === "swipe" ? "swipeV2" : "touch"}`,
    )
    .join("\n");
  try {
    await writeFile(
      path.join(folder, "indigo-transport.jsonl"),
      records.map(JSON.stringify).join("\n"),
    );
    await writeFile(simulator, markers);
    await writeFile(routes, routeText);
    await assert.rejects(
      execute(process.execPath, [checker, simulator, output]),
      (e) => e.code === 1 && e.stderr.includes("No Recap service records"),
    );
    await execute(process.execPath, [
      checker,
      simulator,
      output,
      "--indigo",
      routes,
    ]);
    assert.equal(
      JSON.parse(await readFile(output, "utf8")).recapDeviceCount,
      0,
    );
    await writeFile(routes, routeText.replace("swipeV2", "touch"));
    await assert.rejects(
      execute(process.execPath, [
        checker,
        simulator,
        output,
        "--indigo",
        routes,
      ]),
      (e) => e.code === 1 && e.stderr.includes("routes"),
    );
    await writeFile(routes, routeText);
    await writeFile(
      simulator,
      markers +
        "\nbackboardd[1:2] cancel -- digitizer did disappear:<senderID: 0x123; contacts: [pathIndex: 1; touching; locked]>",
    );
    await assert.rejects(
      execute(process.execPath, [
        checker,
        simulator,
        output,
        "--indigo",
        routes,
      ]),
      (e) => e.code === 1 && e.stderr.includes("Active contact cancellation"),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
