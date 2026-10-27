# Native CI failures

Investigation on October 26, 2026, using the full reports from runs
[40322782964 (iOS)](https://github.com/kirillzyusko/react-native-teleport/actions/runs/40322782964/job/121576416070)
and [39647963672 (Android)](https://github.com/kirillzyusko/react-native-teleport/actions/runs/39647963672/job/119391639099).
Both used Maestro 2.10.0. Their first failures happen during `launchApp`, before
the supposedly failing example is opened.

Test jobs explicitly select Node from `.nvmrc`, matching the app-build and local
environment. The earlier macOS runner used Node 22.23.2 for the diagnostics and
snapshot server while the project pins 20.19.4. This is an environment pin,
not an explanation for the native failures below.

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

The next diagnostic batch reproduced the original fatal signature. In run
40357432025, trial 1, termination started at 16:37:06.596 UTC and SpringBoard
received the app's exit at 16:37:06.649. XCTest still timed out at 16:38:07.210
with `Failed to terminate teleport.example:12041: Failed to terminate
teleport.example:0`, ending the HTTP-server test. Sixteen remaining flows failed.

The kernel snapshot at 16:37:15.645–18.745 shows the `runningboardd` death-handler
thread at priority 4 (base 4), runnable for 9.005 seconds before the first sample
and still runnable throughout the capture. It was not sampled waiting on a
mutex. Apple's [scheduler definitions](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/sched.h)
and [QoS mapping](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/thread_policy.c)
associate priority 4 with the background/maintenance band. Other runnable
threads in this process showed the same delay. Memory pressure remained at
normal level 1, with only 0.19 MB swap used during the fatal wait.

Re-reporting that same saved capture in timeline format exposes the policy:
`process darwinbg`, `thread darwinbg`, and effective thread QoS `background`.
The death-handler thread requested `utility`; other affected threads requested
`user initiated`, but the process-wide policy clamped them to background.
This is recorded kernel state, not a policy inferred from the user-space stack.
The report does not identify who applied that policy or why runnable work
received no CPU during the captured interval.

Host process samples show substantial Spotlight and diagnostic-log CPU use.
In the unfiltered simulator log, `apsd` produced 29,255 of 31,992 lines between
16:37:00 and 16:37:19. The captured runnable delay establishes a scheduling
problem during this failure; it does not yet prove which competing service or
policy caused it. Profiling itself can affect timing.

Manual iOS dispatch retains `baseline` and `apsd-stopped` comparison profiles.
The latter stops only `apsd` in the
selected simulator after validating its namespace and executable path, using
the same SIGSTOP operation as [yeetd](https://github.com/biscuitehh/yeetd/blob/main/yeetd/main.swift).
Keyboard-controller already enables yeetd's `killapsd` setting. The experiment
keeps all test flows, the app, Maestro version, and diagnostic collection
identical. This is a causal experiment, not a claimed fix; it also disables
simulated push-service behavior, which would matter to push-notification tests.
The original supplied failure has the same log storm without the additional
diagnostics: `apsd` produced 37,459 of 41,324 lines during 12:49:36–55 UTC.

All three `apsd-stopped` trials passed, and their artifacts confirm the
selected service remained stopped with zero sampled CPU use. Diagnostic-log
CPU use dropped substantially, but termination still took 35.084 and 21.076
seconds in the first two trials; the third reached 6.039 seconds. Their kernel captures again show runnable background-priority RBS
threads. Stopping `apsd` alone therefore does not remove the observed mechanism.

The remaining stalls include substantial host Spotlight activity, including
multiple `mdworker_shared` processes. A separate `no-spotlight` profile disables
host indexing with `mdutil` before downloading the app and preparing the
simulator, preserving before/after indexing status. It leaves `apsd` running
and changes no test flow. All three independent trials passed the 18 original
flows and glitch checks. Their 60 termination calls took at most 2.066, 3.018,
and 4.080 seconds per trial. Indexing was confirmed disabled while `apsd`
remained active. The baseline arm of the earlier `apsd` comparison also passed
three suites, but one retained a 17.083-second termination. These small batches
does not establish final stability or identify who applied the background policy.

Maestro previously stopped simulator apps through `simctl`.
[PR #2374](https://github.com/mobile-dev-inc/Maestro/pull/2374) changed that
routing to XCTest in March 2025. The current simulator controller still
implements native termination, including its handling of an already-stopped
app and command failures.

The `native-driver` default and `simctl-stop` control use that existing backend
while leaving host services unchanged. A fingerprint-guarded patch adds only this
branch to `LocalIOSDevice.stop`: use the native controller when it is a
`SimctlIOSDevice`; retain the original XCTest path for other controllers.
No app prelaunch or per-flow CLI session is added. The installer verifies
that no other JAR entry changed and preserves patch metadata and disassembly.
Isolated JVM checks against the official 2.10.0 class verified the original
and changed simulator routing, selected device/app arguments, error
propagation, null rejection, and the unchanged physical-controller fallback.
They execute no device commands and run again against CI's installed classes.

All three independent native-stop trials passed the 18 original flows and
glitch checks, with 20 native terminations each and no XCTest app-termination
calls. Their maximum stop durations were 5.798, 3.495, and 3.270 seconds.
The same-commit stock control also passed three suites, with maxima of 1.076,
1.115, and 1.101 seconds. These batches establish that the alternative works
with the original suite; they do not establish a lower failure rate.

The candidate removes the `XCUIApplication.terminate()` call in which the
original fatal failure was reproduced after the app had exited. It leaves
physical-device routing intact and preserves native command failures.
Push, pull-request, and default manual runs apply this temporary pinned
dependency patch. The `baseline`, `apsd-stopped`, and `no-spotlight` controls
keep the stock stop route; the `recap-source` control uses native termination.
The final unchanged-candidate series remains a separate verification step.

### Confirmed additional touch-delivery failure

Candidate `9f7d071` failed the third iOS trial in `bottom-sheet` while the
remaining 17 flows passed. Both open operations and the normal Close tap
succeeded. After the existing three-second rightward gesture on Close, the
sheet remained visible and the final `assertNotVisible` failed. The driver
remained reachable throughout the following flows.

The recorded swipe went from `(201, 591)` to `(361, 591)`. The failure's
accessibility hierarchy placed Close at `[16,583][386,600]`, containing both
points; the screenshot shows the sheet still open. The existing artifacts
do not record the React press state machine or which press callback ran.
The native delivery failure was identified later in the simulator log below.

The same candidate later failed `nested-stack-pop` before entering its fixture.
The screenshot and hierarchy still show the initial Demos/Fixtures menu after
the scroll command timed out. Maestro selected Fixtures at `[8,169][394,218]`
and sent `/touch` to `(201,193)`; XCTest completed the tap without an error.
The app did not open Fixtures, so scrolling could not find `nested_stack_pop`.
No portal is involved in this menu button. Temporary buffered Pressability
tracing was used during diagnosis and removed after the native failure was
identified; the example app and original test flows require no changes.

Both UI failures have the same native cause: XCTest's new Recap digitizer was
not registered when its first touch arrived. For each failed gesture, BackBoard
records an unknown sender and then cancels a still-touching contact from that
same sender when the digitizer disappears. The contact targets
`teleport.example-default`; XCTest nevertheless completes the request.

- BottomSheet: sender `0x1017221c00005`, unknown at `20:14:58.076570`, active
  contact cancelled at `20:15:01.290446`.
- Fixtures: sender `0x10532b750003f`, unknown at `21:59:37.735217`, active
  contact cancelled at `21:59:37.964565`.

This matches [Maestro #3686](https://github.com/mobile-dev-inc/Maestro/issues/3686).
The native collector now includes `backboardd`, and
`check-ios-touch-cancellations.mjs` checks sender-matched active-contact
cancellations. Empty-contact teardown and an unknown sender without a
cancelled contact are accepted. The checker identified exactly the two failed
gestures across the 36 captured flow logs, without flagging their other 34
flows. Its JSON report is retained with native diagnostics.

The `native-driver` default builds the pinned Maestro 2.10 XCTest dependency
at commit `14a408335e17a090df1e26bdbeaf80d8122a8fd8` with a 50 ms first-path
offset. The `recap-source` control builds the same source with a zero offset.
The offset provides time for digitizer registration before DOWN; the existing
DOWN/MOVE/UP intervals and original test gestures remain unchanged. In the two
failed jobs, 227 registrations took a median 4.715 ms and a maximum 21.362 ms
from creation to attachment. This is a bounded mitigation to verify, not a
guarantee against arbitrarily long simulator stalls.

Only the dependency's required source subtree is downloaded, with Git blob
hashes checked against the pinned tree. Builds reuse
`example/ios/build/maestro-input/` incrementally without cleaning DerivedData.
Installation guards the exact official SDK JAR and replaces only its two
simulator app ZIP resources; Java classes, physical-device resources and the
existing xctestrun remain unchanged. The runtime marker verifies the rebuilt
driver was actually used. Both profiles retain the simulator-native stop
patch, all 18 original flows and both video/input checks, with no gesture or
suite retries. Initial source-build comparisons are excluded from the final
unchanged-candidate series; final verification uses the default profile.

The first 50 ms source-built run passed all 18 original flows and the video
check. Its raw simulator log contains 112 Recap devices, no unknown senders
and no active-contact cancellations. Installed resource digests and the
`touchLeadInSeconds=0.050` runtime marker match the preserved native build.
This establishes that the rebuilt runner works with the suite; the final
stability series remains separate.

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

- A local JVM probe using the unmodified `AndroidDriver.class`, byte-identical
  to the official 2.10.0 class, immediately
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
remains the default mode. Focused probes do not need FFmpeg or the snapshot
engine and skip their installation. The original Android rerun spent over
30 minutes downloading FFmpeg dependencies from `azure.archive.ubuntu.com`
before it reached the emulator or Maestro. That observed setup delay is
separate from the watchdog failure during tests.

The focused CI comparison used the same commit and API 31 setup. The stock
driver retained one zombie under `adbd` and failed after 707 seconds when
`adbd` changed from PID 458 to 12885. The foreground variant kept PID 458,
had no zombie children, produced screenshots through 732 seconds, and closed
successfully. Both jobs denied unprivileged `dmesg`, so this new comparison
does not contain the watchdog's kill message; that message is present in the
original supplied CI failure. Later captures try emulator `su` after the test,
without restarting `adbd`, and record guest uptime alongside host timestamps.
The second stock probe again lost `adbd` after about 700 seconds. Its privileged
kernel capture confirms PID 458 received SIGKILL at guest uptime 1200.925 and
the zombie shell was reaped immediately afterward. The live logcat reader also
disconnects with `adbd`, so diagnostics now read retained lifecycle messages
through the new daemon after the test; kernel output alone does not identify
the sender of that signal.

The retained-buffer capture in the third stock probe identifies the sender
in a fresh CI execution, not the cached AVD's historical logs:

```text
10-26 17:32:29.547 W livelock: Z 600.000s 458->11941->11941 [sh] [kill]
10-26 17:32:29.547 I livelock: Killing '/apex/com.android.adbd/bin/adbd' (458)
```

That is run 40365711624, job 121726807405, within the recorded current test
window. The real driver then observed the changed `adbd` PID and failed.

The ordinary Android suite now applies that same single-constant change to
the installed Maestro client JAR before running the existing CLI command.
`scripts/patch-maestro-instrumentation.py` accepts only the pinned 2.10.0
class fingerprint, verifies the rewritten archive, and records both class
hashes in `maestro-patch.json`. It changes no other JAR entry or driver APK.
This is a temporary dependency patch pending an upstream release containing
the fix. Full-suite candidate verification is separate from the focused probe.
All five ordinary CLI candidate jobs passed 18/18 flows and glitch checks in
7m12s–7m43s. Each retained `adbd` PID 458 with no zombie children across the
captured snapshots and recorded the expected installed patched-class fingerprint.
These five suites precede the final unchanged-candidate verification series.

## Separate Android setup delay: FFmpeg package downloads

The FFmpeg installation can take much longer than the emulator and test suite.
The original baseline downloaded 63.3 MB in 25 minutes 43 seconds; the seventh
input-trace trial downloaded 71.3 MB in 11 minutes 7 seconds. Both fetched
package indexes quickly, then downloaded archives from
`azure.archive.ubuntu.com` slowly. These delays precede emulator startup.

[runner-images #14823](https://github.com/actions/runner-images/issues/14823)
tracks the same slow archive transfers. The runner's apt timeout only covers
stalled connections, so a slow transfer can continue without mirror failover.
The FFmpeg step removes the Azure entry from the runner's mirror list before
installation, leaving the standard Ubuntu archive and security mirrors. It
also logs the selected mirrors and installed FFmpeg version. This addresses
the observed setup delay; it does not explain the missed Android menu tap.

## Why keyboard-controller behaves differently

Keyboard-controller uses [Detox](https://github.com/kirillzyusko/react-native-keyboard-controller/blob/main/e2e/package.json),
with test retries and different simulator preparation. Teleport uses Maestro's
XCTest HTTP server on iOS and its UiAutomation/ADB driver on Android. A similar
runner size does not imply the same automation lifecycle or failure behavior.

## Diagnostics

### iOS screenshot comparison control

The iOS workflow accepts `comparison=paired` to run `stock` and `one-pass`
variants on independent guests using the same app and input-driver artifacts.
Both keep the original 18 flows, recording checks, driver configuration and
timeouts. The variants have separate concurrency groups and artifact names.
This is a diagnostic comparison, not final stability verification.

In failing native-driver trial 27, a requested 2000 ms animation wait took
631 seconds. Three JVM captures show
`ImageComparison.createRectangle → populateRectangles → compareImages`.
The dependency scans the entire difference matrix once for each region.
`patch-maestro-image-comparison.py` replaces only the private bounds collector
with one matrix pass, retaining the original grouping, region order, filtering,
merging, rendering and difference metric. It rejects an unknown dependency
class and verifies that every other field, method and JAR entry is unchanged.

`test-maestro-image-comparison.py` compares the original and patched class on
125 deterministic public-configuration and edge cases, checking state, exact
float bits, ordered rectangles and rendered ARGB hashes. Optional captured
frames add four controls. The paired CI runs execute this contract before
installing the optimized class. The local controls establish equivalence and
reduced CPU time, but do not establish the cause of subsequent native
`simctl` or recording delays.

`image-comparison-fixture/ScreenshotWaitRepro.java` is a standalone runnable
reproduction: an instant mock Driver supplies generated 1206×2622 images with
2550 separate changed regions to the actual pinned `ScreenshotUtils`.
No app, device or saved media is required. On the measured host the requested
2000 ms wait returned `false` after 11.8 seconds with the original collector
and after 2.24 seconds with the one-pass collector. The existing timer still
checks between iterations; the change reduces the expensive iteration's work.
This does not guarantee a strict deadline for arbitrary inputs or slow drivers.

With JDK 17 or later, point `TELEPORT_MAESTRO_LIB` at the pinned Maestro 2.10.0
distribution's `lib` directory and `TELEPORT_PROBE_DIR` at a scratch output
directory, then run:

```sh
python3 e2e/scripts/test-maestro-image-comparison.py \
  "$TELEPORT_MAESTRO_LIB/image-comparison-4.4.0.jar" "$TELEPORT_PROBE_DIR" \
  --reproduce-wait
```

The command first checks the same 125 exact comparison contracts and then
records both screenshot-wait timings. Timing is diagnostic output; it is not
an assertion about the host's speed. The installed distribution is preserved.
The optional workload is not added to the normal paired-CI contract step.

### Android menu tap after the foreground-instrumentation patch

The unchanged `2bdf4eb` candidate failed trial 14 before entering the stable
host remount fixture. The other 17 original flows passed. `adbd` retained PID
458 without zombie children, and the expected foreground patch was installed.
Maestro aimed at `(540, 1512)` inside the enabled `stable_host_remount` bounds
`[21,1445][1059,1580]` and reported the tap complete. The failure screenshot
and accessibility tree still show the Fixtures list, so the following
`repro_run` lookup failed. The fixture itself was not entered.

Those logs do not show whether the injected events reached the application,
whether React granted or cancelled the responder, or whether `onPress` ran.
They do not establish a cause for this separate failure.

The manual Android `input-trace` mode runs the same complete suite and required
video checks, with no retries or flow edits. Only this profile builds with
`-PteleportInputTrace=true`. Its example app records DOWN/UP/CANCEL delivery,
queue age, current scroll offsets and the result of the original activity
dispatch call. Buffered JavaScript logs record the matching menu item's
Pressability state, region and `onPress` callback. The original dispatch and
callback execute once with unchanged arguments; the recorder does not consume
events or add waits. The ordinary build leaves this tracing disabled.

Trace version 2 also records the visible scroll container's bounds, whether it
contains the event point, and passive React ScrollView drag/momentum/scroller
state before and after dispatch. Available private fields are listed in the
installation marker; missing fields are reported as unavailable. These reads
do not advance or stop the scroller. They are intended to distinguish a
native scroll interception from missing injection or React responder delivery
when a missed tap is captured; they do not establish that cause by themselves.

The trace gate requires both native and JavaScript installation markers and
native input delivery, and rejects recording errors or buffer overflow.
These diagnostic runs are excluded from final stability counts. The hosted
API 31 guest ended with its job, and no Android device was running locally
when checked through Argent, so this new failure is being investigated on CI.

The manual `input-repeat` profile focuses on that same original
`navigation-view-ownership.yml`: each fresh trial executes it 20 times in a
fixed Maestro `repeat` block, stopping on the first failure. The generated
wrapper is included in native diagnostics. The imported flow keeps all three
app launches, navigation interactions and assertions unchanged. It runs with
the same input tracing and foreground instrumentation patch. Its trace gate
also requires 20 matching target callbacks. The original 18-flow
diagnostic series continues separately; this focused profile does not
run the Reels recording or contribute to final full-suite counts.

Both native workflows run the existing suite through `scripts/native-diagnostics.mjs`:

Each diagnostic command and the test launcher own a process group. If the
workflow shell exits without forwarding a signal, the wrapper detects the
parent change, interrupts the test group, and kills remaining descendants
after a two-second cleanup interval. This handles the observed trial-40 case
where the shell died at the step deadline but Maestro and collectors kept
running during artifact upload. Collector groups also stop when their launcher
exits, including descendants that ignore a closed output pipe. Mock-command
integration checks reproduce the old orphan and verify cleanup and exit codes.
For a direct Maestro-owned `simctl privacy`, `terminate`, or `launch` process
seen across samples for over 15 seconds, diagnostics also record its arguments,
native stack and open descriptors. This is intended to identify the native
wait behind the later five-minute command timeouts; no service or command is
restarted by the collector.

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

The first attempt of each iOS service-comparison run failed before obtaining a
runner, with zero executed steps. GitHub's annotations say `The job was not
acquired by Runner of type hosted even after multiple attempts` and explicitly
mention macOS arm64 capacity constraints. These are separate setup failures.
The same-commit setup was resubmitted; those reruns are excluded from the final
independent clean-series counts, and the original annotations are preserved.

Manual dispatch accepts a trial count of 1, 3, 5, 20, or 60, with at
most two running concurrently per platform. A small planning job generates
the matrix, and the application is built once for the whole series.
Android's focused lifecycle modes always select a single trial.
Each test job uses a fresh hosted
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

These local passes do not establish an iOS fix. The app's termination failure
was reproduced later on CI, where the kernel capture recorded runnable
background-priority notification work. The local host used macOS 26.6.2 / Xcode 27.0,
while CI used macOS 15 / Xcode 16.4.

The diagnostic wrapper passed nine device-free regression tests. A separate
65-second JVM smoke check captured a real `Thread.print` dump successfully.
The evidence is retained under
`.argent/evidence/ci-flakiness-2026-10-26/deep-dive/`, including the original
CI/local process-state comparison and the full-suite logs. Both iOS simulators
started for this investigation were shut down afterward. The Android emulator
was already running before the investigation and was left running.
