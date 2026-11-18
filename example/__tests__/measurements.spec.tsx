import { renderAsync, screen, userEvent } from "@testing-library/react-native";
import { Platform } from "react-native";

import Messenger from "../src/screens/Messenger";

jest.mock("lottie-react-native", () => "LottieView");
jest.mock("../src/components/BlurView", () => "BlurView");
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

afterEach(() => {
  jest.restoreAllMocks();
});

jest.useFakeTimers();

describe.each(["android", "ios"] as const)("Messenger on %s", (platform) => {
  it("keeps the message at its measured window position when teleported", async () => {
    jest.replaceProperty(Platform, "OS", platform);

    await renderAsync(<Messenger />);

    // Supply the native measurement through the host instances in the RN Jest preset.
    screen.UNSAFE_root.findAll((node) =>
      jest.isMockFunction(node.instance?.measureInWindow),
    ).forEach((node) => {
      node.instance.measureInWindow.mockImplementation(
        (callback: (x: number, y: number) => void) => callback(16, 120),
      );
    });

    const user = userEvent.setup();

    await user.press(screen.getByLabelText("Animated message"));

    expect(screen.getByLabelText("Animated message")).toHaveStyle({
      paddingTop: 120,
    });
  });
});
