import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { Portal, PortalProvider } from "react-native-teleport";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  children?: React.ReactNode;
}

function Dialog(props: DialogProps) {
  const { open, onClose, title, message, children } = props;
  if (!open) return null;
  return (
    <Portal hostName="root">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          {children}
          <Pressable
            style={({ pressed }) => [
              styles.buttonDestructive,
              pressed && styles.buttonDestructivePressed,
            ]}
            onPress={onClose}
          >
            <Text style={styles.buttonDestructiveText}>Close {title}</Text>
          </Pressable>
        </View>
      </View>
    </Portal>
  );
}

export default function TeleportationOrder() {
  const [firstDialogOpen, setFirstDialogOpen] = useState(false);
  const [secondDialogOpen, setSecondDialogOpen] = useState(false);
  const [thirdDialogOpen, setThirdDialogOpen] = useState(false);

  return (
    <PortalProvider>
      <View style={styles.container}>
        <Text style={styles.header}>Nested Dialogs Example</Text>
        <Text style={styles.subtitle}>Open dialogs within dialogs</Text>

        <Pressable
          style={({ pressed }) => [
            styles.buttonPrimary,
            pressed && styles.buttonPrimaryPressed,
          ]}
          onPress={() => setFirstDialogOpen(true)}
        >
          <Text style={styles.buttonPrimaryText}>Open First Dialog</Text>
        </Pressable>

        <Dialog
          open={firstDialogOpen}
          onClose={() => setFirstDialogOpen(false)}
          title="First Dialog"
          message="This is the first dialog. You can open another dialog from here."
        >
          <Pressable
            style={({ pressed }) => [
              styles.buttonOutline,
              pressed && styles.buttonOutlinePressed,
            ]}
            onPress={() => setSecondDialogOpen(true)}
          >
            <Text style={styles.buttonOutlineText}>Open Second Dialog</Text>
          </Pressable>
        </Dialog>

        <Dialog
          open={secondDialogOpen}
          onClose={() => setSecondDialogOpen(false)}
          title="Second Dialog"
          message="This is the second dialog, opened from the first one. Go even deeper?"
        >
          <Pressable
            style={({ pressed }) => [
              styles.buttonPrimary,
              pressed && styles.buttonPrimaryPressed,
            ]}
            onPress={() => setThirdDialogOpen(true)}
          >
            <Text style={styles.buttonPrimaryText}>Open Third Dialog</Text>
          </Pressable>
        </Dialog>

        <Dialog
          open={thirdDialogOpen}
          onClose={() => setThirdDialogOpen(false)}
          title="Third Dialog"
          message="You've reached the third level of nested dialogs! 🎉"
        />
      </View>
    </PortalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    color: "#18181b",
  },
  subtitle: {
    fontSize: 14,
    color: "#71717a",
    marginBottom: 30,
  },
  buttonPrimary: {
    backgroundColor: "#18181b",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 140,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#18181b",
  },
  buttonPrimaryPressed: {
    backgroundColor: "#27272a",
    borderColor: "#27272a",
    transform: [{ scale: 0.98 }],
  },
  buttonPrimaryText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonOutline: {
    backgroundColor: "transparent",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 140,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  buttonOutlinePressed: {
    backgroundColor: "#f4f4f5",
    transform: [{ scale: 0.98 }],
  },
  buttonOutlineText: {
    color: "#18181b",
    fontSize: 14,
    fontWeight: "500",
  },
  buttonDestructive: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    minWidth: 140,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  buttonDestructivePressed: {
    backgroundColor: "#b91c1c",
    borderColor: "#b91c1c",
    transform: [{ scale: 0.98 }],
  },
  buttonDestructiveText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 24,
    gap: 8,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
    color: "#18181b",
  },
  message: {
    fontSize: 14,
    color: "#71717a",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
});
