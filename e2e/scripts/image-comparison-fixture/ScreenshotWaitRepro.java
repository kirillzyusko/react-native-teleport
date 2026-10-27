import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.lang.management.ManagementFactory;
import java.lang.reflect.Proxy;
import javax.imageio.ImageIO;
import maestro.Driver;
import maestro.utils.ScreenshotUtils;
import okio.Buffer;
import okio.Sink;

// Actual Maestro utility with instant in-memory screenshots. No device or app.
public final class ScreenshotWaitRepro {
  static byte[] png(BufferedImage image) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    ImageIO.write(image, "png", output);
    return output.toByteArray();
  }

  public static void main(String[] args) throws Exception {
    BufferedImage empty = new BufferedImage(1206, 2622, BufferedImage.TYPE_INT_RGB);
    BufferedImage pattern = new BufferedImage(1206, 2622, BufferedImage.TYPE_INT_RGB);
    int regions = 0;
    for (int y = 8; y < 2614; y += 35) {
      for (int x = 8; x < 1198; x += 35) {
        for (int dy = 0; dy < 4; dy++) for (int dx = 0; dx < 4; dx++) {
          pattern.setRGB(x + dx, y + dy, 0xffffff);
        }
        regions++;
      }
    }
    byte[][] images = {png(empty), png(pattern)};
    int[] screenshots = {0};
    Driver driver = (Driver) Proxy.newProxyInstance(Driver.class.getClassLoader(),
      new Class<?>[]{Driver.class}, (proxy, method, parameters) -> {
        if (!method.getName().equals("takeScreenshot")) throw new AssertionError(method.getName());
        byte[] bytes = images[screenshots[0]++ % 2];
        ((Sink) parameters[0]).write(new Buffer().write(bytes), bytes.length);
        return null;
      });
    long wall = System.nanoTime();
    long cpu = ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime();
    boolean result = ScreenshotUtils.Companion.waitUntilScreenIsStatic(2000L, 0.3, driver);
    System.out.printf(java.util.Locale.ROOT,
      "{\"requested_ms\":2000,\"wall_ms\":%.3f,\"thread_cpu_ms\":%.3f,\"regions\":%d,\"screenshots\":%d,\"result\":%s}%n",
      (System.nanoTime()-wall)/1e6,
      (ManagementFactory.getThreadMXBean().getCurrentThreadCpuTime()-cpu)/1e6,
      regions,screenshots[0],result);
  }
}
