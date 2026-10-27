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
