import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import test from "node:test";
import {
  inputBufferBytes,
  startLiveFrameBodies,
} from "./ios-frame-body-live.mjs";

function fixture(callback) {
  const directory = mkdtempSync(
    path.join(tmpdir(), "teleport-live-body-node-"),
  );
  const chunks = [];
  const child = new EventEmitter();
  child.pid = 999000;
  child.stderr = new PassThrough();
  child.stdout = new PassThrough();
  child.stdin = new Writable({
    write(chunk, encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
    final(done) {
      done();
      queueMicrotask(() => {
        child.stdout.emit(
          "data",
          Buffer.from(
            JSON.stringify({
              phase: "finished",
              workerPID: child.pid,
              PNGs: 0,
              errors: [],
              deviceAPICalls: 0,
            }) + "\n",
          ),
        );
        child.emit("exit", 0, null);
        child.emit("close", 0, null);
      });
    },
  });
  let calls = 0;
  const spawnProcess = (command, args, options) => {
    calls++;
    assert.equal(command, "python3");
    assert.equal(args[0], "-B");
    assert.equal(args[2], "--device");
    assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
    return child;
  };
  const receipt = () =>
    JSON.parse(
      readFileSync(path.join(directory, "live-frame-body-process.json")),
    );
  return Promise.resolve()
    .then(() =>
      callback({
        directory,
        child,
        chunks,
        spawnProcess,
        calls: () => calls,
        receipt,
      }),
    )
    .finally(() => rmSync(directory, { recursive: true }));
}

test("disabled observer starts no process and touches no directory", () => {
  assert.equal(
    startLiveFrameBodies({
      enabled: false,
      directory: "/unavailable",
      spawnProcess() {
        throw new Error("disabled spawn");
      },
    }),
    undefined,
  );
});

test("enabled forwards each original raw chunk once and ends through stdin EOF", () =>
  fixture(async (f) => {
    const observer = startLiveFrameBodies({
      enabled: true,
      device: "selected",
      directory: f.directory,
      spawnProcess: f.spawnProcess,
    });
    const first = Buffer.from("original-raw-log\n"),
      second = Buffer.from("second-line\n");
    assert.equal(observer.feed(first), undefined);
    observer.feed(second);
    const receipt = await observer.stop();
    assert.equal(f.calls(), 1);
    assert.deepEqual(f.chunks, [first, second]);
    assert.equal(receipt.exit, 0);
    assert.equal(receipt.signal, null);
    assert.equal(receipt.inputEnded, true);
    assert.equal(receipt.deviceAPICalls, 0);
    assert.equal(receipt.parentPID, process.pid);
    assert.equal(receipt.nodeVersion, "v20.19.4");
    assert.deepEqual(receipt.errors, []);
    assert.equal(f.receipt().pid, f.child.pid);
  }));

test("input overflow fails evidence without pausing original stream", () =>
  fixture(async (f) => {
    const observer = startLiveFrameBodies({
      enabled: true,
      device: "selected",
      directory: f.directory,
      spawnProcess: f.spawnProcess,
    });
    assert.equal(observer.feed(Buffer.alloc(inputBufferBytes + 1)), undefined);
    const receipt = await observer.stop();
    assert.deepEqual(receipt.errors, ["Exporter input buffer bound exceeded"]);
    assert.equal(f.chunks.length, 0);
  }));

test("early child exit and later input are preserved as failures", () =>
  fixture(async (f) => {
    const observer = startLiveFrameBodies({
      enabled: true,
      device: "selected",
      directory: f.directory,
      spawnProcess: f.spawnProcess,
    });
    f.child.stdin.destroy();
    f.child.emit("exit", 1, null);
    f.child.emit("close", 1, null);
    observer.feed(Buffer.from("still-original\n"));
    const receipt = await observer.stop();
    assert.equal(receipt.exit, 1);
    assert.ok(receipt.errors.includes("Exporter did not finish normally"));
    assert.ok(
      receipt.errors.includes("Exporter ended before original log stream"),
    );
  }));

test("existing receipt is never overwritten and no second child starts", () =>
  fixture(async (f) => {
    const observer = startLiveFrameBodies({
      enabled: true,
      device: "selected",
      directory: f.directory,
      spawnProcess: f.spawnProcess,
    });
    assert.throws(
      () =>
        startLiveFrameBodies({
          enabled: true,
          device: "selected",
          directory: f.directory,
          spawnProcess: f.spawnProcess,
        }),
      /EEXIST/,
    );
    await observer.stop();
    assert.equal(f.calls(), 1);
  }));

test("stderr overflow is bounded and fails evidence", () =>
  fixture(async (f) => {
    const observer = startLiveFrameBodies({
      enabled: true,
      device: "selected",
      directory: f.directory,
      spawnProcess: f.spawnProcess,
    });
    f.child.stderr.emit("data", Buffer.alloc(65537));
    const receipt = await observer.stop();
    assert.ok(receipt.errors.includes("Exporter stderr bound exceeded"));
    assert.equal(receipt.stderr.length, 0);
  }));

if (process.env.TELEPORT_FRAME_BODY_FIXTURE_ARTIFACT) {
  test("actual Node adapter and Python worker copy before generated container deletion", async () => {
    const { existsSync, mkdirSync, writeFileSync } = await import("node:fs");
    const { createHash } = await import("node:crypto");
    const directory = mkdtempSync(
      path.join(tmpdir(), "teleport-live-body-integration-"),
    );
    const device = "00000000-0000-0000-0000-000000000001";
    const container = "00000000-0000-0000-0000-000000000002";
    const token = "00000000-0000-0000-0000-000000000003";
    const devicesRoot = path.join(directory, "Devices");
    const home = path.join(
      devicesRoot,
      device,
      "data/Containers/Data/Application",
      container,
    );
    const root = path.join(home, "tmp", `teleport-frame-bodies-123-${token}`);
    mkdirSync(root, { recursive: true });
    writeFileSync(
      path.join(home, ".com.apple.mobile_container_manager.metadata.plist"),
      '<?xml version="1.0"?><plist version="1.0"><dict><key>MCMMetadataIdentifier</key><string>dev.mobile.maestro-driver-iosUITests.xctrunner</string></dict></plist>',
    );
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154089963f8cfc0f01f00050001ffabce36890000000049454e44ae426082",
      "hex",
    );
    const digest = createHash("sha256").update(png).digest("hex");
    const metadata = JSON.parse(
      readFileSync(
        path.join(
          process.env.TELEPORT_FRAME_BODY_FIXTURE_ARTIFACT,
          "maestro-ios-input.json",
        ),
      ),
    );
    const common = {
      version: 1,
      helperSHA: metadata.frame_body_archive.helper_sha256,
      pid: 123,
      simulatorUDID: device,
      uptime: 1,
      wallTime: 1793000000,
    };
    const rows = [];
    const copied = [];
    for (const ordinal of [1, 2]) {
      rows.push({
        ...common,
        phase: "queued",
        ordinal,
        firstHash: digest,
        secondHash: digest,
        firstBytes: png.length,
        secondBytes: png.length,
        firstReturned: ordinal * 2,
        secondReturned: ordinal * 2 + 0.1,
        isScreenStatic: true,
        pendingPairs: 1,
      });
      if (ordinal === 1)
        rows.push({
          ...common,
          phase: "initialized",
          root,
          limits: metadata.frame_body_archive.limits,
        });
      const saved = { ...common, phase: "saved", ordinal };
      for (const side of ["first", "second"]) {
        const name = `pair-${String(ordinal).padStart(6, "0")}-${side}.png`;
        saved[side + "File"] = name;
        saved[side + "Hash"] = digest;
        saved[side + "Bytes"] = png.length;
        writeFileSync(path.join(root, name), png);
        copied.push(path.join(directory, "live-frame-bodies/123", name));
      }
      rows.push(saved);
    }
    let resolveCopies;
    const complete = new Promise((resolve) => {
      resolveCopies = resolve;
    });
    const observer = startLiveFrameBodies({
      enabled: true,
      device,
      directory,
      devicesRoot,
      artifact: process.env.TELEPORT_FRAME_BODY_FIXTURE_ARTIFACT,
      onCopy(row) {
        if (row.PNGs === 4) resolveCopies();
      },
    });
    let timer;
    try {
      const body = rows
        .map(
          (row) =>
            `2026-10-27 22:00:00.000 Df maestro-driver-iosUITests-Runner[123:ab1f] (Foundation) [teleport-frame-bodies] ${JSON.stringify(row)}\n`,
        )
        .join("");
      // Split the real pipe input inside JSON, exercising actual stream reassembly.
      observer.feed(Buffer.from(body.slice(0, 57)));
      observer.feed(Buffer.from(body.slice(57)));
      await Promise.race([
        complete,
        new Promise((resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error("Generated file export did not finish")),
            5000,
          );
        }),
      ]);
      rmSync(home, { recursive: true });
      assert.equal(existsSync(home), false);
      const receipt = await observer.stop();
      assert.deepEqual(receipt.errors, []);
      assert.equal(receipt.exit, 0);
      const manifest = JSON.parse(
        readFileSync(path.join(directory, "live-frame-bodies/manifest.json")),
      );
      assert.deepEqual(manifest.errors, []);
      assert.equal(manifest.files.length, 4);
      assert.equal(manifest.liveExport.workerPID, receipt.pid);
      assert.equal(manifest.liveExport.parentPID, process.pid);
      assert.deepEqual(manifest.liveExport.records, rows);
      assert.ok(copied.every((file) => readFileSync(file).equals(png)));
    } finally {
      clearTimeout(timer);
      const finalReceipt = await observer.stop();
      if (process.env.TELEPORT_FRAME_BODY_FIXTURE_RECEIPT)
        writeFileSync(
          process.env.TELEPORT_FRAME_BODY_FIXTURE_RECEIPT,
          JSON.stringify(
            {
              scope: "Generated filesystem integration; no device API",
              receipt: finalReceipt,
            },
            null,
            2,
          ) + "\n",
        );
      rmSync(directory, { recursive: true });
    }
  });
}
