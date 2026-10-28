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
The offset was intended to allow registration before DOWN; the existing
DOWN/MOVE/UP intervals and original test gestures remain unchanged. In the two
failed jobs, 227 registrations took a median 4.715 ms and a maximum 21.362 ms
from creation to attachment. This is a bounded mitigation to verify, not a
guarantee against arbitrarily long simulator stalls. A later counterexample
also disproved it for a short registration interval, as described below.

Only the dependency's required source subtree is downloaded, with Git blob
hashes checked against the pinned tree. Builds reuse
`example/ios/build/maestro-input/` incrementally without cleaning DerivedData.
Installation guards the exact official SDK JAR and replaces only its two
simulator app ZIP resources; Java classes, physical-device resources and the
existing xctestrun remain unchanged. The runtime marker verifies the rebuilt
driver was actually used. Both profiles retain the simulator-native stop
patch, all 18 original flows and both video/input checks, with no gesture or
suite retries. Initial source-build comparisons are excluded from the final
unchanged-candidate series. No final candidate is frozen yet.

The first 50 ms source-built run passed all 18 original flows and the video
check. Its raw simulator log contains 112 Recap devices, no unknown senders
and no active-contact cancellations. Installed resource digests and the
`touchLeadInSeconds=0.050` runtime marker match the preserved native build.

The paired stock trial 5 at `d3a7d5e` reproduced the Fixtures-menu tap failure
despite the verified 50 ms offset. XCTest scheduled DOWN at 0.05 s and UP at
0.15 s, yet the first actual Recap packet already carried `Touch:1` before
BackBoard attached sender `0x105421ad00006`. Service-added at 07:01:36.858 and
attached at .870 were only 12 ms apart. BackBoard created two touch-state
objects and cancelled the active contact at 07:01:37.096; the screenshot still
shows the Examples menu. The next scroll failed, leaving 17/18 flows passed.
This failure occurs before Reels and cannot be attributed to its screenshot
comparison algorithm. A path offset is not a registration handshake; increasing
it again without tracing the actual event implementation is unjustified.

The device-free `hid-contract` manual profile inspects Xcode 16.4's persistent
SimulatorKit/Indigo contract before an alternative input backend is implemented.
It uses no app, simulator, HID client, or delivered events. Details and upstream
source attribution are in `scripts/ios-hid/README.md`. This compatibility probe
is not a verified input fix and has no stability-suite credit.
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

One such capture caught `simctl privacy` taking 80.036 seconds in the second
flow, before Reels. Every sampled worker frame waits for
`SimDevice.hostSupportPortWithError → lookup → SimServiceContext.sendRequest`
through synchronous XPC. No stderr write is blocked in that capture. It does
not establish why the service delayed its reply or prove that the earlier
five-minute failure has the same server-side wait.

For a uniquely identified CoreSimulatorService on a GitHub-hosted guest, the
collector now captures the service's stack and recent PID-scoped host logs
concurrently with the stalled client. It rechecks the service's path, PID and
owner before sampling. Developer and self-hosted machines are excluded.
The first server capture caught a 32.822-second privacy command; 200 service
samples waited in `SimLaunchHostClient.findServiceInSession →
SimLaunchHostConnection.sendMessageSyncWithReply`. A second guest captured the
same service-side chain during 49.585- and 31.062-second commands. These guests
have no periodic device `launchctl` probes. The wait has therefore been traced
to SimLaunchHost, but the reason it does not reply remains unresolved.

Diagnostics now sample a unique same-owner hosted SimLaunchHost concurrently
with the service and client. The selected simulator's `launchd_sim` is eligible
only through the parentage of a runtime daemon identified by its scoped log
stream, with both process identities rechecked. A global launchd name search
is insufficient. These are read-only, bounded captures; no service is restarted.

A later capture reached `launch_sim_spawn → launch_mig_bridge_spawn` on
SimLaunchHost's serial queue for the selected simulator. It did not identify
which operation owned that spawn. Maestro also owned a `simctl log stream` in
that guest, but its stack was missing. During a long client capture, diagnostics
now also sample that sibling if two current identity reads confirm the same
Maestro JVM parent, user, executable, explicit simulator UDID and `spawn … log
stream` arguments. Other devices, other parents and non-hosted machines are
excluded. No extra device command is issued. This closes an observation gap;
it does not establish that log streaming caused the lookup wait.

