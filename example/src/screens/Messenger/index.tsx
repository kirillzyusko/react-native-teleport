import LottieView from "lottie-react-native";
import { useRef, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import BlurView from "../../components/BlurView";
import { Portal } from "react-native-teleport";
import useMeasure from "../../hooks/useMeasure";

const messages = [
  { text: "Hello, how are you", sender: true },
  { text: "Hello, not too bad! You?", sender: false },
  { text: "I'm fine, thanks", sender: true },
  { text: "What is your plan for evening today?", sender: true },
  { text: "I'm not sure yet... Any ideas?", sender: false },
  { text: "Sure, let's go for a walk?", sender: true },
];

type MessageProps = {
  sender: boolean;
  text: string;
};

const Message = ({ sender, text }: MessageProps) => {
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
  const viewRef = useRef<View>(null);
  const timeoutId = useRef<number>(undefined);
  const [teleport, setTeleported] = useState(false);
  const [style, setStyle] = useState({ paddingTop: 0 });
  const [blur, setBlur] = useState(false);
  const measure = useMeasure(viewRef);

  const handleClick = () => {
    if (blur) {
      setBlur(false);
      timeoutId.current = setTimeout(() => {
        // after blur animation finish
        setTeleported(false);
        setStyle({ paddingTop: 0 });
      }, 500);
      return;
    }
    clearTimeout(timeoutId.current);
    setBlur(true);
    measure((_x: number, y: number) => {
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
          // @ts-expect-error I don't know what's wrong with types here
          ref={viewRef}
          style={{
            width: "100%",
            justifyContent: "flex-start",
            flexDirection: "row",
          }}
        >
          <Portal hostName={teleport ? "overlay" : undefined}>
            <Pressable onPress={handleClick} style={style}>
              <View style={{ width: 200, height: 200 }}>
                <LottieView
                  source={require("../../assets/lottie/bear.json")}
                  style={{ width: 200, height: 200 }}
                  autoPlay
                  loop
                />
              </View>
            </Pressable>
          </Portal>
        </View>
      </ScrollView>
      <BlurView visible={blur} />
    </View>
  );
}
