import LottieView from "lottie-react-native";
import { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ContextMenu,
  type ContextMenuRef,
  ContextMenuInsetsRegistry,
} from "../../components/context-menu";

const messages = [
  { id: "1", text: "Hello, how are you", sender: true },
  { id: "2", text: "Hello, not too bad! You?", sender: false },
  { id: "3", text: "I'm fine, thanks", sender: true },
  { id: "4", text: "What is your plan for evening today?", sender: true },
  { id: "5", text: "I'm not sure yet... Any ideas?", sender: false },
  { id: "6", text: "Sure, let's go for a walk?", sender: true },
];

type MessageProps = {
  sender: boolean;
  text: string;
};

const Message = ({ sender, text }: MessageProps) => {
  return (
    <View
      style={[
        styles.messageRow,
        sender ? styles.messageRowRight : styles.messageRowLeft,
      ]}
    >
      <Text style={[styles.message, sender ? styles.sent : styles.received]}>
        {text}
      </Text>
    </View>
  );
};

export default function Messenger() {
  const insets = useSafeAreaInsets();
  const menuRef = useRef<ContextMenuRef>(null);
  const [selectedAction, setSelectedAction] = useState("Forward");
  const actions = useMemo(
    () => [
      { id: "reply", title: "Reply", iconName: "reply" as const },
      { id: "forward", title: "Forward", iconName: "share" as const },
      { id: "save", title: "Save", iconName: "bookmark" as const },
      {
        id: "delete",
        title: "Delete",
        iconName: "trash" as const,
        type: "danger" as const,
      },
    ],
    [],
  );

  const handleAction = (title: string) => {
    setSelectedAction(title);
    menuRef.current?.close();
  };

  return (
    <View style={styles.container}>
      <ContextMenuInsetsRegistry mode="top" style={{ height: insets.top }} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item) => (
          <Message key={item.id} sender={item.sender} text={item.text} />
        ))}

        <View style={styles.messageRowRight}>
          <ContextMenu
            ref={menuRef}
            animation="top-right"
            blurred
            cover="bottom-left"
            style={styles.menu}
            teleportable
          >
            <ContextMenu.Anchor>
              <TouchableOpacity
                onPress={() => menuRef.current?.open()}
                style={styles.stickerBubble}
              >
                <LottieView
                  autoPlay
                  loop
                  source={require("../../assets/lottie/bear.json")}
                  style={styles.sticker}
                />
              </TouchableOpacity>
            </ContextMenu.Anchor>

            <ContextMenu.Options>
              <ContextMenu.Label>Sticker actions</ContextMenu.Label>
              {actions.map((action, index) => (
                <ContextMenu.Item
                  key={action.id}
                  iconName={action.iconName}
                  isLast={index === actions.length - 1}
                  onPress={() => handleAction(action.title)}
                  title={action.title}
                  type={action.type}
                />
              ))}
            </ContextMenu.Options>
          </ContextMenu>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  subheader: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  messageRow: {
    flexDirection: "row",
    width: "100%",
    marginBottom: 6,
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  message: {
    borderRadius: 18,
    color: "#111827",
    maxWidth: "82%",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sent: {
    backgroundColor: "#c9f7d5",
  },
  received: {
    backgroundColor: "#ffffff",
  },
  stickerRow: {
    alignItems: "flex-start",
    marginTop: 10,
    marginBottom: 18,
  },
  stickerBubble: {
  },
  sticker: {
    width: 180,
    height: 180,
  },
  menu: {
    minWidth: 220,
  },
  status: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusLabel: {
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 4,
  },
  statusValue: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "600",
  },
});
