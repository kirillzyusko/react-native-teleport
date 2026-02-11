import { Text, Image, View } from "react-native";
import { createHeroComponent } from "./createHeroComponent";

export { default as HeroOverlay } from "./HeroOverlay";

const Hero = {
  Text: createHeroComponent(Text),
  Image: createHeroComponent(Image),
  View: createHeroComponent(View),
};

export default Hero;
