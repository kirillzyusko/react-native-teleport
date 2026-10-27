"""Device-free checks for the two Xcode framework layouts and rejection rules."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "inspect_ios_hid", Path(__file__).with_name("inspect-ios-hid.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class FrameworkLayoutTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="teleport-hid-layout-")
        self.root = Path(self.temporary.name)
        self.developer = self.root / "Xcode.app/Contents/Developer"
        self.developer.mkdir(parents=True)

    def tearDown(self):
        self.temporary.cleanup()

    def binary(self, folder):
        folder.mkdir(parents=True)
        (folder / "SimulatorKit").write_bytes(b"fixture only; never executed")
        return folder

    def test_xcode16_idb_location(self):
        folder = self.binary(self.developer / "Library/PrivateFrameworks/SimulatorKit.framework")
        self.assertEqual(probe.simulator_kit(self.developer)[0], folder)

    def test_new_xcode_location(self):
        folder = self.binary(self.developer.parent / "SharedFrameworks/SimulatorKit.framework")
        self.assertEqual(probe.simulator_kit(self.developer)[0], folder)

    def test_missing_framework_rejected(self):
        with self.assertRaisesRegex(RuntimeError, "found 0"):
            probe.simulator_kit(self.developer)

    def test_two_distinct_frameworks_rejected(self):
        self.binary(self.developer / "Library/PrivateFrameworks/SimulatorKit.framework")
        self.binary(self.developer.parent / "SharedFrameworks/SimulatorKit.framework")
        with self.assertRaisesRegex(RuntimeError, "found 2"):
            probe.simulator_kit(self.developer)

    def test_aliases_of_same_framework_accepted(self):
        folder = self.binary(self.developer / "Library/PrivateFrameworks/SimulatorKit.framework")
        alias = self.developer.parent / "SharedFrameworks/SimulatorKit.framework"
        alias.parent.mkdir()
        alias.symlink_to(folder, target_is_directory=True)
        self.assertEqual(probe.simulator_kit(self.developer)[0].resolve(), folder.resolve())

    def test_other_xcode_link_rejected(self):
        other = self.binary(self.root / "OtherXcode.app/SimulatorKit.framework")
        alias = self.developer / "Library/PrivateFrameworks/SimulatorKit.framework"
        alias.parent.mkdir(parents=True)
        alias.symlink_to(other, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, "outside the selected Xcode"):
            probe.simulator_kit(self.developer)


if __name__ == "__main__":
    unittest.main()
