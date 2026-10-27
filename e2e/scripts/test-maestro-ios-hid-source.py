"""Guarded source/physical-route controls using the preserved pinned SDK input."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

spec = importlib.util.spec_from_file_location(
    "maestro_input", Path(__file__).with_name("maestro-ios-input.py"))
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
artifact = Path(os.environ.get("MAESTRO_INPUT_SOURCE_ARTIFACT", "example/ios/build/maestro-input/artifact"))


def physical(source):
    result, states = [], []
    for line in source.decode().splitlines(keepends=True):
        if line.strip() == "#if targetEnvironment(simulator)":
            states.append(False)
        elif line.strip() == "#else" and states:
            states[-1] = True
        elif line.strip() == "#endif" and states:
            states.pop()
        elif all(states):
            result.append(line)
    return "".join(result).rstrip()


class SourceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.event = (artifact / "EventRecord.original.swift").read_bytes()
        cls.runner = (artifact / "RunnerDaemonProxy.original.swift").read_bytes()
        cls.swipe_v2 = (Path("example/ios/build/maestro-input/source") / builder.SWIPE_V2_FILE).read_bytes()
        if builder.blob_hash(cls.swipe_v2) != builder.SWIPE_V2_BLOB:
            cls.swipe_v2 = (artifact / "SwipeRouteHandlerV2.original.swift").read_bytes()

    def test_pinned_hashes_and_unchanged_physical_source(self):
        event, runner = builder.patch_indigo_source(self.event, self.runner)
        self.assertEqual(physical(event), self.event.decode().rstrip())
        self.assertEqual(physical(runner), self.runner.decode().rstrip())
        self.assertEqual(event.count(b"teleportGesture ="), 2)
        self.assertEqual(runner.count(b"TeleportSimulatorHID.send"), 1)

    def test_altered_inputs_are_rejected(self):
        for event, runner in [(self.event + b"\n", self.runner), (self.event, self.runner + b"\n")]:
            with self.assertRaisesRegex(RuntimeError, "Unsupported pinned"):
                builder.patch_indigo_source(event, runner)

    def test_v2_swipe_reaches_forwarder_and_preserves_physical_dispatch(self):
        patched = builder.patch_indigo_swipe_v2(self.swipe_v2)
        self.assertEqual(physical(patched), self.swipe_v2.decode().rstrip())
        simulator = patched.decode().split("#if targetEnvironment(simulator)")[1].split("#else")[0]
        self.assertIn(".addSwipeEvent(start: startPoint, end: endPoint, duration: request.duration)", simulator)
        self.assertIn("RunnerDaemonProxy().synthesize(eventRecord: eventRecord)", simulator)
        self.assertNotIn("EventTarget()", simulator)
        with self.assertRaisesRegex(RuntimeError, "Unsupported pinned"):
            builder.patch_indigo_swipe_v2(self.swipe_v2 + b"\n")

    def test_original_recap_patch_unchanged(self):
        self.assertEqual(builder.sha256(builder.patch_event_record(self.event, "0.05")),
                         "4564d948a7832020703dea00de5e6bdc100a31297d9e1b52cd83ac04836ac22d")

    def test_install_rejects_wrong_backend_before_touching_sdk(self):
        with tempfile.TemporaryDirectory(prefix="teleport-hid-install-") as tmp:
            folder = Path(tmp)
            (folder / "maestro-ios-input.json").write_text(json.dumps({
                "status": "built", "source_commit": builder.SOURCE_COMMIT,
                "lead_in_seconds": 0, "backend": "indigo"}))
            with self.assertRaisesRegex(RuntimeError, "backend does not match"):
                builder.install(SimpleNamespace(jar=folder / "absent.jar", artifact=folder,
                                                expected_lead_in="0", expected_backend="recap"))


if __name__ == "__main__":
    unittest.main()
