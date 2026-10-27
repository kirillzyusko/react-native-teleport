import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { gestureFrames, startIndigoBridge } from "./ios-hid-bridge.mjs";

const device = "01234567-1234-1234-1234-0123456789AB";
const tap = {
  deviceUDID: device,
  kind: "touch",
  point: { x: 201, y: 193 },
  duration: 0.1,
};

test("preserves tap/long-press and original swipe control point offsets", () => {
  assert.deepEqual(gestureFrames(tap), [
    { x: 201, y: 193, offset: 0, phase: "down" },
    { x: 201, y: 193, offset: 0.1, phase: "up" },
  ]);
  assert.equal(gestureFrames({ ...tap, duration: 3 })[1].offset, 3);
  const swipe = gestureFrames({
    kind: "swipe",
    start: { x: 201, y: 591 },
    end: { x: 361, y: 591 },
    duration: 3,
  });
  assert.equal(swipe.length, 8);
  assert.deepEqual(swipe[0], { x: 201, y: 591, phase: "down", offset: 0 });
  assert.deepEqual(swipe[6], { x: 361, y: 591, phase: "down", offset: 0.1 });
  assert.deepEqual(swipe[7], { x: 361, y: 591, phase: "up", offset: 3.1 });
});

test("rejects invalid gestures without changing or clamping them", () => {
  for (const duration of [-1, NaN, Infinity, "0.1", null])
    assert.throws(() => gestureFrames({ ...tap, duration }));
  assert.throws(() => gestureFrames({ ...tap, point: { x: -1, y: 0 } }));
  assert.throws(() => gestureFrames({ ...tap, kind: "pinch" }));
});

async function fixture(mode = "normal") {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "teleport-hid-bridge-"),
  );
  const helper = path.join(directory, "fake-helper");
  const source = `#!${process.execPath}
const readline = require('node:readline');
const fs = require('node:fs');
console.log(JSON.stringify({type:'ready', deviceUDID:process.argv[2],clientInstances:1}));
let action=0;
readline.createInterface({input:process.stdin}).on('line',line=>{
 const request=JSON.parse(line);
 if(${JSON.stringify(mode)}==='fatal') {console.log(JSON.stringify({type:'fatal',error:'fixture delivery failed'}));process.exit(1);return;}
 const respond=()=>console.log(JSON.stringify({type:'delivered',id:request.id,action:++action,frames:request.frames,acknowledged:request.frames.length}));
 if(${JSON.stringify(mode)}==='slow') {
  fs.writeFileSync(${JSON.stringify(path.join(directory, "received"))},'1');
  const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(path.join(directory, "release"))})){clearInterval(timer);respond();}},5);
 } else respond();
});
`;
  await writeFile(helper, source, { mode: 0o755 });
  const entry = {
    file: helper,
    sha256: createHash("sha256").update(source).digest("hex"),
  };
  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      helper: entry,
      core: entry,
      kit: entry,
      developer: directory,
    }),
  );
  const children = [];
  const bridge = await startIndigoBridge({
    manifestPath,
    device,
    directory,
    own: (child) => children.push(child),
    port: 0,
  });
  return {
    directory,
    bridge,
    children,
    post(body = tap) {
      return fetch(`http://127.0.0.1:${bridge.port}/gesture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    async close() {
      await bridge.stop();
      await bridge.stop();
      for (const child of children)
        assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("one owned persistent client serves sequential gestures and verifies every ack", async () => {
  const f = await fixture();
  try {
    for (let i = 1; i <= 3; i++) {
      const response = await f.post();
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.action, i);
      assert.equal(result.acknowledged, 2);
    }
    assert.equal(f.children.length, 1);
    const wrong = await f.post({
      ...tap,
      deviceUDID: "11234567-1234-1234-1234-0123456789AB",
    });
    assert.equal(wrong.status, 500);
    const lines = (
      await readFile(path.join(f.directory, "indigo-transport.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(lines.filter((line) => line.type === "request").length, 3);
  } finally {
    await f.close();
  }
});

test("a concurrent request cannot interleave contacts", async () => {
  const f = await fixture("slow");
  try {
    const first = f.post();
    const deadline = Date.now() + 10000;
    while (true) {
      try {
        await readFile(path.join(f.directory, "received"));
        break;
      } catch (error) {
        if (error.code !== "ENOENT" || Date.now() > deadline) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const second = await f.post();
    assert.equal(second.status, 500);
    assert.match((await second.json()).error, /Concurrent/);
    await writeFile(path.join(f.directory, "release"), "1");
    assert.equal((await first).status, 200);
  } finally {
    await f.close();
  }
});

test("native failure propagates without restarting or replaying the gesture", async () => {
  const f = await fixture("fatal");
  try {
    const response = await f.post();
    assert.equal(response.status, 500);
    assert.match((await response.json()).error, /fixture delivery failed/);
    assert.equal((await f.post()).status, 500);
    assert.equal(f.children.length, 1);
    const lines = (
      await readFile(path.join(f.directory, "indigo-transport.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(lines.filter((line) => line.type === "request").length, 1);
  } finally {
    await f.close();
  }
});
