#!/usr/bin/env bash
set -euo pipefail

mode=$1
device=$2
maestro_home="${TELEPORT_MAESTRO_DIR:-$HOME/.maestro}"
probe_dir="${TELEPORT_PROBE_DIR:-$RUNNER_TEMP/teleport-maestro-driver-probe}"

case "$mode" in
  suite|input-trace|input-repeat)
    python3 e2e/scripts/patch-maestro-instrumentation.py \
      "$maestro_home/lib/maestro-client.jar" "$probe_dir" --install
    mkdir -p e2e/reports/native-diagnostics
    cp "$probe_dir/maestro-patch.json" e2e/reports/native-diagnostics/maestro-patch.json
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