Hosted samples also record the front application ASN through the read-only
`lsappinfo -names front` command. The observed output does not resolve the
application name, so it cannot establish Simulator/Java focus. Existing JVM
dumps show AppKit and Metal
rendering threads, but whether that contributes to the native delay is unproven.
Periodic iOS `simctl spawn … launchctl list` probes are removed so that process
observation does not add repeated device RPCs. Android's process snapshots
remain available for the adbd/zombie verification. This is a diagnostics
change; the flows, permissions, app startup and timeouts are unchanged.

- Stream native logs independently of Maestro.
- Sample host processes/memory every 15 seconds and Android device processes.
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

## Android SDK-only click diagnostics

The manual `input-trace-sdk` profile runs the original 18 flows and mandatory
video checks with application input hooks disabled. It patches only Maestro
2.10.0's isolated `UiDeviceExt` DEX. After the original `clickNoSync` returns,
it records its aggregate Boolean, coordinates and a post-call uptime under the
`MaestroNativeInput` log tag. DOWN, the existing 100 ms hold, UP and their
control flow remain unchanged. No event is replayed. A true result reports API
acceptance, not application delivery; false does not identify which event failed.

The builder verifies Apktool 3.0.1, the original APK, source and foreground
instrumentation class, preserves all other DEX/resources and SDK JAR entries,
and verifies the signed APK and disassembly roundtrip. The key is Maestro's
pinned public upstream debug fixture, with the original SDK certificate.
Unsupported input fails before replacing the private CI dependency.

On the first post-click SDK marker, bounded read-only commands hash the selected
emulator's installed server APK and confirm its package path before and after.
This happens during the session because `AndroidDriver.close` can uninstall the
server. No manual installation or application launch is added. The audit checks
raw installed-APK identity, source/DEX provenance and every CLI tap coordinate
against the native JSON sequence. Missing records, rejected input, enabled app
hooks or mismatched APKs fail the diagnostic gate. These runs always have zero
final stability credit. Runtime delivery is unverified until an actual CI pilot
has passed these checks; the offline assembly alone does not diagnose a missed tap.

## Native iOS screen-response observation

The opt-in `indigo-touch-trace` profile keeps the corrected persistent input
transport and original 18 flows/video checks. Its name excludes the run from
final stability counts. It instruments only the Simulator SDK handlers;
application sources and physical-device handler sources remain unchanged.

`ScreenDiffHandler` records the actual `isScreenStatic` Boolean, the two existing
PNG hashes and monotonic capture/response preparation times. `ScreenshotHandler`
records the hash and size of exactly the PNG/JPEG bytes it returns. These are
content identities, not display transaction IDs or JavaScript commit timestamps.
The diagnostic performs no additional screenshot, accessibility query, wait or
RPC. The original equality test, capture count, encodings and response bodies
remain intact. The ordinary profiles do not include this instrumentation.

Successful diagnostic jobs must match every native HTTP static/screenshot route
to an ordered trace record, verify the original equality against its hashes,
and match every saved `takeScreenshot` PNG to an uncompressed native response.
The artifact includes these PNGs and the pinned original/patched handler sources.
All original input, termination, image-comparison, video and Node gates remain.
A passing diagnostic establishes observation coverage; it does not prove that
an animation finished or fix premature settling.

The first frame-observed cohort captured another `lifecycle` failure. The actual
post-tap response was `isScreenStatic=true`, with identical PNG hashes from two
captures 139 ms apart. The next exact screenshot response, captured 152 ms after
the second static capture, showed a visibly incomplete navigation transition.
The saved PNG's hash matches that response. Its original comparison failed at
0.711%, while the later diagnostic image was aligned and differed by 0.074%
under the same 0.3% limit. The original test remains failed. This confirms a
premature settling signal; it does not identify the application/compositor pause
or establish that another native idle API would fix it.

### Native idle notification observation

The separate `indigo-idle-touch-trace` diagnostic registers XCTest event-loop and
animation-idle notifications after the original input handler returns. It reuses
the application/process already resolved by the original hierarchy request,
without another foreground, state, running, launch or AX query. Notification
registration adds native RPCs and can itself take time; its begin/return times
are recorded. Neither reply is awaited, and replies do not change a response or
the original PNG equality decision. The original CLI deadlines stay intact.

