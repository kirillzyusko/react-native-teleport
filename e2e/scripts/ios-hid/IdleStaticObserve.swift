#if targetEnvironment(simulator)
// Observe the response boundary without reading or replacing its body. Native
// registration adds RPCs, but neither callback is awaited by this handler.
@MainActor
private enum TeleportStaticIdlePhase {
    static var completedInput = false
    static var staticOrdinal = 0
}

@MainActor
struct TeleportStaticIdleHTTPObserver: HTTPHandler {
    let route: Route
    let handler: HTTPHandler

    func handleRequest(_ request: FlyingFox.HTTPRequest) async throws -> FlyingFox.HTTPResponse {
        let response = try await handler.handleRequest(request)
        if response.statusCode == .ok {
            if route == .touch || route == .swipe || route == .swipeV2 {
                TeleportStaticIdlePhase.completedInput = true
            }
            if route == .isScreenStatic {
                TeleportStaticIdlePhase.staticOrdinal += 1
                let fields: [String: Any] = [
                    "version": 1, "sourceSHA": "__TELEPORT_STATIC_IDLE_SOURCE_SHA__",
                    "staticOrdinal": TeleportStaticIdlePhase.staticOrdinal,
                    "observed": TeleportStaticIdlePhase.completedInput,
                    "uptime": ProcessInfo.processInfo.systemUptime
                ]
                if let bytes = try? JSONSerialization.data(withJSONObject: fields, options: .sortedKeys),
                   let text = String(data: bytes, encoding: .utf8) {
                    NSLog("[teleport-static-idle] %@", text)
                }
                // Initial launch static requests can precede the original
                // hierarchy/input context. Do not perform another app lookup.
                if TeleportStaticIdlePhase.completedInput {
                    TeleportIdleObserveInput("isScreenStatic")
                }
            }
        }
        return response
    }
}
#endif
