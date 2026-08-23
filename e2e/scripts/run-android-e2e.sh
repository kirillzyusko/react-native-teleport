#!/usr/bin/env bash

set -euo pipefail

device_name="${1:?Usage: run-android-e2e.sh <device-name>}"
report_dir="e2e/reports/debug"

mkdir -p "$report_dir"
printf 'run_id=%s\nrun_attempt=%s\nsha=%s\ndevice=%s\n' \
  "${GITHUB_RUN_ID:-local}" \
  "${GITHUB_RUN_ATTEMPT:-local}" \
  "${GITHUB_SHA:-local}" \
  "$device_name" > "$report_dir/reparent-context.txt"

adb shell setprop log.tag.RNTPReparent DEBUG
adb logcat -c

set +e
maestro --platform android test \
  -e DEVICE="$device_name" \
  e2e/flows/* \
  --format html "$report_dir" \
  --debug-output "$report_dir" \
  --flatten-debug-output
maestro_status=$?
set -e

adb logcat -d -v threadtime > "$report_dir/android-logcat.txt" || true
grep RNTPReparent "$report_dir/android-logcat.txt" > "$report_dir/reparent-logcat.txt" || true

exit "$maestro_status"
