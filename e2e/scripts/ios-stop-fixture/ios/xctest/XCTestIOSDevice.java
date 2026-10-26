package ios.xctest;
// Test double loaded only in the isolated verification JVM, never in Maestro.
public final class XCTestIOSDevice {
  public int calls;
  public String app;
  public void stop(String app) { calls++; this.app = app; }
}
