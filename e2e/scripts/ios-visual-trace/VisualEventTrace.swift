import UIKit
import React
import CryptoKit
import ObjectiveC

// Explicit CI measurement only. UIKit callbacks and presentation-layer samples
// are observations, not a certificate that a frame has reached the display.
final class VisualEventTrace: NSObject, RCTSurfacePresenterObserver {
  static let shared = VisualEventTrace()
  private static let helperSHA = "__TELEPORT_VISUAL_NATIVE_SHA__"
  private static let outputQueue = DispatchQueue(label: "teleport.visual-event-trace.output", qos: .utility)
  static var enabled: Bool {
    Bundle.main.object(forInfoDictionaryKey: "TeleportVisualTrace") as? Bool == true
  }

  private let sourceSHA = Bundle.main.object(
    forInfoDictionaryKey: "TeleportVisualTraceSourceSHA"
  ) as? String ?? ""
  private var records: [[String: Any]] = []
  private var flushScheduled = false
  private var sequence = 0
  private var gesture = 0
  private var installed = false
  private weak var presenter: RCTSurfacePresenterStub?
  private var displayLink: CADisplayLink?
  private var sampleUntil: Double = 0
  private var sampledViews: [WeakView] = []
  private var sampleRole = ""
  private var sampleGesture = 0
  private var sampleCount = 0

  private struct WeakView {
    weak var view: UIView?
    let name: String
  }

