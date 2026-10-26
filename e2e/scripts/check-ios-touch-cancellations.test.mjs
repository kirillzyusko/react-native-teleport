import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { analyzeTouchCancellations } from "./check-ios-touch-cancellations.mjs";

const captured = readFileSync(
  new URL("./fixtures/ios-recap-cancelled.log", import.meta.url),
  "utf8",
);

test("identifies both real failed gestures with sender-matched cancellation", () => {
  const result = analyzeTouchCancellations(captured);
  assert.equal(result.recapDeviceCount, 2);
  assert.deepEqual(
    result.confirmedRegistrationRaces.map((entry) => entry.senderId),
    ["0x1017221c00005", "0x10532b750003f"],
  );
  assert.equal(result.otherIncompleteGestures.length, 0);
  for (const entry of result.confirmedRegistrationRaces) {
    assert.equal(entry.incomplete.length, 1);
    assert.match(entry.incomplete[0], /sceneID:teleport.example-default/);
  }
});

test("unknown sender followed by an empty-contact detach is a near miss", () => {
  const withoutOpenContacts = captured
    .split("\n")
    .filter(
      (line) =>
        !(
          line.includes("cancel -- digitizer did disappear:") &&
          line.includes("touching;")
        ),
    )
    .join("\n");
  const result = analyzeTouchCancellations(withoutOpenContacts);
  assert.equal(result.recapDeviceCount, 2);
  assert.equal(result.unknownSenderCount, 2);
  assert.deepEqual(result.confirmedRegistrationRaces, []);
  assert.deepEqual(result.otherIncompleteGestures, []);
});

test("does not attribute another sender's unknown event to a cancelled touch", () => {
  const input = captured.replace(
    /(unknown senderID:)\s*0x[\da-f]+/gi,
    "$1 0xdeadbeef",
  );
  const result = analyzeTouchCancellations(input);
  assert.deepEqual(result.confirmedRegistrationRaces, []);
  assert.equal(result.otherIncompleteGestures.length, 2);
});

test("still reports active-contact cancellation when its earlier unknown log is absent", () => {
  const input = captured
    .split("\n")
    .filter((line) => !line.includes("unknown senderID:"))
    .join("\n");
  const result = analyzeTouchCancellations(input);
  assert.deepEqual(result.confirmedRegistrationRaces, []);
  assert.equal(result.otherIncompleteGestures.length, 2);
});

test("ignores app text that merely quotes a BackBoard error", () => {
  const result = analyzeTouchCancellations(
    captured.replaceAll("backboardd[", "TeleportExample["),
  );
  assert.equal(result.recapDeviceCount, 0);
  assert.deepEqual(result.confirmedRegistrationRaces, []);
});

test("parses the compact log format used by the independent CI collector", () => {
  const input = captured.replace(
    /localhost backboardd\[(\d+)\]:/g,
    "backboardd[$1:abcd]",
  );
  assert.equal(
    analyzeTouchCancellations(input).confirmedRegistrationRaces.length,
    2,
  );
});
