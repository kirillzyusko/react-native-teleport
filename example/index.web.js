import { AppRegistry } from "react-native";
import name from "./app.json";
import App from "./src/App";

// Generate the required CSS
import iconFont from "@react-native-vector-icons/fontawesome6/fonts/FontAwesome6_Regular.ttf";
const iconFontStyles = `@font-face {
  src: url(${iconFont});
  font-family: FontAwesome6Free-Regular;
}`;

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
