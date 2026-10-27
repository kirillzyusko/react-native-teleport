import assert from "node:assert/strict";
import test from "node:test";
import {
  installedSDKIdentity,
  nativeClickLine,
} from "./android-native-click.mjs";

const apk = "/data/app/~~abc/dev.mobile.maestro.test-abc/base.apk";
const hash = "a".repeat(64);
const line = (value) =>
  `10-27 11:00:00.123 123 456 I MaestroNativeInput: ${JSON.stringify(value)}`;
const event = {
  phase: "native.click.complete",
  x: 540,
  y: 1512,
  accepted: false,
  completedUptimeMs: 1000,
};

test("preserves the SDK false result without treating it as app delivery", () => {
  assert.deepEqual(nativeClickLine(line(event)), event);
  assert.equal(nativeClickLine("unrelated log"), undefined);
  for (const altered of [
    { ...event, accepted: "false" },
    { ...event, x: 0.5 },
    { ...event, completedUptimeMs: -1 },
  ]) {
    assert.throws(() => nativeClickLine(line(altered)));
  }
});

test("reads only the selected SDK package and confirms its path around hashing", async () => {
  const requests = [];
  const result = await installedSDKIdentity("emulator-5554", async (args) => {
    requests.push(args);
    return args.includes("sha256sum")
      ? `${hash}  ${apk}\n`
      : `package:${apk}\n`;
  });
  assert.deepEqual(result, {
    device: "emulator-5554",
    package: "dev.mobile.maestro.test",
    path: apk,
    sha256: hash,
  });
  assert.deepEqual(requests, [
    ["shell", "pm", "path", "dev.mobile.maestro.test"],
    ["shell", "sha256sum", apk],
    ["shell", "pm", "path", "dev.mobile.maestro.test"],
  ]);
});

test("rejects ambiguous, unsafe, missing or replaced live APK identities", async () => {
  for (const bad of [
    "",
    `package:${apk}\npackage:${apk}`,
    "package:/tmp/base.apk",
    "package:/data/app/a/../base.apk",
    "package:/data/app/$(whoami)/base.apk",
  ]) {
    await assert.rejects(
      installedSDKIdentity("emulator-5554", async () => bad),
    );
  }
  await assert.rejects(
    installedSDKIdentity("other-device", async () => {
      throw new Error("must not run");
    }),
  );
  let calls = 0;
  await assert.rejects(
    installedSDKIdentity("emulator-5554", async (args) => {
      calls++;
      return args.includes("sha256sum")
        ? `${hash}  ${apk}`
        : `package:${calls === 3 ? apk.replace("-abc", "-new") : apk}`;
    }),
  );
  await assert.rejects(
    installedSDKIdentity("emulator-5554", async (args) =>
      args.includes("sha256sum") ? `${hash}  /wrong.apk` : `package:${apk}`,
    ),
  );
});
