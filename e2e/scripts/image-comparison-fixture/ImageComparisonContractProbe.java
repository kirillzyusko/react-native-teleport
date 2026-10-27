import java.awt.image.BufferedImage;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import javax.imageio.ImageIO;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.romankh3.image.comparison.ImageComparison;
import com.github.romankh3.image.comparison.model.Rectangle;
import com.github.romankh3.image.comparison.model.ImageComparisonResult;

public final class ImageComparisonContractProbe {
    static String digest(BufferedImage image) throws Exception {
        if (image == null) return "null";
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        ByteBuffer row = ByteBuffer.allocate(image.getWidth() * 4);
        for (int y = 0; y < image.getHeight(); y++) {
            row.clear();
            for (int x = 0; x < image.getWidth(); x++) row.putInt(image.getRGB(x, y));
            sha.update(row.array());
        }
        return HexFormat.of().formatHex(sha.digest());
    }

    static Map<String, Object> compare(String label, BufferedImage a, BufferedImage b, int variant) throws Exception {
        ImageComparison comparison = new ImageComparison(a, b);
        switch (variant) {
            case 1: comparison.setPixelToleranceLevel(0.0); break;
            case 2: comparison.setPixelToleranceLevel(0.99); break;
            case 3: comparison.setMinimalRectangleSize(0); break;
            case 4: comparison.setMinimalRectangleSize(10); break;
            case 5: comparison.setMaximalRectangleCount(1); break;
            case 6: comparison.setExcludedAreas(List.of(new Rectangle(0, 0, 2, 2))).setDrawExcludedRectangles(true); break;
            case 7: comparison.setAllowingPercentOfDifferentPixels(50.0); break;
            case 8: comparison.setThreshold(1); break;
            case 9: comparison.setThreshold(10); break;
        }
        long start = System.nanoTime();
        ImageComparisonResult result = comparison.compareImages();
        double elapsed = (System.nanoTime() - start) / 1000000.0;
        List<List<Integer>> rectangles = null;
        if (result.getRectangles() != null) {
            rectangles = new ArrayList<>();
            for (Rectangle rectangle : result.getRectangles()) rectangles.add(List.of(
                    rectangle.getMinPoint().x, rectangle.getMinPoint().y,
                    rectangle.getMaxPoint().x, rectangle.getMaxPoint().y));
        }
        Map<String, Object> record = new LinkedHashMap<>();
        record.put("label", label);
        record.put("state", result.getImageComparisonState().name());
        record.put("differenceFloatBits", Float.floatToIntBits(result.getDifferencePercent()));
        record.put("rectangles", rectangles);
        record.put("renderedArgbSha256", digest(result.getResult()));
        record.put("comparisonMs", elapsed);
        return record;
    }

    public static void main(String[] args) throws Exception {
        List<Map<String, Object>> records = new ArrayList<>();
        Path frames = Path.of(args[0]);
        if (!args[0].equals("-")) for (int[] pair : new int[][]{{30,30},{30,31},{600,601},{300,1000}}) {
            String label = "captured-" + pair[0] + "-" + pair[1];
            records.add(compare(label, ImageIO.read(frames.resolve(String.format("recording-frame-%04d.png", pair[0])).toFile()),
                    ImageIO.read(frames.resolve(String.format("recording-frame-%04d.png", pair[1])).toFile()), 0));
            System.out.println(label + " comparisonMs=" + records.get(records.size()-1).get("comparisonMs"));
        }
        Random random = new Random(0x2bdf4ebL);
        for (int index = 0; index < 120; index++) {
            int width = 1 + random.nextInt(24), height = 1 + random.nextInt(24);
            BufferedImage a = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            BufferedImage b = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
            for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
                int color = random.nextInt();
                a.setRGB(x, y, color);
                b.setRGB(x, y, random.nextInt(5) == 0 ? random.nextInt() : color);
            }
            records.add(compare("synthetic-" + index, a, b, index % 10));
        }
        for (int variant = 0; variant < 5; variant++) {
            BufferedImage a = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
            BufferedImage b = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
            if (variant == 0) b.setRGB(0,0,0xffffffff);
            if (variant == 1) for (int x = 0; x < 16; x++) b.setRGB(x,0,0xffffffff);
            if (variant == 2) for (int y = 0; y < 16; y++) b.setRGB(0,y,0xffffffff);
            if (variant == 3) for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) b.setRGB(x,y,0xffffffff);
            if (variant == 4) b.setRGB(8,8,0x00101010);
            records.add(compare("edge-" + variant, a, b, 0));
        }
        Map<String,Object> output = new LinkedHashMap<>();
        output.put("classOrigin", ImageComparison.class.getProtectionDomain().getCodeSource().getLocation().toString());
        output.put("records", records);
        Files.writeString(Path.of(args[1]), new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(output));
        System.out.println("Wrote " + records.size() + " exact metric/bounds/render controls");
    }
}
