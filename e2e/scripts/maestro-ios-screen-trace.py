"""Add opt-in response/byte-hash observation to pinned Simulator handlers.

This preserves capture count, PNG equality, response bytes and physical source.
It does not add synchronization or diagnose a particular frame's presentation.
"""
import hashlib
from pathlib import Path

SCREEN = 'maestro-driver-iosUITests/Routes/Handlers/ScreenDiffHandler.swift'
SHOT = 'maestro-driver-iosUITests/Routes/Handlers/ScreenshotHandler.swift'
PINNED = {SCREEN: '75d89714b1342eaf9bba9f93c5b5c079d912863c', SHOT: '432db971f7c1d1a93e2a2bf9642aaf78caa2af01'}
HELPER = Path(__file__).with_name('ios-hid') / 'ScreenTrace.swift'


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def insert_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError('Pinned frame-handler anchor differs')
    return text.replace(old, new, 1)


def patch(name, data):
    if name not in PINNED or blob(data) != PINNED[name]:
        raise ValueError('Unsupported original screen handler')
    source = data.decode()
    if name == SCREEN:
        before = '            let screenshot1 = XCUIScreen.main.screenshot()\n'
        source = insert_once(source, before, '''#if targetEnvironment(simulator)
            let traceBegin = TeleportScreenTrace.now()
#endif
''' + before)
        before = '            let screenshot2 = XCUIScreen.main.screenshot()\n'
        source = insert_once(source, before, '''#if targetEnvironment(simulator)
            let traceFirstCaptured = TeleportScreenTrace.now()
#endif
''' + before + '''#if targetEnvironment(simulator)
            let traceSecondCaptured = TeleportScreenTrace.now()
#endif
''')
        before = '            return HTTPResponse(statusCode: .ok, body: responseData)\n'
        source = insert_once(source, before, '''#if targetEnvironment(simulator)
            TeleportScreenTrace.emit([
                "route": "isScreenStatic", "begin": traceBegin,
                "firstCaptured": traceFirstCaptured, "secondCaptured": traceSecondCaptured,
                "ready": TeleportScreenTrace.now(), "isScreenStatic": isScreenStatic,
                "firstHash": TeleportScreenTrace.hex(hash1), "secondHash": TeleportScreenTrace.hex(hash2)
            ])
#endif
''' + before)
        source += HELPER.read_text()
    else:
        source = '''#if targetEnvironment(simulator)
import Foundation
import CryptoKit
#endif
''' + source
        before = '        let fullScreenshot = XCUIScreen.main.screenshot()\n'
        source = insert_once(source, before, '''#if targetEnvironment(simulator)
        let traceBegin = TeleportScreenTrace.now()
#endif
''' + before + '''#if targetEnvironment(simulator)
        let traceCaptured = TeleportScreenTrace.now()
#endif
''')
        before = '        return HTTPResponse(statusCode: .ok, body: image)\n'
        source = insert_once(source, before, '''#if targetEnvironment(simulator)
        TeleportScreenTrace.emit([
            "route": "screenshot", "begin": traceBegin, "captured": traceCaptured,
            "ready": TeleportScreenTrace.now(), "compressed": compressed,
            "byteCount": image.count, "bodyHash": TeleportScreenTrace.hex(SHA256.hash(data: image))
        ])
#endif
''' + before)
    return source.encode()
