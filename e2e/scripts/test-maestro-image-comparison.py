"""Compare original and optimized dependency outputs using the same inputs."""
import argparse
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("jar", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--frames", type=Path)
    parser.add_argument("--reproduce-wait", action="store_true",
                        help="Measure the actual two-second screenshot wait on generated images")
    options = parser.parse_args()
    jar = options.jar.resolve()
    destination = options.destination.resolve()
    scripts = Path(__file__).resolve().parent
    subprocess.run(["python3", str(scripts / "patch-maestro-image-comparison.py"),
                    str(jar), str(destination)], check=True)
    libraries = str(jar.parent / "*")
    fixture = destination / "fixture"
    sources = [str(scripts / "image-comparison-fixture/ImageComparisonContractProbe.java")]
    if options.reproduce_wait:
        sources.append(str(scripts / "image-comparison-fixture/ScreenshotWaitRepro.java"))
    subprocess.run(["javac", "-cp", libraries, "-d", str(fixture), *sources], check=True)
    outputs = {}
    waits = []
    for variant in ["original", "classes"]:
        output = destination / f"contract-{variant}.json"
        subprocess.run(["java", "-Djava.awt.headless=true", "-Xverify:all", "-Xmx1g", "-cp",
                        f"{fixture}:{destination / variant}:{libraries}",
                        "ImageComparisonContractProbe", str(options.frames.resolve()) if options.frames else "-",
                        str(output)], check=True)
        outputs[variant] = json.loads(output.read_text())
        if options.reproduce_wait:
            result = subprocess.run([
                "java", "-Djava.awt.headless=true", "-Xverify:all", "-Xmx1g", "-cp",
                f"{fixture}:{destination / variant}:{libraries}", "ScreenshotWaitRepro",
            ], check=True, capture_output=True, text=True, timeout=120)
            measured = json.loads(next(line for line in result.stdout.splitlines() if line.startswith("{")))
            (destination / f"wait-{variant}.json").write_text(json.dumps(measured, indent=2) + "\n")
            waits.append({"variant": variant, **measured})
    original = outputs["original"]["records"]
    optimized = outputs["classes"]["records"]
    expected = 129 if options.frames else 125
    if len(original) != expected or len(optimized) != expected:
        raise ValueError("Unexpected contract control count")
    for before, after in zip(original, optimized):
        left = {key: value for key, value in before.items() if key != "comparisonMs"}
        right = {key: value for key, value in after.items() if key != "comparisonMs"}
        if left != right:
            raise ValueError(f"Comparison output differs: {before['label']}")
    print(f"PASS: {expected} identical states, float bits, ordered bounds and rendered ARGB hashes")
    if options.reproduce_wait:
        if len(waits) != 2 or any(w["requested_ms"] != 2000 or w["regions"] != 2550 or w["result"] is not False for w in waits):
            raise ValueError("Unexpected synthetic screenshot-wait result")
        # Timings are evidence, not a machine-speed assertion or a CI gate.
        print(json.dumps({"screenshot_wait_measurements": waits}, indent=2))


if __name__ == "__main__":
    main()
