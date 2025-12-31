import { AppRegistry } from "react-native";
import name from "./app.json";
import App from "./src/App";

// Generate the required CSS
import iconFontRegular from "@react-native-vector-icons/fontawesome6/fonts/FontAwesome6_Regular.ttf";
import iconFontSolid from "@react-native-vector-icons/fontawesome6/fonts/FontAwesome6_Solid.ttf";
const iconFontStyles = `
@font-face {
  src: url(${iconFontRegular});
  font-family: FontAwesome6Free-Regular;
}

@font-face {
  src: url(${iconFontSolid});
  font-family: FontAwesome6Free-Solid;
}
`;

// Create a stylesheet
const style = document.createElement("style");
style.type = "text/css";

// Append the iconFontStyles to the stylesheet
if (style.styleSheet) {
  style.styleSheet.cssText = iconFontStyles;
} else {
  style.appendChild(document.createTextNode(iconFontStyles));
}

// Inject the stylesheet into the document head
document.head.appendChild(style);

AppRegistry.registerComponent(name, () => App);
AppRegistry.runApplication(name, {
  initialProps: {},
  rootTag: document.getElementById("app-root"),
});
