"""Inspect the selected Xcode's Indigo ABI without using a simulator device."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import subprocess
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fixtures-only", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if (output / "inspection.json").exists():
        raise RuntimeError("Refusing to overwrite an existing inspection")
    source = Path(__file__).resolve().parent / "ios-hid"
    report = {"status": "preparing", "candidate_sha": os.environ.get("GITHUB_SHA"),
              "architecture": platform.machine(), "commands": [], "sources": {},
              "device_api_calls": 0, "client_instances": 0, "messages_sent": 0}

    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()

    def save():
        (output / "inspection.json").write_text(json.dumps(report, indent=2) + "\n")

    def run(name, command, timeout=60):
        start = time.monotonic()
        result = subprocess.run(command, capture_output=True, timeout=timeout)
        (output / f"{name}.stdout").write_bytes(result.stdout)
        (output / f"{name}.stderr").write_bytes(result.stderr)
        report["commands"].append({"name": name, "command": command,
                                   "exit": result.returncode,
                                   "elapsed_seconds": time.monotonic() - start})
        save()
        if result.returncode:
            raise RuntimeError(f"{name} failed with {result.returncode}: "
                               + result.stderr.decode(errors="replace")[-2000:])
        return result.stdout.decode()

    save()
    try:
        for filename in ("IndigoProbe.m", "Indigo.h", "Mach.h", "IDB-LICENSE"):
            report["sources"][filename] = digest(source / filename)
        report["collector_sha256"] = digest(Path(__file__).resolve())
        report["xcode"] = run("xcode-version", ["xcodebuild", "-version"]).strip()
        executable = output / "IndigoProbe"
        run("compile", ["xcrun", "clang", "-fobjc-arc", "-fblocks", "-Wall", "-Wextra", "-Werror",
                        "-framework", "Foundation", "-framework", "CoreGraphics",
                        str(source / "IndigoProbe.m"), "-o", str(executable)])
        report["probe_sha256"] = digest(executable)
        fixtures = json.loads(run("fixtures", [str(executable), "--fixtures"]))
        if fixtures != {"cases": 257, "packetSize": 320, "payloadStride": 144,
                        "deviceAPICalls": 0, "clientInstances": 0, "messagesSent": 0}:
            raise RuntimeError("Unexpected envelope fixture result")
        report["fixtures"] = fixtures
        if not args.fixtures_only:
            if report["xcode"].splitlines()[0] != "Xcode 16.4":
                raise RuntimeError("Runtime inspection requires the CI toolchain Xcode 16.4")
            developer = run("developer-directory", ["xcode-select", "-p"]).strip()
            frameworks = {
                "SimulatorKit": Path(developer).parent / "SharedFrameworks/SimulatorKit.framework",
                "CoreSimulator": Path("/Library/Developer/PrivateFrameworks/CoreSimulator.framework"),
            }
            report["frameworks"] = {}
            for name, folder in frameworks.items():
                binary = (folder / name).resolve(strict=True)
                info = plistlib.loads((folder / "Resources/Info.plist").read_bytes())
                report["frameworks"][name] = {"binary": str(binary), "sha256": digest(binary),
                    "version": info.get("CFBundleVersion"),
                    "short_version": info.get("CFBundleShortVersionString")}
            kit = report["frameworks"]["SimulatorKit"]["binary"]
            # Capture the actual builder before invoking a presumed C ABI. A crash
            # in the isolated probe cannot remove the static compatibility evidence.
            run("mouse-builder-disassembly", ["xcrun", "llvm-objdump", "--macho", "--disassemble",
                "--no-show-raw-insn", "--dis-symname", "_IndigoHIDMessageForMouseNSEvent", kit])
            symbols = run("simulator-kit-symbols", ["xcrun", "nm", "-gU", kit])
            report["hid_symbols"] = [line for line in symbols.splitlines()
                                     if "IndigoHID" in line or "LegacyHIDClient" in line]
            result = json.loads(run("runtime-contract", [str(executable), "--inspect", developer, str(output)]))
            if any(result[key] != 0 for key in ("deviceAPICalls", "clientInstances", "messagesSent")):
                raise RuntimeError("Probe unexpectedly accessed a device")
            report["runtime"] = result
            report["packet_sha256"] = {p.name: digest(p) for p in sorted(output.glob("*.bin"))}
            if len(report["packet_sha256"]) != 8:
                raise RuntimeError("Missing native/single-touch packets")
            report["compatibility_review_required"] = True
        report["status"] = "captured" if not args.fixtures_only else "fixtures-passed"
        save()
        print(json.dumps(report, indent=2))
    except Exception as error:
        report.update(status="failed", error=str(error))
        save()
        raise


if __name__ == "__main__":
    main()
