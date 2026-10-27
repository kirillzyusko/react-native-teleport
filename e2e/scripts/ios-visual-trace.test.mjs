import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const babel = require("@babel/core");
const folder = new URL("ios-visual-trace/", import.meta.url);

const helperSHA = createHash("sha256")
  .update(readFileSync(new URL("visualTrace.ts", folder)))
  .update(readFileSync(new URL("visualTraceBuffer.ts", folder)))
  .digest("hex");

function compiled(name, context) {
  const source = babel.transformSync(
    readFileSync(new URL(name, folder), "utf8").replaceAll(
      "__TELEPORT_VISUAL_JS_SHA__",
      helperSHA,
    ),
    {
      filename: fileURLToPath(new URL(name, folder)),
      configFile: false,
      babelrc: false,
      presets: [require.resolve("@babel/preset-typescript")],
      plugins: [require.resolve("@babel/plugin-transform-modules-commonjs")],
    },
  ).code;
  const exports = {};
  vm.runInNewContext(source, { exports, ...context });
  return exports;
}

function runtime(platform = "ios") {
  const output = [];
  const timers = [];
  let clockReads = 0;
  const core = compiled("visualTraceBuffer.ts", {});
  const methods = compiled("visualTrace.ts", {
    require(name) {
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name === "./visualTraceBuffer") return core;
      throw Error(`Unexpected dependency ${name}`);
    },
    Date: { now: () => ++clockReads },
    performance: { now: () => ++clockReads },
    setTimeout: (callback) => timers.push(callback),
    console: { info: (line) => output.push(JSON.parse(line.split("] ")[1])) },
  });
  return { methods, output, timers, clockReads: () => clockReads };
}

const identity = {
  sourceSHA: "a".repeat(64),
  pid: 42,
  simulatorUDID: "fixture",
};

test("disabled and Android measurements install no timer, log or clock read", () => {
  for (const platform of ["ios", "android"]) {
    const app = runtime(platform);
    app.methods.configureVisualTrace(platform === "android", identity);
    const original = () => 7;
    assert.equal(app.methods.traceVisualPress("go_next", original), original);
    app.methods.traceVisualLayout("lifecycle.screen1");
    app.methods.traceVisualTransition(
      "NAVIGATION_LIFECYCLE",
      "transitionEnd",
      false,
    );
    assert.equal(app.methods.visualTraceEnabled(), false);
    assert.equal(app.timers.length, 0);
    assert.equal(app.output.length, 0);
    assert.equal(app.clockReads(), 0);
  }
});

test("enabled press forwards exact event once, return value and thrown error", () => {
  const app = runtime();
  app.methods.configureVisualTrace(true, identity);
  const event = {
    nativeEvent: { timestamp: 12.5, pageX: 201, pageY: 194, target: 7 },
  };
  const value = {};
  let calls = 0;
  const handler = app.methods.traceVisualPress("go_next", (received) => {
    calls++;
    assert.equal(received, event);
    return value;
  });
  assert.equal(handler(event), value);
  assert.equal(calls, 1);
  const failure = Error("original");
  const throwing = app.methods.traceVisualPress(
    "persisted_portal_toggle_host",
    () => {
      calls++;
      throw failure;
    },
  );
  assert.throws(
    () => throwing(event),
    (error) => error === failure,
  );
  assert.equal(calls, 2);
  assert.equal(app.output.length, 0);
  assert.equal(app.timers.length, 1);
  app.timers[0]();
  assert.deepEqual(
    app.output.map((r) => r.phase),
    [
      "installed",
      "onPress.begin",
      "onPress.end",
      "onPress.begin",
      "onPress.end",
    ],
  );
  assert.equal(app.output[1].touchTimestampMs, 12.5);
  assert.equal(app.output[1].pid, 42);
  assert.equal(app.output[1].helperSHA, helperSHA);
});

test("optional native Button event is forwarded unchanged without inventing touch timing", () => {
  const app = runtime();
  app.methods.configureVisualTrace(true, identity);
  let calls = 0;
  const handler = app.methods.traceVisualPress("go_next", (received) => {
    calls++;
    assert.equal(received, undefined);
  });
  handler();
  app.timers[0]();
  assert.equal(calls, 1);
  assert.equal(app.output[1].touchTimestampMs, null);
});

test("bounded buffer reports overflow and resumes sequential output after drain", () => {
  const app = runtime();
  app.methods.configureVisualTrace(true, identity);
  for (let i = 0; i < 1100; i++)
    app.methods.traceVisualLayout("persisted.portal", { i });
  app.timers[0]();
  assert.equal(app.output.length, 1025);
  assert.equal(
    app.output.filter((r) => r.phase === "buffer.overflow").length,
    1,
  );
  app.methods.traceVisualLayout("persisted.portal", { afterDrain: true });
  assert.equal(app.timers.length, 2);
  app.timers[1]();
  assert.equal(app.output.at(-1).phase, "react.layoutEffect");
  assert.equal(app.output.at(-1).sequence, 1102);
});
