import { useRef, useState, type ComponentRef } from "react";
import {
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

export const ScrollingSource = () => {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [presses, setPresses] = useState(0);

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.title}>{"Scrolling portal source"}</Text>
        <Text>
          {"Scroll the source, then press and slightly move on Increment."}
        </Text>
        <Button
          title={"Scroll source"}
          testID={"scroll-source"}
          onPress={() => scroll.current?.scrollTo({ y: 240, animated: false })}
        />
        <Button
          title={"Reset source"}
          testID={"reset-source"}
          onPress={() => scroll.current?.scrollTo({ y: 0, animated: false })}
        />
        <Text testID={"portal-press-count"}>{`Presses: ${presses}`}</Text>
      </View>
      <ScrollView ref={scroll} style={styles.scroll}>
        <View style={styles.source}>
          <Text>{"The Portal is declared in this scrolling content."}</Text>
          <Portal hostName={"scrolling-source"}>
            <View style={styles.panel}>
              <Text>
                {"This panel stays at its host while the source scrolls."}
              </Text>
              <Pressable
                testID={"increment-portal"}
                onPress={() => setPresses((value) => value + 1)}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.buttonLabel}>{"Increment"}</Text>
              </Pressable>
            </View>
          </Portal>
        </View>
      </ScrollView>
      <PortalHost name={"scrolling-source"} style={StyleSheet.absoluteFill} />
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#1565c0",
    borderRadius: 8,
    marginTop: 16,
    padding: 24,
  },
  buttonLabel: {
    color: "white",
    textAlign: "center",
  },
  container: {
    backgroundColor: "white",
    flex: 1,
  },
  controls: {
    gap: 12,
    padding: 24,
  },
  panel: {
    backgroundColor: "#e3f2fd",
    bottom: 48,
    left: 24,
    padding: 24,
    position: "absolute",
    right: 24,
  },
  pressed: {
    backgroundColor: "#0d47a1",
  },
  scroll: {
    flex: 1,
  },
  source: {
    height: 1600,
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
  },
});

export default ScrollingSource;
