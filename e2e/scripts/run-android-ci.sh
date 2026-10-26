#!/usr/bin/env bash
set -euo pipefail

mode=$1
device=$2

case "$mode" in
  suite)
    exec node e2e/scripts/native-diagnostics.mjs android "$device" -- \
      maestro --platform android --device "$device" test \
      -e DEVICE="e2e_emulator_31" e2e/flows/* --format html ./e2e/reports/debug \
      --debug-output ./e2e/reports/debug --flatten-debug-output
    ;;
  stock-driver|foreground-driver)
    maestro_home="$HOME/.maestro"
    probe_dir="$RUNNER_TEMP/teleport-maestro-driver-probe"
    mkdir -p "$probe_dir"
    javac -cp "$maestro_home/lib/*" -d "$probe_dir" \
      e2e/scripts/NativeDriverLifecycleProbe.java
    if [ "$mode" = foreground-driver ]; then
      python3 e2e/scripts/foreground-instrumentation-probe.py \
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
