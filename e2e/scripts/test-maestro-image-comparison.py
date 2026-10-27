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
    options = parser.parse_args()
    jar = options.jar.resolve()
    destination = options.destination.resolve()
    scripts = Path(__file__).resolve().parent
    subprocess.run(["python3", str(scripts / "patch-maestro-image-comparison.py"),
                    str(jar), str(destination)], check=True)
    libraries = str(jar.parent / "*")
    fixture = destination / "fixture"
    subprocess.run(["javac", "-cp", libraries, "-d", str(fixture),
                    str(scripts / "image-comparison-fixture/ImageComparisonContractProbe.java")], check=True)
    outputs = {}
    for variant in ["original", "classes"]:
        output = destination / f"contract-{variant}.json"
        subprocess.run(["java", "-Djava.awt.headless=true", "-Xverify:all", "-Xmx1g", "-cp",
                        f"{fixture}:{destination / variant}:{libraries}",
                        "ImageComparisonContractProbe", str(options.frames.resolve()) if options.frames else "-",
                        str(output)], check=True)
        outputs[variant] = json.loads(output.read_text())
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


if __name__ == "__main__":
    main()
