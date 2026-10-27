#if targetEnvironment(simulator)
// This opt-in observer adds asynchronous native idle notifications after the
// original input handler returns. It never awaits either notification reply.
@MainActor
struct TeleportIdleHTTPObserver: HTTPHandler {
    let route: Route
    let handler: HTTPHandler

    func handleRequest(_ request: FlyingFox.HTTPRequest) async throws -> FlyingFox.HTTPResponse {
        let response = try await handler.handleRequest(request)
        if response.statusCode == .ok && (route == .touch || route == .swipe || route == .swipeV2) {
            TeleportIdleObserveInput(route.rawValue)
        }
        return response
    }
}
#endif
