#if targetEnvironment(simulator)
import Foundation
import CryptoKit

// Explicit diagnostic only. Archive the data already used by the original hash
// comparison; this helper never captures, encodes or waits for a screenshot.
enum TeleportFrameBodyArchive {
    private static let helperSHA = "__TELEPORT_FRAME_BODY_SHA__"
    private static let shared = Store(
        root: FileManager.default.temporaryDirectory.appendingPathComponent(
            "teleport-frame-bodies-\(ProcessInfo.processInfo.processIdentifier)-\(UUID().uuidString)"
        )
    )

    struct Limits {
        let pairs: Int
        let pngBytes: Int
        let totalBytes: Int
        let pendingPairs: Int

        static let production = Limits(
            pairs: 1024, pngBytes: 16 * 1024 * 1024,
            totalBytes: 256 * 1024 * 1024, pendingPairs: 8
        )

        var fields: [String: Int] {
            ["pairs": pairs, "pngBytes": pngBytes,
             "totalBytes": totalBytes, "pendingPairs": pendingPairs]
        }
    }

    static func submit(
        first: Data, second: Data, firstHash: String, secondHash: String,
        firstReturned: Double, secondReturned: Double, isScreenStatic: Bool
    ) {
        shared.submit(
            first: first, second: second, firstHash: firstHash, secondHash: secondHash,
            firstReturned: firstReturned, secondReturned: secondReturned,
            isScreenStatic: isScreenStatic
        )
    }

    final class Store {
        private let root: URL
        private let limits: Limits
        private let queue = DispatchQueue(label: "teleport.frame-bodies.output", qos: .utility)
        private let lock = NSLock()
        private var attempted = 0
        private var acceptedBytes = 0
        private var pending = 0
        private var failed = false
        // Only the serial writer accesses this field.
        private var initialized = false

        init(root: URL, limits: Limits = .production) {
            precondition(limits.pairs > 0 && limits.pngBytes > 0 &&
                         limits.totalBytes > 0 && limits.pendingPairs > 0)
            self.root = root
            self.limits = limits
        }

        func submit(
            first: Data, second: Data, firstHash: String, secondHash: String,
            firstReturned: Double, secondReturned: Double, isScreenStatic: Bool
        ) {
            lock.lock()
            attempted += 1
            let ordinal = attempted
            var rejection = ""
            if failed {
                rejection = "previous_error"
            } else if first.isEmpty || second.isEmpty || first.count > limits.pngBytes ||
                        second.count > limits.pngBytes {
                rejection = "png_bytes"
            } else if ordinal > limits.pairs {
                rejection = "pair_count"
            } else if first.count + second.count > limits.totalBytes ||
                        acceptedBytes > limits.totalBytes - first.count - second.count {
                rejection = "total_bytes"
            } else if pending >= limits.pendingPairs {
                rejection = "pending_pairs"
            }
            if !rejection.isEmpty {
                failed = true
                lock.unlock()
                Self.emit("rejected", ["ordinal": ordinal, "reason": rejection])
                return
            }
            acceptedBytes += first.count + second.count
            pending += 1
            let outstanding = pending
            lock.unlock()

            Self.emit("queued", [
                "ordinal": ordinal, "firstHash": firstHash, "secondHash": secondHash,
                "firstBytes": first.count, "secondBytes": second.count,
                "firstReturned": firstReturned, "secondReturned": secondReturned,
                "isScreenStatic": isScreenStatic, "pendingPairs": outstanding
            ])
            queue.async { [self] in
                defer {
                    lock.lock()
                    pending -= 1
                    lock.unlock()
                }
                do {
                    if !initialized {
                        try FileManager.default.createDirectory(
                            at: root, withIntermediateDirectories: true,
                            attributes: [.posixPermissions: 0o700]
                        )
                        initialized = true
                        Self.emit("initialized", ["root": root.path, "limits": limits.fields])
                    }
                    let signature = Data([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
                    guard first.starts(with: signature), second.starts(with: signature),
                          Self.sha(first) == firstHash, Self.sha(second) == secondHash else {
                        markFailure()
                        Self.emit("write.error", ["ordinal": ordinal, "reason": "original_png_identity"])
                        return
                    }
                    let firstName = String(format: "pair-%06ld-first.png", ordinal)
                    let secondName = String(format: "pair-%06ld-second.png", ordinal)
                    let firstURL = root.appendingPathComponent(firstName)
                    let secondURL = root.appendingPathComponent(secondName)
                    guard !FileManager.default.fileExists(atPath: firstURL.path),
                          !FileManager.default.fileExists(atPath: secondURL.path) else {
                        markFailure()
                        Self.emit("write.error", ["ordinal": ordinal, "reason": "existing_pair"])
                        return
                    }
                    try first.write(to: firstURL, options: .atomic)
                    try second.write(to: secondURL, options: .atomic)
                    Self.emit("saved", [
                        "ordinal": ordinal, "firstFile": firstName, "secondFile": secondName,
                        "firstHash": firstHash, "secondHash": secondHash,
                        "firstBytes": first.count, "secondBytes": second.count
                    ])
                } catch {
                    markFailure()
                    let error = error as NSError
                    Self.emit("write.error", [
                        "ordinal": ordinal, "reason": "filesystem",
                        "errorDomain": error.domain, "errorCode": error.code
                    ])
                }
            }
        }

        private func markFailure() {
            lock.lock()
            failed = true
            lock.unlock()
        }

        private static func sha(_ data: Data) -> String {
            SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        }

        private static func emit(_ phase: String, _ details: [String: Any]) {
            var fields = details
            fields.merge([
                "version": 1, "phase": phase, "helperSHA": TeleportFrameBodyArchive.helperSHA,
                "pid": ProcessInfo.processInfo.processIdentifier,
                "simulatorUDID": ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "",
                "uptime": ProcessInfo.processInfo.systemUptime,
                "wallTime": Date().timeIntervalSince1970
            ]) { _, new in new }
            guard let data = try? JSONSerialization.data(withJSONObject: fields, options: .sortedKeys),
                  let message = String(data: data, encoding: .utf8) else { return }
            NSLog("[teleport-frame-bodies] %@", message)
        }
    }
}
#endif
