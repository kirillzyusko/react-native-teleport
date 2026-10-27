#if targetEnvironment(simulator)
enum TeleportSimulatorHID {
    static func send(_ gesture: [String: Any]) async throws {
        guard let udid = ProcessInfo.processInfo.environment["SIMULATOR_UDID"] else {
            throw NSError(domain: "TeleportSimulatorHID", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Simulator UDID unavailable"])
        }
        var body = gesture
        body["deviceUDID"] = udid
        var request = URLRequest(url: URL(string: "http://127.0.0.1:47655/gesture")!)
        request.httpMethod = "POST"
        request.timeoutInterval = 60
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response): (Data, URLResponse) = try await withCheckedThrowingContinuation { continuation in
            URLSession.shared.dataTask(with: request) { data, response, error in
                if let error = error {
                    continuation.resume(throwing: error)
                } else if let data = data, let response = response {
                    continuation.resume(returning: (data, response))
                } else {
                    continuation.resume(throwing: NSError(domain: "TeleportSimulatorHID", code: 3,
                        userInfo: [NSLocalizedDescriptionKey: "Native HID response unavailable"]))
                }
            }.resume()
        }
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let result = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              result["type"] as? String == "delivered",
              let action = result["action"] as? Int,
              let acknowledged = result["acknowledged"] as? Int else {
            throw NSError(domain: "TeleportSimulatorHID", code: 2,
                          userInfo: [NSLocalizedDescriptionKey:
                            "Native HID delivery failed: \(String(data: data, encoding: .utf8) ?? "invalid response")"])
        }
        NSLog("[teleport-maestro-input] backend=indigo action=%d acknowledged=%d", action, acknowledged)
    }
}
#endif
