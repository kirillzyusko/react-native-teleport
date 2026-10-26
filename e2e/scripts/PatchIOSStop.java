import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.zip.ZipFile;
import jdk.internal.org.objectweb.asm.*;

// Keep physical-device behavior; use the existing native controller for
// Simulator stop. Emit one class for the installer's verified JAR rewrite.
public final class PatchIOSStop {
  private static final String EXPECTED =
      "7a77605a3c85845dc0f1174463cc5b63f359429dec27bfd72c696c33c01a94b2";

  public static void main(String[] args) throws Exception {
    byte[] input;
    try (ZipFile jar = new ZipFile(args[0])) {
      input = jar.getInputStream(jar.getEntry("ios/LocalIOSDevice.class")).readAllBytes();
    }
    if (!sha(input).equals(EXPECTED)) throw new IllegalArgumentException("Unknown Maestro iOS class: SHA256=" + sha(input));
    ClassReader reader = new ClassReader(input);
    ClassWriter writer = new ClassWriter(reader, 0);
    int[] methods = {0};
    int[] injections = {0};
    reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
      @Override public MethodVisitor visitMethod(int access, String name, String descriptor,
          String signature, String[] exceptions) {
        MethodVisitor original = super.visitMethod(access, name, descriptor, signature, exceptions);
        if (!name.equals("stop") || !descriptor.equals("(Ljava/lang/String;)V")) return original;
        methods[0]++;
        return new MethodVisitor(Opcodes.ASM8, original) {
          @Override public void visitMethodInsn(int opcode, String owner, String name,
              String descriptor, boolean isInterface) {
            super.visitMethodInsn(opcode, owner, name, descriptor, isInterface);
            if (opcode == Opcodes.INVOKESTATIC && owner.equals("kotlin/jvm/internal/Intrinsics")
                && name.equals("checkNotNullParameter")) {
              injections[0]++;
              Label unchanged = new Label();
              mv.visitVarInsn(Opcodes.ALOAD, 0);
              mv.visitFieldInsn(Opcodes.GETFIELD, "ios/LocalIOSDevice", "deviceController", "Ldevice/IOSDevice;");
              mv.visitTypeInsn(Opcodes.INSTANCEOF, "device/SimctlIOSDevice");
              mv.visitJumpInsn(Opcodes.IFEQ, unchanged);
              mv.visitVarInsn(Opcodes.ALOAD, 0);
              mv.visitFieldInsn(Opcodes.GETFIELD, "ios/LocalIOSDevice", "deviceController", "Ldevice/IOSDevice;");
              mv.visitVarInsn(Opcodes.ALOAD, 1);
              mv.visitMethodInsn(Opcodes.INVOKEINTERFACE, "device/IOSDevice", "stop", "(Ljava/lang/String;)V", true);
              mv.visitInsn(Opcodes.RETURN);
              mv.visitLabel(unchanged);
              mv.visitFrame(Opcodes.F_SAME, 0, null, 0, null);
            }
          }
        };
      }
    }, 0);
    if (methods[0] != 1 || injections[0] != 1) throw new IllegalStateException("Unexpected stop method shape");
    byte[] output = writer.toByteArray();
    Path destination = Path.of(args[1]).resolve("ios/LocalIOSDevice.class");
    Files.createDirectories(destination.getParent());
    Files.write(destination, output);
    System.out.println("input_class_sha256=" + sha(input));
    System.out.println("output_class_sha256=" + sha(output));
    System.out.println("injections=" + injections[0] + "; physical fallback preserved");
  }

  private static String sha(byte[] data) throws Exception {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
  }
}
