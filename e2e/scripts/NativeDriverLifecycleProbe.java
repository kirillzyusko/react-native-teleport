import java.time.Instant;
import maestro.android.AndroidDeviceConnection;
import maestro.drivers.AndroidDriver;
import maestro.drivers.LocaleRetryPolicy;
import maestro.utils.MetricsProvider;
import okio.Buffer;

/** Keep the real Maestro 2.10.0 driver alive past llkd's 600-second limit. */
public final class NativeDriverLifecycleProbe {
  public static void main(String[] args) throws Exception {
    String serial = args[0];
    boolean foreground = args[1].equals("foreground-driver");
    AndroidDeviceConnection connection =
        AndroidDeviceConnection.Companion.byId(serial, "localhost", 7001);
    if (connection == null) throw new IllegalStateException("CI emulator unavailable: " + serial);
    AndroidDriver driver = new AndroidDriver(connection, serial, true,
        MetricsProvider.INSTANCE.getInstance(), new LocaleRetryPolicy());
    String originalAdbd = null;
    long started = System.nanoTime();
    try {
      driver.open();
      started = System.nanoTime();
      for (;;) {
        long elapsed = (System.nanoTime() - started) / 1_000_000_000L;
        String rows = connection.shell("ps -A -o PID,PPID,S,NAME,ARGS").getOutput();
        String adbd = null;
        for (String row : rows.split("\n")) {
          String[] cells = row.trim().split("\\s+", 5);
          if (cells.length >= 4 && cells[3].equals("adbd")) adbd = cells[0];
        }
        if (adbd == null) throw new IllegalStateException("adbd disappeared\n" + rows);
        boolean firstSnapshot = originalAdbd == null;
        if (firstSnapshot) originalAdbd = adbd;
        if (!originalAdbd.equals(adbd)) {
          throw new IllegalStateException("adbd restarted: " + originalAdbd + " -> " + adbd);
        }
        int zombies = 0;
        for (String row : rows.split("\n")) {
          String[] cells = row.trim().split("\\s+", 5);
          if (cells.length >= 4 && cells[1].equals(adbd) && cells[2].equals("Z")) {
            zombies++;
            System.out.println("adbd zombie child: " + row);
          }
        }
        System.out.println(Instant.now() + " elapsed=" + elapsed
            + "s adbd=" + adbd + " zombieChildren=" + zombies);
        if (foreground && zombies != 0) {
          throw new IllegalStateException("Foreground instrumentation left a zombie under adbd");
        }
        if (!foreground && firstSnapshot && zombies == 0) {
          throw new IllegalStateException("Stock driver did not reproduce the zombie shell");
        }
        try (Buffer screenshot = new Buffer()) {
          driver.takeScreenshot(screenshot, false);
          if (screenshot.size() == 0) throw new IllegalStateException("Empty screenshot");
          System.out.println("Screenshot bytes=" + screenshot.size());
        }
        if (elapsed >= 720) break;
        Thread.sleep(15_000);
      }
      System.out.println("PASS: real driver remained reachable for at least 720 seconds");
    } catch (Exception failure) {
      System.err.println("FAIL after " + ((System.nanoTime() - started) / 1_000_000_000L) + "s");
      failure.printStackTrace();
      throw failure;
    } finally {
      driver.close();
    }
  }
}