The captured Xcode 16.4 arm64 binary's callback descriptor has one `NSError`
parameter. Its older class-dump header declares a different callback signature
and is not used. Runtime method encodings and the loaded arm64 XCTest image UUID
are checked before invoking it.
Every completed HTTP gesture must have two actual typed nil-error replies with
matching process, selected Simulator and source identities. Missing, rejected,
duplicate or invalid notifications fail the diagnostic evidence gate. At most
four pairs can remain outstanding; the observer introduces no reply wait, timer,
gesture replay or fallback. Physical sources and all existing suite/input/video
gates remain intact. Fixture sources/results are archived with the driver.

The first real CI probe completed all 18 flows and 224 typed nil-error callbacks
for 112 gestures. This validates the API observer, not a settling fix. In its
`go_next` transition, both callbacks had completed at uptime 800.293936, while
two later original static checks still captured different PNG contents at
800.519119–800.628473 and 800.790175–800.886719. Post-input idle notifications
alone therefore do not certify subsequent visual stability.

The separate `indigo-static-idle-touch-trace` profile observes a later boundary.
It wraps the original static handler and registers fresh notifications after
that handler has constructed its response. It returns the same opaque response,
without reading its body, awaiting a reply, taking another screenshot or changing
the existing PNG comparison. Static requests before the first original input
are explicitly marked and do not cause a new app lookup. All subsequent static
responses and all original gestures require ordered native registration/reply
proof. A separate audit correlates later screenshot capture-return times with
outstanding fresh notifications. This remains diagnostic evidence: nil replies
are not display transaction IDs or JavaScript commit timestamps, and registration
RPCs can perturb timing. No synchronization barrier is enabled.

The report correlates unchanged native static responses with notification reply
times. A nil reply alone is not proof of a presented frame. This is an explicit
diagnostic with zero final stability credit; actual runtime callback behavior
must be reviewed before using these notifications for synchronization.

The fresh-static pilot passed all 18 application flows and mandatory video, but
failed its diagnostic gate. After an original app restart, it registered two
notifications against the old cached PID; both returned `NSCocoaErrorDomain 4099`.
The next original hierarchy request refreshed the process and subsequent replies
succeeded. This is a diagnostic context-lifetime bug, and the job remains failed.
Separately, three actual static-true responses with two fresh nil replies were
followed by changing original static captures before another gesture. Existing
hierarchy queries intervened; neither query causation nor the underlying rendering
pause has been established. No idle barrier is enabled.

### Application event, mount and presentation measurements

`indigo-visual-touch-trace` uses the original persistent input and frame-response
observers without the private idle-notification observers. Its explicit builder
applies a pinned example-app patch only for this diagnostic. Ordinary builds keep
the original application sources. Local preparation restores only its own verified
changes; restoration refuses unrelated edits. Original flows, screenshot limits,
video requirements, input timing and configured deadlines remain unchanged.

The app records native UP dispatch timestamps, coordinates and ancestor test IDs;
original `go_next` and `persisted_portal_toggle_host` handlers forward their exact
event once and retain their return/error behavior. JavaScript records handler
entry/exit, React layout effects and native-stack transition event receipts.
The existing Fabric surface presenter supplies mount callbacks through an
observer. A bounded three-second display-link observation records the target's
ancestor presentation-layer frames. It adds no UI input, screenshot, accessibility
query, app prelaunch, synchronization wait or native idle RPC.

The first runtime trace reached the original navigation handler and second-screen
React layout effect, but screenshot equality returned true before an unfinished
navigation screenshot failed the original assertion. Its mount logger also failed:
the linked presenter implements the observer methods without runtime adoption of
the stub protocol declared in its header category. The diagnostic now checks the
two observer method encodings on that same cached object and invokes their typed
implementations. Host fixtures use the actual class shape, reject incorrect method
signatures and nil objects, and verify observer removal on replacement. This repairs
measurement setup; it does not synchronize navigation or fix the visual failure.

These boundaries have different meanings. A layout effect is not a native mount;
a transition event received in JavaScript is not the native completion instant;
CADisplayLink and presentation-layer samples are not physical display transactions.
The native UP and JS event timestamps share the original touch identity, while
wall and monotonic clocks retain their own labels. Logging and sampling can change
scheduling, so every result has zero final stability credit.

