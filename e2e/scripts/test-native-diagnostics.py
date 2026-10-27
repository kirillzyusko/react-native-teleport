"""Exercise the real diagnostics wrapper with mock commands and owned processes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time


def running(pid):
    result = subprocess.run(["/bin/ps", "-p", str(pid), "-o", "stat="],
                            capture_output=True, text=True)
    state = result.stdout.strip()
    return bool(state) and not state.startswith("Z")


def fixture(folder, source, node):
    folder.mkdir(parents=True)
    (folder / "native-diagnostics.mjs").write_bytes(source.read_bytes())
    dependency = Path(__file__).with_name("native-diagnostics-processes.mjs")
    (folder / dependency.name).write_bytes(dependency.read_bytes())
    tool = folder / "mock-tool.mjs"
    tool.write_text("#!" + node + "\n" + r'''
import fs from "node:fs";
import path from "node:path";
const directory = process.env.TELEPORT_PROCESS_FIXTURE;
if (path.basename(process.argv[1]) === "adb" && process.argv.includes("logcat") && !process.argv.includes("-d")) {
  fs.writeFileSync(path.join(directory, "collector.pid"), String(process.pid));
  console.log("mock log stream; no device calls");
  setInterval(() => {}, 1000);
} else {
  console.log("mock diagnostic command; no device calls");
}
''')
    tool.chmod(0o755)
    binary = folder / "bin"
    binary.mkdir()
    for name in ["adb", "uname", "df", "ps", "free", "jcmd"]:
        (binary / name).symlink_to(tool)
    (folder / "grandchild.mjs").write_text(r'''
import fs from "node:fs";
import path from "node:path";
fs.writeFileSync(path.join(process.env.TELEPORT_PROCESS_FIXTURE, "grandchild.pid"), String(process.pid));
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
''')
    (folder / "cli.mjs").write_text(r'''
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
if (process.env.TELEPORT_PROCESS_EXIT !== undefined) process.exit(Number(process.env.TELEPORT_PROCESS_EXIT));
const directory = process.env.TELEPORT_PROCESS_FIXTURE;
fs.writeFileSync(path.join(directory, "cli.pid"), String(process.pid));
spawn(process.execPath, [path.join(directory, "grandchild.mjs")], { stdio: "ignore" });
process.on("SIGINT", () => {});
process.on("SIGTERM", () => {});
setInterval(() => {}, 1000);
''')
    (folder / "owner.mjs").write_text(r'''
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
const directory = process.env.TELEPORT_PROCESS_FIXTURE;
const output = fs.openSync(path.join(directory, "output.log"), "a");
const wrapper = spawn(process.execPath, [path.join(directory, "native-diagnostics.mjs"), "android", "mock-only",
  "--", process.execPath, path.join(directory, "cli.mjs")], { stdio: ["ignore", output, output] });
wrapper.unref();
fs.writeFileSync(path.join(directory, "wrapper.pid"), String(wrapper.pid));
const start = Date.now();
setInterval(() => {
  if (fs.existsSync(path.join(directory, "grandchild.pid"))) process.exit(0);
  if (Date.now() - start > 8000) process.exit(22);
}, 25);
''')
    env = os.environ.copy()
    env.update(TELEPORT_PROCESS_FIXTURE=str(folder),
               PATH=str(binary) + os.pathsep + os.environ["PATH"], GITHUB_ACTIONS="false")
    env.pop("TELEPORT_PROCESS_EXIT", None)
    return env


def pids(folder):
    return {path.stem: int(path.read_text()) for path in folder.glob("*.pid")}


def cleanup(folder):
    # Only PIDs written by these fixtures are eligible, and their current
    # command line must still identify this unique temporary directory.
    for name, pid in sorted(pids(folder).items(), key=lambda pair: pair[0] != "wrapper"):
        if not running(pid):
            continue
        command = subprocess.run(["/bin/ps", "-p", str(pid), "-o", "command="],
                                 capture_output=True, text=True).stdout
        if str(folder) not in command:
            raise RuntimeError("Fixture PID identity changed; refusing to signal it")
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def owner_case(folder, source, node, expect_stopped):
    env = fixture(folder, source, node)
    try:
        owner = subprocess.run([node, str(folder / "owner.mjs")], cwd=folder, env=env,
                               capture_output=True, text=True, timeout=10)
        assert owner.returncode == 0, owner.stderr
        processes = pids(folder)
        assert set(processes) == {"wrapper", "cli", "grandchild", "collector"}
        initial_groups = {name: os.getpgid(pid) for name, pid in processes.items() if running(pid)}
        deadline = time.monotonic() + (6 if expect_stopped else 1.3)
        while time.monotonic() < deadline:
            if expect_stopped and not any(running(pid) for pid in processes.values()):
                break
            time.sleep(0.05)
        active = [name for name, pid in processes.items() if running(pid)]
        assert not active if expect_stopped else set(active) == set(processes), active
        timeline = (folder / "e2e/reports/native-diagnostics/timeline.log").read_text()
        assert ("Owner " in timeline) == expect_stopped
        return {"case": "owner-exit", "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
                "expected_stopped": expect_stopped, "remaining_running": active,
                "initial_process_groups": initial_groups, "timeline": timeline}
    finally:
        cleanup(folder)


def direct_case(folder, source, node, exit_code=None):
    env = fixture(folder, source, node)
    if exit_code is not None:
        env["TELEPORT_PROCESS_EXIT"] = str(exit_code)
    command = [node, str(folder / "native-diagnostics.mjs"), "android", "mock-only", "--",
               node, str(folder / "cli.mjs")]
    try:
        with (folder / "output.log").open("w") as output:
            wrapper = subprocess.Popen(command, cwd=folder, env=env, stdout=output, stderr=output)
            (folder / "wrapper.pid").write_text(str(wrapper.pid))
            if exit_code is None:
                deadline = time.monotonic() + 6
                while not (folder / "grandchild.pid").exists() and time.monotonic() < deadline:
                    time.sleep(0.025)
                assert (folder / "grandchild.pid").exists()
                wrapper.send_signal(signal.SIGTERM)
            actual = wrapper.wait(timeout=8)
        assert actual == (1 if exit_code is None else exit_code), actual
        processes = pids(folder)
        assert not any(running(pid) for pid in processes.values()), processes
        return {"case": "signal" if exit_code is None else f"exit-{exit_code}", "exit": actual,
                "remaining_running": [],
                "timeline": (folder / "e2e/reports/native-diagnostics/timeline.log").read_text()}
    finally:
        cleanup(folder)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    if os.name != "posix":
        print("Process-group checks require the native CI platforms (Linux/macOS)")
        return
    node = shutil.which("node")
    assert node
    source = Path(__file__).with_name("native-diagnostics.mjs").resolve()
    records = []
    with tempfile.TemporaryDirectory(prefix="teleport-diagnostic-ownership-") as temporary:
        root = Path(temporary)
        if args.baseline:
            records.append(owner_case(root / "baseline", args.baseline.resolve(), node, False))
        records.append(owner_case(root / "fixed", source, node, True))
        records.append(direct_case(root / "signal", source, node))
        records.append(direct_case(root / "success", source, node, 0))
        records.append(direct_case(root / "failure", source, node, 7))
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            with args.report.open("x") as output:
                json.dump({"scope": "Actual wrapper with mock diagnostics; no device calls", "records": records}, output, indent=2)
                output.write("\n")
    print(f"Passed {len(records)} actual-wrapper process-lifetime checks")


if __name__ == "__main__":
    main()
