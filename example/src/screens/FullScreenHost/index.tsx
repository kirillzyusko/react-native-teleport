import { useEffect, useState } from "react";
import {
  BackHandler,
  Button,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

function Dialog({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(0);
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={() => setCount((value) => value + 1)}>
          <Text>
            {title} count: {count}
          </Text>
        </Pressable>
        {children}
      </View>
    </View>
  );
}

export default function FullScreenHost() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(false);
  const [firstOnTop, setFirstOnTop] = useState(false);
  const [nativeModal, setNativeModal] = useState(false);
  const [fullScreen, setFullScreen] = useState(true);

  useEffect(() => {
    if (!first) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (second && !firstOnTop) setSecond(false);
        else setFirst(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [first, second, firstOnTop]);

  return (
    <View style={styles.screen}>
      <Button title="Open first dialog" onPress={() => setFirst(true)} />
      <Button
        title={fullScreen ? "Use local host" : "Use full-screen host"}
        onPress={() => setFullScreen((value) => !value)}
      />
      <Text>
        The full-screen backdrop should cover the native navigation header.
      </Text>
      <PortalHost
        name="full-screen-dialogs"
        fullScreen={fullScreen}
        style={StyleSheet.absoluteFill}
      />
      {/* Deliberately render second first in the source tree: opening order wins. */}
      {second ? (
        <Portal hostName="full-screen-dialogs">
          <View
            style={styles.fill}
            accessibilityElementsHidden={firstOnTop}
            importantForAccessibility={
              firstOnTop ? "no-hide-descendants" : "auto"
            }
          >
            <Dialog title="Second dialog">
              <Button
                title="Bring first to front"
                onPress={() => setFirstOnTop(true)}
              />
              <Button
                title="Show native Modal above dialogs"
                onPress={() => setNativeModal(true)}
              />
              <Button
                title="Close second dialog"
                onPress={() => setSecond(false)}
              />
            </Dialog>
          </View>
        </Portal>
      ) : null}
      {first ? (
        <Portal
          hostName="full-screen-dialogs"
          stackOrder={firstOnTop ? 1 : undefined}
        >
          <View
            style={styles.fill}
            accessibilityElementsHidden={second && !firstOnTop}
            importantForAccessibility={
              second && !firstOnTop ? "no-hide-descendants" : "auto"
            }
          >
            <Dialog title="First dialog">
              <Button
                title="Open second dialog"
                onPress={() => {
                  setSecond(true);
                  setFirstOnTop(false);
                }}
              />
              {second ? (
                <Button
                  title="Bring second to front"
                  onPress={() => setFirstOnTop(false)}
                />
              ) : null}
              <Button
                title="Close first dialog"
                onPress={() => {
                  setFirst(false);
                  setSecond(false);
                  setFirstOnTop(false);
                }}
              />
            </Dialog>
          </View>
        </Portal>
      ) : null}
      <Modal
        transparent
        visible={nativeModal}
        onRequestClose={() => setNativeModal(false)}
      >
        <Dialog title="Native Modal">
          <Button
            title="Close native Modal"
            onPress={() => setNativeModal(false)}
          />
        </Dialog>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", gap: 16, padding: 24 },
  fill: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "85%",
    maxWidth: 420,
    padding: 24,
    gap: 16,
    backgroundColor: "white",
    borderRadius: 12,
  },
  title: { fontSize: 20, fontWeight: "600" },
});
