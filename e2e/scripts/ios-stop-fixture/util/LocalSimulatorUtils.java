package util;
// Test double loaded only in the isolated verification JVM, never in Maestro.
public final class LocalSimulatorUtils {
  public static final LocalSimulatorUtils INSTANCE = new LocalSimulatorUtils();
  public static int calls;
  public static String device;
  public static String app;
  public static boolean fail;
  public LocalSimulatorUtils() { }
  public LocalSimulatorUtils(maestro.utils.TempFileHandler ignored) { }
  public void terminate(String device, String app) {
    if (fail) throw new IllegalStateException("native termination failed");
    calls++; this.device = device; this.app = app;
  }
}
