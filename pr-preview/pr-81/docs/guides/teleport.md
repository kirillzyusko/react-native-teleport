# Teleport

The **Teleport** concept allows you to move an **existing view** to a different place in the hierarchy **without unmounting or remounting** it. This means the component keeps its internal state (animations, scroll position, video progress, etc.) even after being visually moved. This pattern is also known as **re-parenting**.

![Teleport helps to move existing view between different layers without losing state](/react-native-teleport/pr-preview/pr-81/assets/images/teleport-65785a9f1211bc6992db0cca2993d621.png)

## Example[​](#example "Direct link to Example")

App.tsx

```
import { StyleSheet, View } from "react-native";
import { PortalHost, PortalProvider } from "react-native-teleport";
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import RootStack from "./navigation";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={styles.container}>
        <PortalProvider>
          <>{/* Deeply nested <Teleport /> component goes here */}</>
          <PortalHost style={StyleSheet.absoluteFillObject} name="overlay" />
        </PortalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

Teleport.tsx

```
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
import { BlurView } from "@react-native-community/blur";
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
```

## Why use Teleport?[​](#why-use-teleport "Direct link to Why use Teleport?")

* **Preserve state**: No unmount/remount — animations, scroll, video, inputs remain intact.
* **Build advanced transitions**: Implement shared-element–style transitions between screens.
* **Escape container limits**: Move a view to an overlay while keeping its internal logic alive.
* **Power complex UI**: Great for photo galleries, YouTube-like mini players, context menu transitions, app tours, off-screen pre-rendering, etc.