Native and JS buffers have explicit bounds. Large native records use bounded,
hashed log chunks; missing chunks, overflow or malformed identities fail the
measurement gate. The build archives pinned original/patched sources and compiled
helper fingerprints. Actual runtime records identify the selected Simulator, PID,
source, application executable and JS bundle. The gate independently matches both
selected JS handlers to native UPs and requires layout, mount, transition and
presentation coverage alongside every original input/frame/video gate. A sampling
window interrupted by an original app exit is reported only with matching raw
process-exit evidence. It is not reported as a completed presentation window.

Generic compilation and host fixtures validate source/API access, disabled behavior,
exact handler forwarding, bounds and log decoding. A subsequent original-suite
pilot observed 20 real presenter attachments and 15 mount callback pairs, passed
all 18 flows and the mandatory video check. It validates the repaired diagnostic;
it implements no synchronization fix and earns no final stability credit.

The first application-trace pilot stopped before compilation or UI tests: the
preparer compared the dependency-generated Xcode project with its Git bytes.
That job logged React Native enabling ccache. Its actual changed project was
not uploaded because the guard failed before creating the evidence directory;
the raw build log is preserved, but the full remote project diff is unavailable.

A local invocation of the pinned React Native ccache mutator reproduces the
rejection. The corrected preparer accepts only its exact five compiler/cache
settings in the two pinned project configurations. Removing those ten generated
lines must recover the exact original project SHA, and after adding the trace
source it must recover the exact pinned patched SHA. The generated settings stay
intact; every other project byte and application-source pin remains checked.
Different compilers, cache paths, deployment targets, configurations or source
references fail the gate. Observed inputs are now archived before validation so
an unexpected generated project can be reviewed even when preparation fails.

### Existing static PNG body archive

The separate `archive_frames` workflow input defaults to false and is accepted only
for one `indigo-visual-touch-trace` trial with one-pass comparison. It uses the same
app patch, JavaScript handlers, Indigo backend and frame observer. It enables no
private idle RPCs or synchronization barrier.

The SDK retains each of the two PNG values already encoded for the original static
hash comparison. Each original screenshot and encoding still runs once, in the
same order. A separate Simulator-only helper submits those existing bytes to a
serial background writer after constructing the original response body. Equality,
HTTP response bytes, physical-device source and every original test assertion and
deadline remain unchanged. No additional screenshot, accessibility query, app query,
input, encoding, retry, sleep or reply wait is added. File I/O and retained data can
change scheduling, so this archive remains diagnostic evidence with zero credit.

The writer permits at most 1,024 pairs, 16 MiB per PNG, 256 MiB total and eight
pending pairs. Rejection, write error, missing file or mismatched identity fails the
evidence gate. The post-test collector accepts only the selected runner PID's
logged temporary directory inside its own app container on the selected Simulator.
It checks the container's bundle identity, refuses links and path escapes, and
copies only the named PNG files. It invokes no device APIs and does not wait for
unfinished writes. Sources, runtime markers, every original static response and
copied PNG bytes are independently compared before qualification.

The first archive pilot passed the original 18 flows and mandatory video, but its
collector failed before reading files: two background save messages were interleaved
with request logging in XCTest stdout. The existing unified log retained all 471
complete queued/saved pairs. Its compact presentation also escaped a JSON backslash
as `\134`; decoding that one layer reproduces the independently captured root
record exactly. This is a diagnostic transport failure, not an application UI
failure or evidence of a fixed log-size limit. The required PNG files were never
collected, so that job remains failed with zero credit.

The collector now reads body messages from that already captured unified stream,
while the original static-response gate continues reading XCTest stdout. It strictly
decodes the compact presentation layer and binds the source hashes, process prefix,
PID, helper and selected Simulator. Malformed, duplicate or missing unified records
still fail. There is no fallback that drops broken rows. Captured transport fixtures
retain the failed stdout records and verify that they remain rejected. SDK producer,
app, captures, file limits and original assertions are unchanged; corrected live
file collection still requires its own fresh diagnostic pilot.

The corrected transport pilot also passed the original 18 flows and mandatory
video. It exposed a second diagnostic error: the normal driver teardown uninstalled
the SDK runner before post-test collection, so its original data container was
already absent. All 451 queued/saved metadata pairs were complete; no compared PNG
files were collected. That job remains failed with zero credit.