  func install() {
    guard Self.enabled, !installed else { return }
    installed = true
    guard let original = class_getInstanceMethod(UIApplication.self, #selector(UIApplication.sendEvent(_:))),
      let replacement = class_getInstanceMethod(UIApplication.self, #selector(UIApplication.visualTraceSendEvent(_:)))
    else {
      emit("setup.error", ["reason": "UIApplication.sendEvent method unavailable"])
      return
    }
    method_exchangeImplementations(original, replacement)
    emit("installed", ["buffered": true, "sampleWindowSeconds": 3])
    let source = sourceSHA
    Self.outputQueue.async {
      func digest(_ url: URL?) -> String {
        guard let url, let data = try? Data(contentsOf: url) else { return "" }
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
      }
      let fields: [String: Any] = [
        "version": 1, "phase": "runtime.identity", "sourceSHA": source, "helperSHA": Self.helperSHA,
        "pid": ProcessInfo.processInfo.processIdentifier,
        "simulatorUDID": ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "",
        "wallTimeMs": Date().timeIntervalSince1970 * 1000,
        "uptime": ProcessInfo.processInfo.systemUptime,
        "executableSHA256": digest(Bundle.main.executableURL),
        "jsBundleSHA256": digest(Bundle.main.url(forResource: "main", withExtension: "jsbundle"))
      ]
      Self.write([fields])
    }
  }

  func attachFactory(_ factory: NSObject?) {
    guard Self.enabled else { return }
    let selector = NSSelectorFromString("reactHost")
    guard let factory,
      let method = class_getInstanceMethod(type(of: factory), selector),
      let encoding = method_getTypeEncoding(method), String(cString: encoding) == "@16@0:8",
      let host = factory.perform(selector)?.takeUnretainedValue() as? NSObject
    else {
      emit("setup.error", ["reason": "Original root-view factory cached ReactHost unavailable"])
      return
    }
    attachHost(host)
  }

  private func attachHost(_ host: NSObject?) {
    guard Self.enabled else { return }
    // RCTHost's existing public cached getter returns a C++-declared class.
    // The Objective-C stub protocol avoids exposing that class to Swift.
    let selector = NSSelectorFromString("surfacePresenter")
    guard let host,
      let method = class_getInstanceMethod(type(of: host), selector),
      let encoding = method_getTypeEncoding(method), String(cString: encoding) == "@16@0:8",
      let next = host.perform(selector)?.takeUnretainedValue() as? RCTSurfacePresenterStub
    else {
      emit("setup.error", ["reason": "Original ReactHost cached surface presenter unavailable"])
      return
    }
    attachPresenter(next)
  }

  private func attachPresenter(_ next: RCTSurfacePresenterStub?) {
    guard Self.enabled else { return }
    guard let next else {
      emit("setup.error", ["reason": "Original ReactHost surface presenter unavailable"])
      return
    }
    presenter?.remove(self)
    presenter = next
    next.add(self)
    emit("mount.observer.installed")
  }

  func willMountComponents(withRootTag rootTag: Int) {
    if Self.enabled, displayLink != nil { emit("fabric.willMount", ["rootTag": rootTag]) }
  }

  func didMountComponents(withRootTag rootTag: Int) {
    if Self.enabled, displayLink != nil { emit("fabric.didMount", ["rootTag": rootTag]) }
  }

  // The selected UP is recorded only after the original dispatch returns.
  func dispatched(_ touches: [UITouch], before: Double, after: Double) {
    guard Self.enabled else { return }
    for touch in touches {
      gesture += 1
      let point = touch.location(in: nil)
      var views: [WeakView] = []
      var cursor = touch.view
      var identifiers: [String] = []
      while let view = cursor, views.count < 16 {
        let identifier = view.accessibilityIdentifier ?? ""
        if !identifier.isEmpty { identifiers.append(identifier) }
        views.append(WeakView(view: view, name: NSStringFromClass(type(of: view))))
        cursor = view.superview
      }
      emit("touch.up.dispatched", [
        "gesture": gesture, "touchTimestampMs": touch.timestamp * 1000,
        "x": point.x, "y": point.y, "dispatchBegin": before,
        "dispatchReturned": after, "identifiers": identifiers
      ])
      guard let role = identifiers.first(where: {
        $0 == "go_next" || $0 == "persisted_portal_toggle_host"
      }) else { continue }
      if displayLink != nil { finishSamples("superseded") }
      sampledViews = views
      sampleRole = role
      sampleGesture = gesture
      sampleCount = 0
      sampleUntil = ProcessInfo.processInfo.systemUptime + 3
      emit("presentation.begin", ["gesture": gesture, "role": role])
      let link = CADisplayLink(target: self, selector: #selector(samplePresentation(_:)))
      displayLink = link
      link.add(to: .main, forMode: .common)
    }
  }

  @objc private func samplePresentation(_ link: CADisplayLink) {
    sampleCount += 1
    let layers: [[String: Any]] = sampledViews.enumerated().compactMap { index, entry in
      guard let view = entry.view else { return nil }
      let presentation = view.layer.presentation()
      let layer = presentation ?? view.layer
      let frame = layer.frame
      let values = [frame.minX, frame.minY, frame.width, frame.height]
      guard values.allSatisfy({ $0.isFinite }) else { return nil }
      return ["index": index, "class": entry.name, "frame": values,
              "opacity": layer.opacity, "presentationLayer": presentation != nil]
    }
    emit("presentation.sample", [
      "gesture": sampleGesture, "role": sampleRole, "sample": sampleCount,
      "displayLinkTimestamp": link.timestamp, "targetTimestamp": link.targetTimestamp,
      "layers": layers
    ])
    if ProcessInfo.processInfo.systemUptime >= sampleUntil || sampleCount >= 512 {
      finishSamples(sampleCount >= 512 ? "sample.bound" : "window.end")
    }
  }

  private func finishSamples(_ reason: String) {
    displayLink?.invalidate()
    displayLink = nil
    emit("presentation.end", [
      "gesture": sampleGesture, "role": sampleRole, "samples": sampleCount, "reason": reason
    ])
    sampledViews = []
  }

  private func emit(_ phase: String, _ details: [String: Any] = [:]) {
    precondition(Thread.isMainThread)
    sequence += 1
    var record = details
    record.merge([
      "version": 1, "phase": phase, "sourceSHA": sourceSHA, "helperSHA": Self.helperSHA,
      "sequence": sequence, "pid": ProcessInfo.processInfo.processIdentifier,
      "simulatorUDID": ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "",
      "wallTimeMs": Date().timeIntervalSince1970 * 1000,
      "uptime": ProcessInfo.processInfo.systemUptime
    ]) { _, new in new }
    if records.count < 4096 {
      records.append(record)
    } else if records.last?["phase"] as? String != "buffer.overflow" {
      record["phase"] = "buffer.overflow"
      records.append(record)
    }
    if !flushScheduled {
      flushScheduled = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [self] in
        let batch = records
        records = []
        flushScheduled = false
        Self.outputQueue.async { Self.write(batch) }
      }
    }
  }

  private static func write(_ batch: [[String: Any]]) {
    for record in batch {
      guard let data = try? JSONSerialization.data(withJSONObject: record, options: .sortedKeys),
        let text = String(data: data, encoding: .utf8) else { continue }
      if data.count <= 800 {
        NSLog("[teleport-visual-native] %@", text)
        continue
      }
      // Bound each log message independently of the simulator's string limit.
      // The raw checker must reconstruct and hash every chunked record.
      let encoded = data.base64EncodedString()
      let count = (encoded.count + 511) / 512
      guard count <= 32 else {
        NSLog("[teleport-visual-encoding-error] record exceeded bounded log envelope")
        continue
      }
      let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
      for index in 0..<count {
        let begin = encoded.index(encoded.startIndex, offsetBy: index * 512)
        let end = encoded.index(begin, offsetBy: min(512, encoded.distance(from: begin, to: encoded.endIndex)))
        let chunk: [String: Any] = [
          "version": 1, "pid": record["pid"] ?? 0, "recordSHA256": digest,
          "part": index, "parts": count, "payload": String(encoded[begin..<end])
        ]
        if let bytes = try? JSONSerialization.data(withJSONObject: chunk, options: .sortedKeys),
          let line = String(data: bytes, encoding: .utf8) {
          NSLog("[teleport-visual-native-chunk] %@", line)
        }
      }
    }
  }
}

extension UIApplication {
  @objc fileprivate func visualTraceSendEvent(_ event: UIEvent) {
    let ended = Array(event.allTouches ?? []).filter { $0.phase == .ended }
    guard !ended.isEmpty else {
      visualTraceSendEvent(event)
      return
    }
    let before = ProcessInfo.processInfo.systemUptime
    visualTraceSendEvent(event)
    let after = ProcessInfo.processInfo.systemUptime
    if !ended.isEmpty { VisualEventTrace.shared.dispatched(ended, before: before, after: after) }
  }
}
