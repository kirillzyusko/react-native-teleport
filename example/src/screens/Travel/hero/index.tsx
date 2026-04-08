import { Text, Image, View } from "react-native";
import { createHeroComponent } from "./createHeroComponent";
import HeroReveal from "./HeroReveal";

export { default as HeroOverlay } from "./HeroOverlay";

const Hero = {
  Text: createHeroComponent(Text),
  Image: createHeroComponent(Image),
  View: createHeroComponent(View),
  Reveal: HeroReveal,
};

export default Hero;
