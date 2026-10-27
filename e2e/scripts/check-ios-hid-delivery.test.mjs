import assert from "node:assert/strict";
import test from "node:test";
import { checkHIDDelivery } from "./check-ios-hid-delivery.mjs";

function fixture() {
  const frames = [
    { phase: "down", offset: 0, x: 201, y: 193 },
    { phase: "up", offset: 0.1, x: 201, y: 193 },
  ];
  return [
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
}
const marker =
  "[teleport-maestro-input] backend=indigo action=1 acknowledged=2";
test("qualifies a single persistent client with complete native/XCTest correspondence", () => {
  assert.deepEqual(checkHIDDelivery(fixture(), marker, 1).errors, []);
  assert.ok(
    checkHIDDelivery(fixture(), marker).errors.some((e) =>
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
    assert.ok(checkHIDDelivery(records, marker, 1).errors.length);
  }
  assert.ok(checkHIDDelivery(fixture(), "", 1).errors.length);
});
