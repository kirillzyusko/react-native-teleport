"""Observe native idle callbacks without using them as a synchronization barrier.

The existing foreground hierarchy supplies the cached application process. Two
additional native notifications are registered after each completed gesture.
This diagnostic can perturb scheduling; it is never final stability evidence.
"""
import hashlib
from pathlib import Path

HEADER = 'maestro-driver-iosUITests/Categories/XCUIApplication+FBQuiescence.h'
OBJC = 'maestro-driver-iosUITests/Categories/XCUIApplication+FBQuiescence.m'
SERVER = 'maestro-driver-iosUITests/Routes/XCTestHTTPServer.swift'
HIERARCHY = 'maestro-driver-iosUITests/Routes/Handlers/ViewHierarchyHandler.swift'
PINNED = {
    HEADER: 'ef036053ee1565641c84b7dd4f42f4a0382b37c2',
    OBJC: '66f1f118bf22590097cf252fd9fe4e91fc1006f3',
    SERVER: '30874d4b493caacb0d181ffd3aa932bb2d74b484',
    HIERARCHY: '1561f4dcc7c71d2c22ecc489014a1899636505c5',
}
HELPERS = Path(__file__).with_name('ios-hid')


def helper_hash():
    return hashlib.sha256(b''.join((HELPERS / name).read_bytes() for name in
                                  ['IdleObserve.h', 'IdleObserve.m', 'IdleObserve.swift'])).hexdigest()


def native_helper():
    return (HELPERS / 'IdleObserve.m').read_text().replace('__TELEPORT_IDLE_SOURCE_SHA__', helper_hash()).encode()


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def patch(name, data):
    if name not in PINNED or blob(data) != PINNED[name]:
        raise ValueError('Unsupported original native idle observation source')
    text = data.decode()
    if name in (HEADER, OBJC):
        return data + ((HELPERS / 'IdleObserve.h').read_bytes() if name == HEADER else native_helper())
    if name == SERVER:
        before = '            await server.appendRoute(route.toHTTPRoute(), to: handler)\n'
        after = '''#if targetEnvironment(simulator)
            await server.appendRoute(route.toHTTPRoute(), to: TeleportIdleHTTPObserver(route: route, handler: handler))
#else
''' + before + '#endif\n'
        if text.count(before) != 1:
            raise ValueError('Pinned original HTTP registration differs')
        return (text.replace(before, after, 1) + (HELPERS / 'IdleObserve.swift').read_text()).encode()
    before = '            NSLog("[Done] View hierarchy snapshot for \\(foregroundApp) ")\n'
    if text.count(before) != 1:
        raise ValueError('Pinned original completed hierarchy anchor differs')
    return text.replace(before, before + '''#if targetEnvironment(simulator)
            TeleportIdleRememberApplication(foregroundApp)
#endif
''', 1).encode()