With the archive explicitly enabled, the existing live log callback now forwards
its raw chunks to one owned host file exporter. Each saved record triggers a copy
of only its two already-written PNG files, while the selected runner's container
still exists. The exporter retains the exact source, PID, UDID, MCM container and
file identities, hashes, PNG checks and bounds. It adds no device query, screenshot,
encoding, input or test wait, and leaves the original SDK uninstall in place.
Input buffering is bounded; overflow, early exit or missing files fail evidence.
After the original test and log stream finish, stdin EOF stops the exporter.
Post-test finalization and the independent gate compare its complete source rows,
process receipt and every preserved byte against the original raw responses.
Generated filesystem controls remove the source container after export and verify
the surviving files; these controls are separate from actual CI runtime proof.

Earlier premature-equality failures did not retain the two compared PNG bodies.
The passing mount-observer pilot also returned differing PNG hashes after observed
mount callbacks and a JavaScript transition-end receipt. Those API-return times
do not identify capture transactions, and the missing bodies prevent interpreting
their visual contents. Archiving the existing bytes closes that evidence gap; it
does not establish screenshot caching, native transition completion or physical
display timing.

### Indigo host helper teardown

A later independent archive trial failed before running the app suite. The host
bridge's mocked fatal-delivery test reached `process.kill(-child.pid, "SIGKILL")`
and failed with `EPERM` during cleanup. The log identifies that call; it does not
capture the helper's process-group or permission state at the instant of failure.
The SDK artifact contains the compiled driver but lacks the later required
controls, and no App artifact or UI runtime evidence was published. The run stays
failed with zero credit.

The helper already exits when its stdin reader reaches EOF. Bridge teardown now
ends stdin and awaits the existing child-close event, including when a fatal
protocol response arrives before Node reports process exit. It does not restart
the helper, replay input or alter gesture acknowledgements. Normal completion
requires no signal. Only a helper that remains alive during teardown receives
SIGTERM after five seconds and SIGKILL after seven; each signal requires a fresh
exact PID, parent, UID and full-command check and targets that PID alone. Failure
to establish ownership or close within nine seconds fails teardown. These are
post-test host cleanup bounds, not UI settling waits or assertion deadlines.

A device-free regression injects the observed EPERM at the old process-group
signal call, fails against the old code and passes through EOF with the correction.
Separate controls verify normal EOF, rejected foreign process identities and a
deliberately hung owned helper's two independently validated fallback signals.
The original fatal-delivery, no-replay, coordinate, timing and acknowledgement
controls remain required. This corrects host cleanup and provides no application
synchronization or final stability credit.

### Native launcher identities

One original eighteen-flow archive suite passed its assertions and video check,
but its first simulator-native stop took 52.77 seconds and reported "found nothing
to terminate." The guest termination request appeared 52.635 seconds after the
host command began. No PID-matched app exit/notification chain was available, so
the original termination evidence gate remains failed. These timestamps do not
identify the cause of the host wait.

A saved host process table contained a Maestro-owned `bash` child with an
`xcodebuild` child during that interval. Their arguments were not captured. The
existing observer selects direct Maestro-owned `simctl` processes and therefore
missed that branch. This does not prove that the branch performed the pending
stop or that Maestro's command helper wraps commands in a shell.

`TELEPORT_IOS_LAUNCHER_OBSERVE=1` enables passive identity capture only in the
hosted iOS visual diagnostic profile. Other scopes reject the opt-in; the default
path does not import the observer or create its files. On the existing host
sampling cadence, a unique current Maestro JVM → `/bin/bash` → selected Xcode
`xcodebuild` shape causes one combined `ps` query for those three PIDs. Fresh
PID, parent, UID, elapsed age and complete executable/argument rows must agree.
The observer makes no device call, changes no input, adds no sampling timer and
does not signal the observed native processes. It captures identities rather
than adding native stack profilers.

Each branch is queried once, with at most 64 observations and 128 KiB of identity
data per observation. The existing collector retains raw command output even
when identity validation or the size bound fails. A separate mandatory diagnostic
check validates source snapshots, exact raw bytes, command completion and every
parent/owner edge; missing or changed evidence fails that check. An empty set of
observed branches is recorded without claiming that no host wait occurred.

This closes an argument-capture gap. It provides no app synchronization fix,
changes no original assertion or deadline, and grants no final stability credit.
