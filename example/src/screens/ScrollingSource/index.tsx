import { useRef, useState, type ComponentRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from "react-native";
import { Portal, PortalHost } from "react-native-teleport";

type Placement = "local" | "root" | "middle" | "inline" | "scroller";
type Point = { x: number; y: number };

const PLACEMENTS: Placement[] = [
  "local",
  "root",
  "middle",
  "inline",
  "scroller",
];

const HOSTS: Record<Placement, string> = {
  // screen-level host that fills the screen below the navigation header
  local: "scrolling-source",
  // app-level host declared in `App.tsx`, covers the whole window
  root: "overlay",
  // fixed box in the middle of the screen
  middle: "scrolling-source-middle",
  // box inside the same ScrollView as the source
  inline: "scrolling-source-inline",
  // box inside another ScrollView
  scroller: "scrolling-source-scroller",
};

const SOURCE_SCROLL_OFFSET = 240;
const HOST_SCROLL_OFFSET = 80;

const round = (value: number) => Math.round(value * 10) / 10;
const format = (point: Point | null) =>
  point ? `${round(point.x)}, ${round(point.y)}` : "-";

export const ScrollingSource = () => {
  const sourceScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const hostScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const button = useRef<ComponentRef<typeof View>>(null);
  const [placement, setPlacement] = useState<Placement>("local");
  const [presses, setPresses] = useState(0);
  const [measured, setMeasured] = useState<Point | null>(null);
  const [actual, setActual] = useState<Point | null>(null);

  const isBox = placement !== "local" && placement !== "root";

  const onPressIn = (e: GestureResponderEvent) => {
    const { pageX, pageY, locationX, locationY } = e.nativeEvent;

    // The touch is dispatched by the native view hierarchy, so it tells where
    // the button really is. `measure` tells where Fabric thinks it is.
    setActual({ x: pageX - locationX, y: pageY - locationY });
    button.current?.measure((_x, _y, _width, _height, x, y) => {
      setMeasured({ x, y });
    });
  };

  const delta =
    measured && actual
      ? { x: measured.x - actual.x, y: measured.y - actual.y }
      : null;

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <View style={styles.row}>
          {PLACEMENTS.map((item) => (
            <Pressable
              key={item}
              testID={`placement-${item}`}
              onPress={() => {
                setPlacement(item);
                setMeasured(null);
                setActual(null);
              }}
              style={[styles.chip, item === placement && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  item === placement && styles.chipLabelActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          <Pressable
            testID={"scroll-source"}
            onPress={() =>
              sourceScroll.current?.scrollTo({
                y: SOURCE_SCROLL_OFFSET,
                animated: false,
              })
            }
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{"Scroll source"}</Text>
          </Pressable>
          <Pressable
            testID={"reset-source"}
            onPress={() =>
              sourceScroll.current?.scrollTo({ y: 0, animated: false })
            }
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{"Reset source"}</Text>
          </Pressable>
          <Pressable
            testID={"scroll-host"}
            onPress={() =>
              hostScroll.current?.scrollTo({
                y: HOST_SCROLL_OFFSET,
                animated: false,
              })
            }
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{"Scroll host"}</Text>
          </Pressable>
          <Pressable
            testID={"reset-host"}
            onPress={() =>
              hostScroll.current?.scrollTo({ y: 0, animated: false })
            }
            style={styles.chip}
          >
            <Text style={styles.chipLabel}>{"Reset host"}</Text>
          </Pressable>
        </View>
        <Text
          style={styles.readout}
          testID={"portal-press-count"}
        >{`Presses: ${presses}`}</Text>
        <Text style={styles.readout} testID={"measure-values"}>
          {`Measured: ${format(measured)} | Actual: ${format(actual)}`}
        </Text>
        <Text style={styles.readout} testID={"measure-delta"}>
          {`Delta: ${format(delta)}`}
        </Text>
      </View>
      <ScrollView ref={sourceScroll} style={styles.scroll}>
        <View style={styles.source}>
          <Text>{"The Portal is declared in this scrolling content."}</Text>
          <Portal hostName={HOSTS[placement]}>
            <View style={isBox ? styles.boxPanel : styles.panel}>
              <Text style={styles.readout}>
                {"This panel stays at its host while the source scrolls."}
              </Text>
              <Pressable
                ref={button}
                testID={"increment-portal"}
                onPressIn={onPressIn}
                onPress={() => setPresses((value) => value + 1)}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.pressed,
                ]}
              >
                {/* keep the Pressable itself as the touch target, so that
                    `locationX/Y` are relative to the measured view */}
                <View pointerEvents="none">
                  <Text style={styles.buttonLabel}>{"Increment"}</Text>
                </View>
              </Pressable>
            </View>
          </Portal>
          {placement === "inline" && (
            <PortalHost name={HOSTS.inline} style={styles.inlineHost} />
          )}
        </View>
      </ScrollView>
      {placement === "local" && (
        <PortalHost name={HOSTS.local} style={StyleSheet.absoluteFill} />
      )}
      {placement === "middle" && (
        <PortalHost name={HOSTS.middle} style={styles.middleHost} />
      )}
      {placement === "scroller" && (
        <ScrollView ref={hostScroll} style={styles.hostScroller}>
          <View style={styles.hostScrollerContent}>
            <PortalHost name={HOSTS.scroller} style={styles.scrollerHost} />
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  boxPanel: {
    backgroundColor: "#e3f2fd",
    flex: 1,
    padding: 10,
  },
  button: {
    backgroundColor: "#1565c0",
    borderRadius: 8,
    marginTop: 8,
    padding: 16,
  },
  buttonLabel: {
    color: "white",
    textAlign: "center",
  },
  chip: {
    backgroundColor: "#eceff1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "#1565c0",
  },
  chipLabel: {
    color: "#263238",
    fontSize: 12,
  },
  chipLabelActive: {
    color: "white",
  },
  container: {
    backgroundColor: "white",
    flex: 1,
  },
  controls: {
    gap: 6,
    padding: 12,
  },
  hostScroller: {
    backgroundColor: "#fff8e1",
    bottom: 0,
    height: 200,
    left: 0,
    position: "absolute",
    right: 0,
  },
  hostScrollerContent: {
    height: 700,
  },
  inlineHost: {
    height: 130,
    left: 16,
    position: "absolute",
    right: 16,
    top: 250,
  },
  middleHost: {
    height: 140,
    left: 16,
    position: "absolute",
    right: 16,
    top: 300,
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
  readout: {
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollerHost: {
    height: 130,
    marginHorizontal: 16,
    marginTop: 110,
  },
  source: {
    height: 1600,
    padding: 24,
  },
});

export default ScrollingSource;
