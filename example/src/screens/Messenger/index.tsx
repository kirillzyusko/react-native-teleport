import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  StyleSheet,
  Animated,
  useAnimatedValue,
  Easing,
  Pressable,
} from "react-native";
import BlurView from "../../components/BlurView";
import { Portal } from "react-native-teleport";

const messages = [
  { text: "Hello, how are you", sender: true },
  { text: "Hello, not too bad! You?", sender: false },
  { text: "I'm fine, thanks", sender: true },
  { text: "What is your plan for evening today?", sender: true },
  { text: "I'm not sure yet... Any ideas?", sender: false },
  { text: "Sure, let's go for a walk?", sender: true },
];

const Message = ({ sender, text }) => {
  return (
    <View
      style={{
        flexDirection: "row",
        width: "100%",
        justifyContent: sender ? "flex-end" : "flex-start",
      }}
    >
      <Text
        style={{
          opacity: 1,
          color: "black",
          padding: 10,
          backgroundColor: sender ? "#38f269" : "#38c7f2",
          margin: 10,
          borderRadius: 10,
        }}
      >
        {text}
      </Text>
    </View>
  );
};

export default function Messenger() {
  const viewRef = useRef<View | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const [teleport, setTeleported] = useState(false);
  const [style, setStyle] = useState(null);

  const handleClick = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
    viewRef.current?.measureInWindow((x, y) => {
      console.log(x, y);
      setTeleported(true);
      setStyle({
        paddingTop: y,
      });
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView>
        {messages.map((item) => (
          <Message key={item.text} {...item} />
        ))}
        <View
          ref={viewRef}
          style={{
            width: "100%",
            justifyContent: "flex-start",
            flexDirection: "row",
          }}
        >
          <Portal hostName={teleport ? "overlay" : undefined}>
            <Pressable onPress={handleClick} style={style ?? {}}>
              <LottieView
                source={require("../../assets/lottie/bear.json")}
                style={[{ width: 200, height: 200 }]}
                autoPlay
                loop
              />
            </Pressable>
          </Portal>
        </View>
      </ScrollView>
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { opacity: opacity }]}
        pointerEvents="none"
      >
        <BlurView
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
          blurType="light"
          blurAmount={16}
        />
      </Animated.View>
    </View>
  );
}
