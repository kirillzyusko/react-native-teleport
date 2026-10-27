# Simulator HID contract probe

`IndigoProbe.m` checks the persistent Indigo transport's host-side packet format
before it is connected to Maestro. It never resolves a simulator, instantiates a
HID client, or sends an event. `--fixtures` uses only owned memory;
`--inspect` loads the selected Xcode's frameworks, records Objective-C method
encodings, and invokes the packet builder without delivering its output.
The collector resolves SimulatorKit only inside the selected Xcode: the
`Developer/Library/PrivateFrameworks` location used by pinned idb, or the
`Contents/SharedFrameworks` location used by newer Xcodes. It rejects ambiguous
frameworks and links outside that Xcode, and passes both resolved binaries
explicitly to the native probe.

The dispatch-only `hid-contract` profile in `ios-e2e-test.yml` runs this probe on the same
macOS 15 / Xcode 16.4 toolchain as E2E. It preserves compiler output, framework
versions and hashes, packet bytes, and the native builder's disassembly. These
are compatibility evidence, with no stability-suite credit.

`Indigo.h`, `Mach.h`, and the single-touch envelope are from
[facebook/idb at 8b8294d4f232777ed2b6747516e2360f73475553](https://github.com/facebook/idb/tree/8b8294d4f232777ed2b6747516e2360f73475553).
The only header change is a local include for `Mach.h`. Their MIT license is
preserved in `IDB-LICENSE`. Current idb's Swift builder declares a six-argument
mouse function, whereas the older Objective-C code declares five arguments.
The probe archives non-unit-size builder output and actual SDK disassembly so
this distinction can be checked on Xcode 16.4 before injection is implemented.

The actual CI cancellation despite a 50 ms XCTest path offset is preserved in
the local campaign's `paired-stock5-recap-cancellation/analysis.json`. A path
offset is not a device-registration handshake. This probe is preparation for an
alternative transport, not a verified fix for that cancellation.

The experimental `indigo` manual profile keeps one host HID client for the
selected UDID. The Simulator-only dependency patch forwards its existing
orientation-adjusted touch points and swipe control points to an owned
loopback bridge. The helper sends native 352-byte single-touch packets from
the verified Xcode 16.4 builder, retaining its 160-byte payload stride. It
does not use the older manually constructed 320-byte envelope. The original
physical-device source is unchanged; installation still replaces only the
two Simulator resources in the guarded SDK JAR.

The helper queues the original UP before awaiting delivery acknowledgements,
propagates errors, and has no gesture replay or backend fallback. Fake native
delivery tests withhold DOWN acknowledgements until UP arrives. Bridge controls
cover sequential use of one client, concurrent-request rejection, wrong-device
rejection, native failure, and process cleanup. Runtime auditing matches every
native delivery to its request coordinates/timeline and XCTest acknowledgement;
the original full-suite, video and cancellation checks still run.

Swipe v2 has a separate `EventTarget` dispatch path which unwraps the native
record directly. The Simulator patch routes it through the same host forwarder
as touches and v1 swipes. Auditing matches every original XCTest HTTP touch and
swipe request, in order, to a native request of the same kind and its ACKs.
It requires both gesture kinds. Zero Recap records are accepted only with this
complete raw HID proof; active-contact cancellations from non-Recap digitizers
also fail the alternative transport. The default Recap gate is unchanged.

This is an experimental backend, not established stability evidence. It accepts
only the exact Xcode16.4/CoreSimulator1051.17.8 binaries captured by the CI probe.
Local SDK builds use a compiler-only deployment override for Xcode27, whose
minimum is iOS15; the bridge also passes a separate iOS14 availability check.
CI retains its original deployment target. No local device verification is
performed during these host-only checks.
