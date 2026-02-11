import { StyleSheet } from "react-native";
import { PortalHost } from "react-native-teleport";
import { HERO_OVERLAY_HOST } from "./createHeroComponent";

export default function HeroOverlay() {
  return (
    <PortalHost name={HERO_OVERLAY_HOST} style={styles.overlay} />
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
