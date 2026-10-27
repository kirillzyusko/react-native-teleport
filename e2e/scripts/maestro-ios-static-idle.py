"""Add fresh native idle observations after the existing static response.

This is an explicit diagnostic extension of the pinned input observer. The
opaque original HTTP response is returned unchanged and no callback is awaited.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('static_idle_base', SCRIPTS / 'maestro-ios-idle-observe.py')
BASE = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BASE)
HELPER = SCRIPTS / 'ios-hid/IdleStaticObserve.swift'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def helper_hash():
    return sha(HELPER.read_bytes())


def patch(original, intermediate):
    if intermediate != BASE.patch(BASE.SERVER, original):
        raise ValueError('Post-static observation requires the exact pinned input observer')
    before = 'to: TeleportIdleHTTPObserver(route: route, handler: handler))'
    after = 'to: TeleportStaticIdleHTTPObserver(route: route, handler: TeleportIdleHTTPObserver(route: route, handler: handler)))'
    text = intermediate.decode()
    if text.count(before) != 1:
        raise ValueError('Unexpected original observer registration')
    helper = HELPER.read_text().replace('__TELEPORT_STATIC_IDLE_SOURCE_SHA__', helper_hash())
    return (text.replace(before, after, 1) + helper).encode()


def source_audit(artifact):
    folder = Path(artifact)
    metadata = json.loads((folder / 'maestro-ios-input.json').read_text())
    observed = metadata.get('idle_static_observation', {})
    original = (folder / 'idle-XCTestHTTPServer.swift.original').read_bytes()
    intermediate = (folder / 'idle-XCTestHTTPServer.swift.patched').read_bytes()
    expected = patch(original, intermediate)
    errors = []
    if observed != {'version': 1, 'helper_sha256': helper_hash(),
                    'intermediate_sha256': sha(intermediate), 'patched_sha256': sha(expected)}:
        errors.append('Post-static native observation identity differs')
    if (folder / 'IdleStaticObserve.swift').read_bytes() != HELPER.read_bytes():
        errors.append('Post-static wrapper source differs')
    if (folder / 'idle-static-XCTestHTTPServer.swift.patched').read_bytes() != expected:
        errors.append('Post-static final HTTP server source differs')
    return errors
