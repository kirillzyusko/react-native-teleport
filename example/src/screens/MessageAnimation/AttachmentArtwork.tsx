import type { ComponentType, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Pdf from "react-native-pdf";
import { MENU_PDF_BASE64 } from "./menuPdf";

export type AttachmentKind = "map" | "pdf";

type AttachmentArtworkProps = {
  kind: AttachmentKind;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Region = Coordinate & {
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapViewProps = {
  children?: ReactNode;
  initialRegion: Region;
  loadingBackgroundColor?: string;
  loadingEnabled?: boolean;
  mapPadding?: {
    bottom: number;
    left: number;
    right: number;
    top: number;
  };
  pitchEnabled?: boolean;
  rotateEnabled?: boolean;
  scrollEnabled?: boolean;
  showsBuildings?: boolean;
  showsCompass?: boolean;
  showsMyLocationButton?: boolean;
  showsPointsOfInterests?: boolean;
  showsScale?: boolean;
  showsUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
  toolbarEnabled?: boolean;
  zoomControlEnabled?: boolean;
  zoomEnabled?: boolean;
  zoomTapEnabled?: boolean;
};

type MarkerProps = {
  coordinate: Coordinate;
  description?: string;
  pinColor?: string;
  title?: string;
};

type PolylineProps = {
  coordinates: Coordinate[];
  lineCap?: "butt" | "round" | "square";
  lineJoin?: "bevel" | "miter" | "round";
  strokeColor?: string;
  strokeWidth?: number;
};

const ReactNativeMaps = require("react-native-maps") as {
  Marker: ComponentType<MarkerProps>;
  Polyline: ComponentType<PolylineProps>;
  default: ComponentType<MapViewProps>;
};

const MapView = ReactNativeMaps.default;
const Marker = ReactNativeMaps.Marker;
const Polyline = ReactNativeMaps.Polyline;

const MENU_PDF_SOURCE = {
  uri: `data:application/pdf;base64,${MENU_PDF_BASE64}`,
};

const MAP_REGION = {
  latitude: 52.2535,
  latitudeDelta: 0.0062,
  longitude: 21.044,
  longitudeDelta: 0.0062,
};

const MAP_EDGE_PADDING = {
  bottom: 14,
  left: 14,
  right: 14,
  top: 14,
};

const ORIGIN_COORDINATE = {
  latitude: 52.25135,
  longitude: 21.03985,
};

const DESTINATION_COORDINATE = {
  latitude: 52.25502,
  longitude: 21.04485,
};

const ROUTE_COORDINATES = [
  ORIGIN_COORDINATE,
  {
    latitude: 52.25184,
    longitude: 21.04105,
  },
  {
    latitude: 52.25253,
    longitude: 21.04172,
  },
  {
    latitude: 52.25318,
    longitude: 21.04258,
  },
  {
    latitude: 52.25404,
    longitude: 21.04346,
  },
  DESTINATION_COORDINATE,
];

export function AttachmentArtwork({ kind }: AttachmentArtworkProps) {
  return kind === "pdf" ? <PdfArtwork /> : <MapArtwork />;
}

function PdfArtwork() {
  return (
    <View style={styles.pdfSurface}>
      <Pdf
        enableAnnotationRendering={false}
        fitPolicy={0}
        maxScale={4}
        minScale={1}
        renderActivityIndicator={() => (
          <View style={styles.pdfLoading}>
            <Text style={styles.pdfLoadingText}>Loading menu</Text>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        source={MENU_PDF_SOURCE}
        spacing={0}
        style={styles.pdfView}
        trustAllCerts={false}
      />
    </View>
  );
}

function MapArtwork() {
  return (
    <View style={styles.mapSurface}>
      <MapView
        initialRegion={MAP_REGION}
        loadingBackgroundColor="#e7f0df"
        loadingEnabled
        mapPadding={MAP_EDGE_PADDING}
        pitchEnabled
        rotateEnabled={false}
        scrollEnabled
        showsBuildings
        showsCompass={false}
        showsMyLocationButton={false}
        showsPointsOfInterests
        showsScale={false}
        showsUserLocation={false}
        style={StyleSheet.absoluteFillObject}
        toolbarEnabled={false}
        zoomControlEnabled={false}
        zoomEnabled
        zoomTapEnabled
      >
        <Polyline
          coordinates={ROUTE_COORDINATES}
          lineCap="round"
          lineJoin="round"
          strokeColor="#2563eb"
          strokeWidth={5}
        />
        <Marker coordinate={ORIGIN_COORDINATE} pinColor="#2563eb" />
        <Marker
          coordinate={DESTINATION_COORDINATE}
          description="8 min walk"
          pinColor="#ef4444"
          title="Koneser Bistro"
        />
      </MapView>
      <View pointerEvents="none" style={styles.mapLabel}>
        <Text numberOfLines={1} style={styles.mapLabelTitle}>
          Koneser Bistro
        </Text>
        <Text numberOfLines={1} style={styles.mapLabelSubtitle}>
          8 min walk
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapLabel: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    bottom: 14,
    elevation: 4,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: "absolute",
    shadowColor: "#020617",
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  mapLabelSubtitle: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 13,
    marginTop: 2,
  },
  mapLabelTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 16,
  },
  mapSurface: {
    backgroundColor: "#dbead9",
    flex: 1,
    overflow: "hidden",
  },
  pdfLoading: {
    alignItems: "center",
    backgroundColor: "#f4eadc",
    flex: 1,
    justifyContent: "center",
  },
  pdfLoadingText: {
    color: "#7b5e48",
    fontSize: 13,
    fontWeight: "700",
  },
  pdfSurface: {
    backgroundColor: "#f4eadc",
    flex: 1,
    overflow: "hidden",
  },
  pdfView: {
    backgroundColor: "#f4eadc",
    flex: 1,
  },
});
