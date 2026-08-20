import { useEffect, useState } from "react";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import Mapbox, { Camera, MapView } from "@rnmapbox/maps";
import { Portal, PortalHost } from "react-native-teleport";

const HOST_NAME = "mapbox-surface-view-host";
const MINSK_COORDINATE: [number, number] = [27.5615, 53.9045];

const LOCAL_STYLE_TOKEN = "pk.local-teleport-surface-view-repro";

export default function MapboxSurfaceView() {
  const [mapBoxReady, setMapBoxReady] = useState(false);
  const [teleported, setTeleported] = useState(false);

  useEffect(() => {
    let mounted = true;

    Mapbox.setAccessToken(LOCAL_STYLE_TOKEN).then(() => {
      Mapbox.setTelemetryEnabled(false);
      if (mounted) {
        setMapBoxReady(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <Portal
        hostName={teleported ? HOST_NAME : undefined}
        style={styles.fullscreenMap}
      >
        {mapBoxReady ? (
          <MapView
            scaleBarEnabled={false}
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            surfaceView={false}
            testID="map_box_surface_view"
          >
            <Camera
              defaultSettings={{
                centerCoordinate: MINSK_COORDINATE,
                zoomLevel: 9,
              }}
            />
          </MapView>
        ) : (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Preparing map…</Text>
          </View>
        )}
      </Portal>

      <View
        pointerEvents={teleported ? "auto" : "none"}
        style={styles.destinationHost}
      >
        <PortalHost name={HOST_NAME} style={styles.fullscreenMap} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setTeleported((value) => !value)}
        style={styles.floatingButton}
        testID="map_box_surface_view_toggle"
      >
        <Text style={styles.buttonText}>
          {teleported ? "Move map back" : "Teleport map"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  destinationHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  floatingButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 8,
    elevation: 8,
    left: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    position: "absolute",
    right: 16,
    top: 16,
    zIndex: 2,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  fullscreenMap: {
    ...StyleSheet.absoluteFillObject,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "#172554",
    justifyContent: "center",
  },
  loadingText: {
    color: "#f8fafc",
    fontWeight: "700",
  },
  map: {
    flex: 1,
  },
  screen: {
    backgroundColor: "#172554",
    flex: 1,
  },
});
