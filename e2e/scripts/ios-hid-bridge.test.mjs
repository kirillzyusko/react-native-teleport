import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  gestureFrames,
  ownedIndigoHelper,
  startIndigoBridge,
} from "./ios-hid-bridge.mjs";

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
const input=readline.createInterface({input:process.stdin});
if(${JSON.stringify(mode)}==='stubborn') {
 process.on('SIGTERM',()=>fs.writeFileSync(${JSON.stringify(path.join(directory, "terminated"))},'1'));
 input.on('close',()=>setInterval(()=>{},1000));
}
input.on('line',line=>{
 const request=JSON.parse(line);
 if(${JSON.stringify(mode)}==='fatal' || ${JSON.stringify(mode)}==='fatal-eof') {console.log(JSON.stringify({type:'fatal',error:'fixture delivery failed'}));if(${JSON.stringify(mode)}==='fatal')process.exit(1);else process.exitCode=1;return;}
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

test("fatal helper observes stdin EOF without a forced process-group signal", async (t) => {
  const f = await fixture("fatal-eof");
  const child = f.children[0];
  const closed = once(child, "close");
  t.diagnostic(
    JSON.stringify({
      owner: "Device-free fatal helper cleanup regression",
      pid: child.pid,
      port: f.bridge.port,
      command: execFileSync(
        "ps",
        ["-ww", "-p", String(child.pid), "-o", "pid=,ppid=,uid=,command="],
        { encoding: "utf8" },
      ).trim(),
      normalStop: "stdin EOF and await close; no replay or respawn",
    }),
  );
  const originalKill = process.kill.bind(process);
  const forced = [];
  t.mock.method(process, "kill", (pid, signal) => {
    if (pid === -child.pid && signal === "SIGKILL") {
      forced.push(signal);
      // Reproduce the observed cleanup call/error without signalling any OS
      // process. The CI helper's permission/group state was not captured.
      throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    }
    return originalKill(pid, signal);
  });
  try {
    assert.equal((await f.post()).status, 500);
    assert.equal((await f.post()).status, 500);
    await f.bridge.stop();
    await f.bridge.stop();
    assert.deepEqual(await closed, [1, null]);
    assert.deepEqual(forced, []);
    assert.equal(f.children.length, 1);
  } finally {
    t.mock.restoreAll();
    if (!child.stdin.destroyed) child.stdin.end();
    await closed;
    assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
    await rm(f.directory, { recursive: true, force: true });
  }
});

test("normal helper closes through EOF without a signal", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post()).status, 200);
    await f.bridge.stop();
    assert.equal(f.children[0].exitCode, 0);
    assert.equal(f.children[0].signalCode, null);
    const records = (
      await readFile(path.join(f.directory, "indigo-transport.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.deepEqual(
      records.filter((r) => r.type === "bridge-stop").map((r) => r.phase),
      ["stdin-eof", "closed"],
    );
    assert.equal(
      records.filter((r) => r.type === "bridge-stop-signal").length,
      0,
    );
  } finally {
    await f.close();
  }
});

test("teardown identity requires the exact PID, parent, UID and full command", () => {
  const command = `/owned/IndigoHost ${device} /Xcode /Core /Kit`;
  const details = ` 321 123 501 ${command}\n`;
  assert.equal(ownedIndigoHelper(details, 321, 123, 501, command), true);
  for (const args of [
    [details, 322, 123, 501, command],
    [details, 321, 124, 501, command],
    [details, 321, 123, 502, command],
    [details, 321, 123, 501, command + " --foreign"],
    [details + details, 321, 123, 501, command],
    [details, "321", 123, 501, command],
    [`1 123 501 ${command}`, 1, 123, 501, command],
    [`321 123 501 /other${command}`, 321, 123, 501, command],
  ])
    assert.equal(ownedIndigoHelper(...args), false);
});

test("hung helper revalidates its identity before each bounded teardown signal", async (t) => {
  const f = await fixture("stubborn");
  try {
    assert.equal((await f.post()).status, 200);
    await f.bridge.stop();
    assert.equal(
      await readFile(path.join(f.directory, "terminated"), "utf8"),
      "1",
    );
    assert.equal(f.children[0].signalCode, "SIGKILL");
    const records = (
      await readFile(path.join(f.directory, "indigo-transport.jsonl"), "utf8")
    )
      .trim()
      .split("\n")
      .map(JSON.parse);
    const signals = records.filter((r) => r.type === "bridge-stop-signal");
    assert.deepEqual(
      signals.map((r) => r.signal),
      ["SIGTERM", "SIGKILL"],
    );
    for (const row of signals) {
      assert.equal(row.pid, f.children[0].pid);
      assert.equal(
        ownedIndigoHelper(
          row.command,
          row.pid,
          process.pid,
          process.getuid(),
          `${process.execPath} ${f.children[0].spawnargs.join(" ")}`,
        ),
        true,
      );
      t.diagnostic(
        JSON.stringify({ owner: "Device-free hung helper", ...row }),
      );
    }
  } finally {
    await f.close();
  }
});
