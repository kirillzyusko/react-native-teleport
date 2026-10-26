import device.IOSDevice;
import device.SimctlIOSDevice;
import ios.LocalIOSDevice;
import ios.xctest.XCTestIOSDevice;
import java.lang.reflect.Proxy;
import maestro.utils.NoopInsights;
import util.LocalSimulatorUtils;

// Run against the real official LocalIOSDevice and the installed simulator
// controller, replacing only XCTest and the OS-command helper with counters.
public final class VerifyIOSStopRouting {
  public static void main(String[] args) {
    boolean patched = args[0].equals("patched");
    var xctest = new XCTestIOSDevice();
    var nativeHelper = LocalSimulatorUtils.INSTANCE;
    var simulator = new SimctlIOSDevice("fixture-simulator", new maestro.utils.TempFileHandler());
    var local = new LocalIOSDevice("fixture-simulator", xctest, simulator, NoopInsights.INSTANCE);
    local.stop("teleport.example");
    check(nativeHelper.calls == (patched ? 1 : 0), "simulator native routing");
    check(xctest.calls == (patched ? 0 : 1), "simulator XCTest routing");
    if (patched) {
      check(nativeHelper.device.equals("fixture-simulator"), "selected simulator forwarded");
      check(nativeHelper.app.equals("teleport.example"), "bundle id forwarded");
      nativeHelper.fail = true;
      try { local.stop("teleport.example"); throw new AssertionError("native error hidden"); }
      catch (IllegalStateException error) { check(error.getMessage().equals("native termination failed"), "native error preserved"); }
      nativeHelper.fail = false;
      try { local.stop(null); throw new AssertionError("null accepted"); }
      catch (NullPointerException expected) { }
    }
    int[] physicalCalls = {0};
    IOSDevice physical = (IOSDevice) Proxy.newProxyInstance(IOSDevice.class.getClassLoader(),
        new Class<?>[]{IOSDevice.class}, (proxy, method, values) -> {
          if (method.getName().equals("stop")) physicalCalls[0]++;
          return null;
        });
    var physicalXCTest = new XCTestIOSDevice();
    new LocalIOSDevice("fixture-physical", physicalXCTest, physical, NoopInsights.INSTANCE).stop("teleport.example");
    check(physicalCalls[0] == 0 && physicalXCTest.calls == 1, "physical XCTest fallback preserved");
    System.out.println("PASS " + args[0] + ": routing verified; no native commands or device interaction");
  }
  private static void check(boolean valid, String message) {
    if (!valid) throw new AssertionError(message);
    System.out.println("verified " + message);
  }
}
