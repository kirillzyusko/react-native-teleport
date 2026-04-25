import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import { PortalHost } from "react-native-teleport";
import LottieView from "lottie-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ContextMenu,
  ContextMenuInsetsRegistry,
  type ContextMenuRef,
} from "../../components/context-menu";
import { ScreenNames } from "../../constants/screenNames";

import type { RouteProp } from "@react-navigation/native";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";

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

type HeaderMenuProps = {
  hostName: string;
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

function HeaderMenu({ hostName }: HeaderMenuProps) {
  const menuRef = useRef<ContextMenuRef>(null);
  const closeMenu = () => {
    menuRef.current?.close();
  };

  return (
    <ContextMenu
      ref={menuRef}
      animation="top-right"
      cover="bottom-right"
      hostName={hostName}
      level="screen"
      style={styles.headerMenu}
    >
      <ContextMenu.Anchor>
        <TouchableOpacity
          hitSlop={10}
          onPress={() => menuRef.current?.open()}
          style={styles.headerButton}
        >
          <FontAwesome6
            color="#111827"
            iconStyle="solid"
            name="ellipsis-vertical"
            size={18}
            style={{ left: 2 }}
          />
        </TouchableOpacity>
      </ContextMenu.Anchor>

      <ContextMenu.Options>
        <ContextMenu.Item
          iconName="bookmark"
          onPress={closeMenu}
          title="View details"
        />
        <ContextMenu.Item
          iconName="share"
          onPress={closeMenu}
          title="Mute chat"
        />
        <ContextMenu.Item
          iconName="trash"
          onPress={closeMenu}
          title="Delete chat"
          type="danger"
        />
      </ContextMenu.Options>
    </ContextMenu>
  );
}

export default function Messenger() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<ExamplesStackParamList, typeof ScreenNames.MESSENGER>>();
  const stickerMenuRef = useRef<ContextMenuRef>(null);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: route.params.title,
      headerRight: () => <HeaderMenu hostName={route.key} />,
    });
  }, [navigation, route.key, route.params.title]);

  const handleAction = (title: string) => {
    setSelectedAction(title);
    stickerMenuRef.current?.close();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item) => (
          <Message key={item.id} sender={item.sender} text={item.text} />
        ))}

        {false && (
          <View style={styles.messageRowRight}>
            <ContextMenu
              ref={stickerMenuRef}
              animation="top-right"
              blurred
              cover="bottom-left"
              style={styles.stickerMenu}
              teleportable
            >
              <ContextMenu.Anchor>
                <TouchableOpacity
                  onPress={() => stickerMenuRef.current?.open()}
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
        )}
      </ScrollView>
      <PortalHost name={route.key} style={StyleSheet.absoluteFillObject} />
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
  stickerBubble: {},
  sticker: {
    width: 180,
    height: 180,
  },
  stickerMenu: {
    minWidth: 220,
  },
  headerButton: {
    height: 32,
    width: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  headerMenu: {
    minWidth: 180,
    marginTop: 8,
    marginRight: 8,
  },
  status: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 20,
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
