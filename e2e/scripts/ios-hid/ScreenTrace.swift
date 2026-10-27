#if targetEnvironment(simulator)
// Opt-in Simulator diagnostics. Hashes identify captured bytes, not a display
// transaction or JavaScript commit. Logging neither waits nor captures a frame.
@MainActor
enum TeleportScreenTrace {
    private static var sequence = 0

    static func now() -> TimeInterval {
        ProcessInfo.processInfo.systemUptime
    }

    static func hex<T: Sequence>(_ bytes: T) -> String where T.Element == UInt8 {
        bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func emit(_ fields: [String: Any]) {
        sequence += 1
        var record = fields
        record["sequence"] = sequence
        record["version"] = 1
        record["wallTime"] = Date().timeIntervalSince1970
        guard let bytes = try? JSONSerialization.data(withJSONObject: record, options: .sortedKeys),
              let text = String(data: bytes, encoding: .utf8) else { return }
        NSLog("[teleport-screen-trace] %@", text)
    }
}
#endif
