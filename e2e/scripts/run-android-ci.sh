#!/usr/bin/env bash
set -euo pipefail

mode=$1
device=$2
maestro_home="${TELEPORT_MAESTRO_DIR:-$HOME/.maestro}"
probe_dir="${TELEPORT_PROBE_DIR:-$RUNNER_TEMP/teleport-maestro-driver-probe}"

case "$mode" in
  suite|input-trace|input-repeat|input-trace-sdk)
    if [ "$mode" != input-trace-sdk ]; then
      python3 e2e/scripts/patch-maestro-instrumentation.py \
        "$maestro_home/lib/maestro-client.jar" "$probe_dir" --install
    fi
    mkdir -p e2e/reports/native-diagnostics
    cp "$probe_dir/maestro-patch.json" e2e/reports/native-diagnostics/maestro-patch.json
    if [ "$mode" = input-trace-sdk ]; then
      test -f "$probe_dir/sdk-click/native-click-patch.json"
      mkdir -p e2e/reports/native-diagnostics/sdk-click
      cp "$probe_dir/sdk-click/"*.json "$probe_dir/sdk-click/"*.apk \
        "$probe_dir/sdk-click/"*.smali "$probe_dir/sdk-click/"*.log \
        e2e/reports/native-diagnostics/sdk-click/
      python3 - "$maestro_home/lib/maestro-client.jar" "$probe_dir/sdk-click/native-click-patch.json" <<'PYTHON'
from pathlib import Path
import hashlib, json, zipfile, sys
jar = Path(sys.argv[1])
manifest = json.loads(Path(sys.argv[2]).read_text())
sha = lambda data: hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(jar) as archive:
    proof = {"jar_sha256": sha(jar.read_bytes()),
             "server_sha256": sha(archive.read("maestro-server.apk")),
             "app_sha256": sha(archive.read("maestro-app.apk")),
             "driver_sha256": sha(archive.read("maestro/drivers/AndroidDriver.class"))}
expected = dict(zip(proof, [manifest["output_jar_sha256"], manifest["output_apk_sha256"],
                           manifest["sdk_app_sha256"], manifest["foreground_driver_sha256"]]))
if proof != expected:
    raise ValueError("Private runtime SDK differs from the prepared diagnostic dependency")
Path("e2e/reports/native-diagnostics/native-click-runtime-install.json").write_text(json.dumps(proof, indent=2) + "\n")
PYTHON
      export TELEPORT_SDK_CLICK_TRACE=1
    fi
    flows=(e2e/flows/*)
    if [ "$mode" = input-repeat ]; then
      wrapper="$probe_dir/navigation-input-repeat.yml"
      node - "$wrapper" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const flow = path.resolve("e2e/flows/navigation-view-ownership.yml");
fs.writeFileSync(process.argv[2], [
  "appId: teleport.example",
  "---",
  "- repeat:",
  "    times: 20",
  "    commands:",
  "      - runFlow:",
  `          file: ${JSON.stringify(flow)}`,
  "",
].join("\n"));
NODE
      cp "$wrapper" e2e/reports/native-diagnostics/navigation-input-repeat.yml
      flows=("$wrapper")
    fi
    exec node e2e/scripts/native-diagnostics.mjs android "$device" -- \
      maestro --platform android --device "$device" test \
      -e DEVICE="e2e_emulator_31" "${flows[@]}" --format html ./e2e/reports/debug \
      --debug-output ./e2e/reports/debug --flatten-debug-output
    ;;
  stock-driver|foreground-driver)
    mkdir -p "$probe_dir"
    javac -cp "$maestro_home/lib/*" -d "$probe_dir" \
      e2e/scripts/NativeDriverLifecycleProbe.java
    if [ "$mode" = foreground-driver ]; then
      python3 e2e/scripts/patch-maestro-instrumentation.py \
        "$maestro_home/lib/maestro-client.jar" "$probe_dir"
    fi
    exec node e2e/scripts/native-diagnostics.mjs android "$device" -- \
      java -cp "$probe_dir:$maestro_home/lib/*" NativeDriverLifecycleProbe "$device" "$mode"
    ;;
  *)
    echo "Unknown Android CI mode: $mode" >&2
    exit 2
    ;;
esac
