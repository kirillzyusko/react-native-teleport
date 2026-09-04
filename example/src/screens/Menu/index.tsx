import { useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

const HOST_NAME = "menu-overlay";

const COUNTRIES = [
  ["cyprus", "Cyprus"],
  ["portugal", "Portugal"],
  ["spain", "Spain"],
  ["germany", "Germany"],
  ["france", "France"],
  ["italy", "Italy"],
] as const;

type TriggerFrame = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export default function Menu() {
  const triggerRef = useRef<ComponentRef<typeof View>>(null);
  const [counter, setCounter] = useState(0);
  const [frame, setFrame] = useState<TriggerFrame | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string | null>(null);

  const openSelect = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setFrame({ height, width, x, y });
      setOpen(true);
    });
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Issue #100 touch reproducer</Text>
      <Text style={styles.instructions}>
        Open the Select and choose a country. Without the native Android fix,
        the menu closes but the selected value does not change because the
        option does not receive onPress.
      </Text>

      <Pressable
        onPress={() => setCounter((current) => current + 1)}
        style={({ pressed }) => [
          styles.counterButton,
          pressed ? styles.pressed : undefined,
        ]}
        testID="outside-counter"
      >
        <Text style={styles.counterText}>Outside counter: {counter}</Text>
      </Pressable>

      <View style={styles.selectContainer}>
        <Text style={styles.label}>Country</Text>
        <View ref={triggerRef} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            onPress={openSelect}
            style={({ pressed }) => [
              styles.trigger,
              pressed ? styles.pressed : undefined,
            ]}
            testID="select-trigger"
          >
            <Text style={styles.triggerText}>
              {value === null ? "Choose a country" : value}
            </Text>
            <Text style={styles.chevron}>⌄</Text>
          </Pressable>
        </View>

        {open && frame !== null ? (
          <Portal hostName={HOST_NAME} style={styles.portal}>
            <View pointerEvents="box-none" style={styles.portalContent}>
              <Pressable
                accessibilityLabel="Close select"
                onPress={() => setOpen(false)}
                style={styles.backdrop}
                testID="select-backdrop"
              />

              <View
                style={[
                  styles.menu,
                  {
                    left: frame.x,
                    top: frame.y + frame.height + 4,
                    width: frame.width,
                  },
                ]}
                testID="select-content"
              >
                <ScrollView keyboardShouldPersistTaps="always">
                  {COUNTRIES.map(([countryValue, label]) => (
                    <Pressable
                      key={countryValue}
                      onPress={() => {
                        setValue(countryValue);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.option,
                        pressed ? styles.pressed : undefined,
                      ]}
                      testID={`select-option-${countryValue}`}
                    >
                      <Text style={styles.optionText}>{label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Portal>
        ) : null}
      </View>

      <Text style={styles.status} testID="selected-value">
        Selected: {value ?? "none"}
      </Text>

      <View pointerEvents="box-none" style={styles.hostContainer}>
        <PortalHost name={HOST_NAME} style={StyleSheet.absoluteFillObject} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.12)",
  },
  chevron: {
    color: "#222222",
    fontSize: 20,
  },
  counterButton: {
    alignItems: "center",
    backgroundColor: "#136dec",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  hostContainer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 1,
  },
  instructions: {
    color: "#555555",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    marginTop: 8,
  },
  label: {
    color: "#222222",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  menu: {
    backgroundColor: "#ffffff",
    borderColor: "#cccccc",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    maxHeight: 320,
    overflow: "hidden",
    position: "absolute",
  },
  option: {
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  optionText: {
    color: "#222222",
    fontSize: 16,
  },
  portal: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 1100,
  },
  portalContent: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 1100,
  },
  pressed: {
    opacity: 0.65,
  },
  screen: {
    backgroundColor: "#ffffff",
    flex: 1,
    padding: 24,
  },
  selectContainer: {
    marginTop: 24,
  },
  status: {
    color: "#222222",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 24,
  },
  title: {
    color: "#222222",
    fontSize: 22,
    fontWeight: "700",
  },
  trigger: {
    alignItems: "center",
    borderColor: "#999999",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  triggerText: {
    color: "#222222",
    flex: 1,
    fontSize: 16,
  },
});
