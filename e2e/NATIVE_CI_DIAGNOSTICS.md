# Native CI failures

Investigation on October 26, 2026, using the full reports from runs
[40322782964 (iOS)](https://github.com/kirillzyusko/react-native-teleport/actions/runs/40322782964/job/121576416070)
and [39647963672 (Android)](https://github.com/kirillzyusko/react-native-teleport/actions/runs/39647963672/job/119391639099).
Both used Maestro 2.10.0. Their first failures happen during `launchApp`, before
the supposedly failing example is opened.

## iOS: XCTest reports a failed termination after the app has exited

Four flows pass, including `instagram-reels-video`. At the start of `instant-root`:

```text
12:49:36.248 POST /terminateApp
12:49:36.264 runningboardd: terminate_with_reason() success [pid 15670]
12:49:36.399 SpringBoard: Process exited [teleport.example:15670]
12:50:36.980 XCTest: Failed to terminate teleport.example:15670
12:50:36.991 testHttpServer failed; Tear Down
```

Maestro's [TerminateAppHandler](https://github.com/mobile-dev-inc/Maestro/blob/cli-2.10.0/maestro-ios-xctest-runner/maestro-driver-iosUITests/Routes/Handlers/TerminateAppHandler.swift)
calls `XCUIApplication.terminate()`. That XCTest failure ends the test method
hosting its HTTP server. Subsequent flows reuse the dead session and fail with
`DeviceUnreachableException` / `Connection refused` on port 51556. All 14
remaining failures follow this one failure; they do not identify 14 broken
Teleport examples.

The simulator records the app's exit within about 150 ms. The supplied logs do
not explain why XCTest fails to observe that exit. They do not establish a
Teleport crash, an app deadlock, or RAM exhaustion.

The last successful CI termination logs a `testmanagerd` process-monitor update
with `state: not running`. The failed termination logs no equivalent update for
PID 15670 before timeout, while SpringBoard immediately receives its exit state.
Passing local iOS 18.5 terminations do log that process-monitor update. This
narrows the missing observation to the process-state notification path, but
does not yet establish why the update is absent in the failing run.

The first diagnostic CI batch captured the same notification delay in a
passing job. In run 40345511203, trial 2, termination of PID 18887 started at
15:19:26.904 UTC; SpringBoard recorded its exit at 15:19:26.941. The matching
`testmanagerd` not-running update arrived at 15:19:46.180, over 19 seconds
later. The XCTest runner was waiting in `XCUIApplicationProcess.terminate`.
During that interval, the simulator's `runningboardd` process-death queue
was sampled in `_handleDeath -> _pthread_set_properties_self ->
__bsdthread_ctl`. The test daemon's main loop was idle.

This is a captured system-notification delay, not a verified explanation for
the kernel wait or the original 60-second timeout. The runner reported three
logical CPUs and 7 GiB RAM. Memory compression was substantial, but this
observation alone does not establish memory exhaustion. Later CI diagnostics
also capture the pressure-level counter and the kernel stack of the selected
process. The first passing job had at most two simulator log processes (the
collector and Maestro's current capture), without accumulation across flows.

Related upstream reports:

- [#3318](https://github.com/mobile-dev-inc/Maestro/issues/3318) and
  [#3368](https://github.com/mobile-dev-inc/Maestro/issues/3368): one dead iOS
  driver causes the remaining suite to fail without restarting the driver.
- [#3538](https://github.com/mobile-dev-inc/Maestro/issues/3538): another XCTest
  failure that tears down the HTTP server. Its trigger is status-bar AX
  resolution, which differs from this run's app-termination failure.

## Android: llkd kills adbd because of a zombie shell

Eleven flows pass. `portal-before-host` stalls in `launchApp` for over six
minutes. The device log then records:

```text
18:17:16.695 livelock: Z 600.000s 454->11732->11732 [sh] [kill]
18:17:16.696 livelock: Killing '/apex/com.android.adbd/bin/adbd' (454)
18:17:16.713 UiAutomationManager: UiAutomation service owner died
18:17:36.394 UiAutomation: Error while taking screenshot! DeadObjectException
```

This is Android's live-lock daemon, not the low-memory killer. The
[AOSP implementation](https://android.googlesource.com/platform/system/core/+/main/llkd/libllkd.cpp)
kills the parent of a process stuck in zombie (`Z`) state to allow it to be
reaped. Here the parent is `adbd`, so killing it breaks the automation session.
Maestro then returns null screenshots and empty hierarchies; later selector
failures are consequences of the broken session.

Maestro 2.10.0's
[AndroidDriver.startInstrumentationSession](https://github.com/mobile-dev-inc/Maestro/blob/14a408335e17a090df1e26bdbeaf80d8122a8fd8/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt#L119-L149)
starts the long-lived instrumentation with `am instrument ... &`, keeping its
ADB shell stream open. The background process inherits stdout/stderr, while
the launcher shell exits. Android 12's
[ADB shell implementation](https://android.googlesource.com/platform/packages/modules/adb/+/refs/tags/android-12.0.0_r1/daemon/shell_service.cpp)
drains those streams before calling `waitpid`, leaving the exited shell as a
zombie child of `adbd` until the instrumentation ends or the stream closes.

This mechanism was reproduced on the authorized existing Pixel_8_API_36:

- The unmodified installed Maestro 2.10.0 `AndroidDriver.open()` immediately
  left a zombie shell under `adbd`, with its `am instrument` child reparented
  to PID 1. Screenshots initially still worked.
- Changing only the command constant to remove `&` kept the shell alive and
  the instrumentation below it. The same real driver opened, took screenshots,
  and closed successfully. The installed Maestro distribution was not changed.
- A separate comparison using Maestro's actual connection/server ran the
  foreground command for 660 seconds with successful screenshots, unchanged
  `adbd` PID, and no zombie launcher. The local API 36 image does not expose an
  active `llkd` configuration, so the watchdog kill itself was observed in CI,
  not deliberately triggered locally.

The matching upstream fix already exists as
[Maestro PR #3708](https://github.com/mobile-dev-inc/Maestro/pull/3708), opened
October 23 and still unmerged when checked October 26. It removes the same
trailing `&`; its author also verified an active-watchdog API 30 reproduction
and startup/cleanup on APIs 24/30/32.

This explains the watchdog disconnect. The preceding six-minute delay starts
before `adbd` dies: the command is announced at 18:11:24, but the actual
`Maestro.launchApp` body starts at 18:17:36. The call path sets permissions
before entering that body. Existing logs do not identify which permission
setup operation or APK transfer was blocked during that interval. The patch
must not be presented as proof that this earlier delay is fixed. GPU/color-buffer
warnings also occur during passing flows and do not establish its cause.

Manual Android dispatch also supports `stock-driver` and `foreground-driver`
modes with one trial. Both open the real installed Maestro 2.10.0 driver and
check screenshots and its `adbd` process for 720 seconds, beyond the watchdog
threshold. The foreground variant prepends one patched `AndroidDriver.class`
to the probe's classpath; it removes only the background marker, matching
PR #3708. The installed CLI and its APKs are unchanged. These focused
reproduction jobs do not count as full-suite verification. The original suite
remains the default mode.

## Why keyboard-controller behaves differently

Keyboard-controller uses [Detox](https://github.com/kirillzyusko/react-native-keyboard-controller/blob/main/e2e/package.json),
with test retries and different simulator preparation. Teleport uses Maestro's
XCTest HTTP server on iOS and its UiAutomation/ADB driver on Android. A similar
runner size does not imply the same automation lifecycle or failure behavior.

## Diagnostics

Both native workflows run the existing suite through `scripts/native-diagnostics.mjs`:

- Stream native logs independently of Maestro.
- Sample host processes/memory and device processes every 15 seconds.
- Capture the Maestro JVM's thread dump every minute, including permission
  setup or APK-transfer waits that precede an ADB disconnect.
- If an iOS app termination lasts over eight seconds, capture host process
  state and three-second stacks of the selected simulator's XCTest runner,
  `testmanagerd`, and `runningboardd`, while the original operation is still
  waiting. Stack sampling uses a 10 ms interval to reduce its CPU cost.
  On GitHub-hosted runners, a three-second `spindump -onlyTarget` also captures
  kernel frames for the selected simulator's `runningboardd`. CI samples of
  delayed terminations stopped in `__bsdthread_ctl`; the kernel snapshot is
  intended to explain that wait. This collection is not enabled locally.
- Save final device state, screenshots when available, and new relevant iOS
  crash reports. Android also saves dumpsys and kernel output when permitted.
- Bound each diagnostic command to 15 seconds, stop collectors at the end, and
  preserve the test's exit code. Do not retry or turn a failed test green.
- Upload `e2e-diagnostics-ios-<attempt>-<trial>` /
  `e2e-diagnostics-android-<attempt>-<trial>` on successful and
  failed runs for comparison, with seven-day retention. Snapshot-engine output
  is retained alongside them, as are Maestro's log and per-flow command
  results, even when the job passes. The existing failure reports are still
  uploaded.

The workflows select the device explicitly. `-e DEVICE=...` only supplies a
flow variable for baseline paths; it does not select a simulator or emulator.

Manual dispatch supports one, three, or five independent test jobs, with at
most two running concurrently per platform. Each job uses a fresh hosted
runner, downloads the same built app, and runs the whole original suite in one
Maestro session. Push and pull-request events still run one trial. Matrix
fail-fast is disabled so a failing job does not cancel other observations.
Artifacts are unique per attempt and trial, so reruns retain earlier evidence.
The test step has a 30-minute deadline inside the longer job deadline, leaving
time to upload diagnostics for a stuck suite. Reaching it is a failed
observation, not a successful retry.

The CI campaign ledger is stored in
`.argent/evidence/ci-flakiness-2026-10-26/ci-campaign/`. It records the commit,
run, attempt, and job independently; a successful rerun does not erase a
failure. The final verification target is 60 independent full-suite runs per
platform on an unchanged candidate, without suite retries. Even zero failures
in that finite sample does not prove that rare failures are impossible.

Run the collector's device-free regression tests with:

```sh
node --test e2e/scripts/native-diagnostics.test.mjs
```

For a local native run, supply an existing permitted device explicitly:

```sh
node e2e/scripts/native-diagnostics.mjs ios "$UDID" -- \
  maestro --platform ios --device "$UDID" test e2e/flows/instagram-reels-video.yml
```

Local iOS verification used an existing iPhone 17 Pro simulator on iOS 26.5.
The saved Argent flow `.argent/flows/ci-flakiness-relaunch.yaml` passed on the
Debug app and on the exact Release artifact from run 40322782964. An initial
Debug stress test passed 12 cycles without recording. The Release artifact
then passed 20 cycles of the original `instagram-reels-video.yml`, including
screen recording, followed by another `launchApp` and home-screen assertion:
40 launches, 20 Reels visits, and no termination failure in one session.

After the user authorized the existing iPhone 16 Pro / iOS 18.5 simulator,
verification used the same Release artifact on that original CI device/OS:

- The saved Argent flow passed, including UI state and accessibility checks.
- Twenty Reels/relaunch pairs, expressed as 40 separate top-level flows in
  one Maestro session, passed in 13m 25s. Each Reels flow included its original
  recording. This preserved the suite's per-flow lifecycle boundaries.
- The complete original suite passed all 18 flows in 5m 1s, including the
  Reels-to-instant-root transition and snapshot comparisons.

These passes do not establish an iOS fix. The app's termination failure was
not reproduced locally; the exact reason XCTest misses the process-state
transition remains unverified. The local host used macOS 26.6.2 / Xcode 27.0,
while CI used macOS 15 / Xcode 16.4.

The diagnostic wrapper passed eight device-free regression tests. A separate
65-second JVM smoke check captured a real `Thread.print` dump successfully.
The evidence is retained under
`.argent/evidence/ci-flakiness-2026-10-26/deep-dive/`, including the original
CI/local process-state comparison and the full-suite logs. Both iOS simulators
started for this investigation were shut down afterward. The Android emulator
was already running before the investigation and was left running.
