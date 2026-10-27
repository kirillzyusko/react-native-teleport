import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.zip.ZipFile;
import jdk.internal.org.objectweb.asm.*;

// Transplant exactly one compiled method into image-comparison 4.4.0.
// ClassWriter(reader, 0) copies every other original method without rewriting.
public final class PatchImageComparison {
  private static final String ENTRY = "com/github/romankh3/image/comparison/ImageComparison.class";
  private static final String EXPECTED = "36791c9458102c37ad998ba6eb3756902582400bc6e9ce59cdad4ef842cd287e";
  private static boolean target(String name, String descriptor) {
    return name.equals("populateRectangles") && descriptor.equals("()Ljava/util/List;");
  }

  public static void main(String[] args) throws Exception {
    byte[] input;
    try (ZipFile jar = new ZipFile(args[0])) {
      input = jar.getInputStream(jar.getEntry(ENTRY)).readAllBytes();
    }
    String sha = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input));
    if (!EXPECTED.equals(sha)) throw new IllegalArgumentException("Unknown ImageComparison class: " + sha);
    ClassReader reader = new ClassReader(input);
    ClassReader replacement = new ClassReader(Files.readAllBytes(Path.of(args[1]).resolve(ENTRY)));
    ClassWriter writer = new ClassWriter(reader, 0);
    int[] counts = {0, 0};
    reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
      @Override public MethodVisitor visitMethod(int access, String name, String descriptor,
          String signature, String[] exceptions) {
        MethodVisitor method = super.visitMethod(access, name, descriptor, signature, exceptions);
        if (!target(name, descriptor)) return method;
        if (access != Opcodes.ACC_PRIVATE) throw new IllegalStateException("Unexpected target access");
        counts[0]++;
        replacement.accept(new ClassVisitor(Opcodes.ASM8) {
          @Override public MethodVisitor visitMethod(int replacementAccess, String replacementName,
              String replacementDescriptor, String replacementSignature, String[] replacementExceptions) {
            if (!target(replacementName, replacementDescriptor)) return null;
            counts[1]++;
            return method;
          }
        }, 0);
        return null;
      }
    }, 0);
    if (counts[0] != 1 || counts[1] != 1) throw new IllegalStateException("Expected exactly one target method");
    Path destination = Path.of(args[2]).resolve(ENTRY);
    Files.createDirectories(destination.getParent());
    Files.write(destination, writer.toByteArray());
  }
}
