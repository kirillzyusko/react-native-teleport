import { StyleSheet, Text, View } from "react-native";

export type AttachmentKind = "map" | "pdf";

type AttachmentArtworkProps = {
  kind: AttachmentKind;
};

const MENU_ITEMS = [
  ["Tomato Burrata Toast", "38 PLN"],
  ["Brown Butter Pierogi", "42 PLN"],
  ["Herb Chicken Plate", "49 PLN"],
  ["Warm Apple Cake", "29 PLN"],
] as const;

export function AttachmentArtwork({ kind }: AttachmentArtworkProps) {
  return kind === "pdf" ? <PdfArtwork /> : <MapArtwork />;
}

function PdfArtwork() {
  return (
    <View style={styles.pdfSurface}>
      <View style={styles.menuPage}>
        <View style={styles.menuHeader}>
          <View>
            <Text style={styles.menuKicker}>Praga lunch menu</Text>
            <Text style={styles.menuBrand}>Koneser Bistro</Text>
          </View>
          <View style={styles.menuTimeBadge}>
            <Text style={styles.menuTimeText}>12-16</Text>
          </View>
        </View>
        <Text numberOfLines={1} style={styles.menuSubhead}>
          Seasonal plates, house bread, coffee and desserts
        </Text>
        <View style={styles.menuDivider} />
        <View style={styles.menuGrid}>
          {MENU_ITEMS.map(([title, price], index) => (
            <View key={title} style={styles.menuItemCard}>
              <View
                style={[
                  styles.menuPhoto,
                  index === 0 && styles.menuPhotoGreen,
                  index === 1 && styles.menuPhotoBlue,
                  index === 2 && styles.menuPhotoOlive,
                  index === 3 && styles.menuPhotoBrown,
                ]}
              />
              <Text numberOfLines={1} style={styles.menuItemTitle}>
                {title}
              </Text>
              <Text style={styles.menuItemPrice}>{price}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function MapArtwork() {
  return (
    <View style={styles.mapSurface}>
      <View style={[styles.mapBlock, styles.mapBlockOne]} />
      <View style={[styles.mapBlock, styles.mapBlockTwo]} />
      <View style={[styles.mapRoad, styles.mapRoadOne]} />
      <View style={[styles.mapRoad, styles.mapRoadTwo]} />
      <View style={[styles.mapRoute, styles.mapRouteOne]} />
      <View style={[styles.mapRoute, styles.mapRouteTwo]} />
      <View style={styles.mapOriginPin} />
      <View style={styles.mapDestinationPin} />
      <View style={styles.mapLabel}>
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
  mapBlock: {
    backgroundColor: "rgba(255, 255, 255, 0.58)",
    borderRadius: 18,
    position: "absolute",
  },
  mapBlockOne: {
    height: "32%",
    left: "10%",
    top: "12%",
    transform: [{ rotate: "-7deg" }],
    width: "34%",
  },
  mapBlockTwo: {
    height: "38%",
    right: "8%",
    top: "40%",
    transform: [{ rotate: "8deg" }],
    width: "42%",
  },
  mapDestinationPin: {
    backgroundColor: "#ef4444",
    borderColor: "#ffffff",
    borderRadius: 15,
    borderWidth: 4,
    height: 30,
    left: "61%",
    position: "absolute",
    top: "39%",
    width: 30,
  },
  mapLabel: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    bottom: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    position: "absolute",
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
  mapOriginPin: {
    backgroundColor: "#2563eb",
    borderColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 3,
    height: 20,
    left: "29%",
    position: "absolute",
    top: "66%",
    width: 20,
  },
  mapRoad: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(148, 163, 184, 0.32)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 18,
    position: "absolute",
    width: "120%",
  },
  mapRoadOne: {
    left: "-8%",
    top: "48%",
    transform: [{ rotate: "-18deg" }],
  },
  mapRoadTwo: {
    left: "-6%",
    top: "66%",
    transform: [{ rotate: "13deg" }],
  },
  mapRoute: {
    backgroundColor: "#2563eb",
    borderColor: "#ffffff",
    borderRadius: 999,
    borderWidth: 2,
    height: 10,
    position: "absolute",
  },
  mapRouteOne: {
    left: "31%",
    top: "65%",
    transform: [{ rotate: "-27deg" }],
    width: "38%",
  },
  mapRouteTwo: {
    left: "51%",
    top: "52%",
    transform: [{ rotate: "-42deg" }],
    width: "25%",
  },
  mapSurface: {
    backgroundColor: "#dbead9",
    flex: 1,
    overflow: "hidden",
  },
  menuBrand: {
    color: "#2f241d",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 25,
    textTransform: "uppercase",
  },
  menuDivider: {
    backgroundColor: "#d8c2ab",
    height: StyleSheet.hairlineWidth,
    marginBottom: 9,
    marginTop: 8,
  },
  menuGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  menuHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  menuItemCard: {
    backgroundColor: "#fffaf2",
    borderColor: "#e6d8c7",
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: "48%",
    flexGrow: 1,
    padding: 8,
  },
  menuItemPrice: {
    color: "#9b2f22",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12,
    marginTop: 5,
  },
  menuItemTitle: {
    color: "#2f241d",
    fontSize: 9.5,
    fontWeight: "900",
    lineHeight: 12,
    marginTop: 6,
  },
  menuKicker: {
    color: "#7b5e48",
    fontSize: 9,
    lineHeight: 12,
  },
  menuPage: {
    aspectRatio: 612 / 792,
    backgroundColor: "#fffaf2",
    borderColor: "#dac8b3",
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "88%",
    padding: 12,
    width: "88%",
  },
  menuPhoto: {
    borderRadius: 8,
    height: 56,
  },
  menuPhotoBlue: {
    backgroundColor: "#2e536e",
  },
  menuPhotoBrown: {
    backgroundColor: "#5b3a2e",
  },
  menuPhotoGreen: {
    backgroundColor: "#224232",
  },
  menuPhotoOlive: {
    backgroundColor: "#4c5a31",
  },
  menuSubhead: {
    color: "#7b5e48",
    fontSize: 7.5,
    lineHeight: 10,
    marginTop: 3,
  },
  menuTimeBadge: {
    backgroundColor: "#9b2f22",
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  menuTimeText: {
    color: "#fffaf2",
    fontSize: 8,
    fontWeight: "900",
    lineHeight: 10,
  },
  pdfSurface: {
    alignItems: "center",
    backgroundColor: "#f4eadc",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
  },
});
