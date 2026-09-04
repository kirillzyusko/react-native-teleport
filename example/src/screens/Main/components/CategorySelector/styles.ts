import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  button: {
    flex: 1,
    alignItems: "center",
    borderColor: "#d1d5db",
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 12,
  },
  selectedButton: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  text: {
    color: "#000000",
    fontWeight: "600",
  },
  selectedText: {
    color: "#ffffff",
  },
});
