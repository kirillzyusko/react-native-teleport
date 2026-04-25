import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenNames } from "../../constants/screenNames";

import type { ExamplesStackNavigation } from "../../navigation/ExamplesStack";
import { SafeAreaView } from "react-native-safe-area-context";

const chats = [
  {
    id: "kirill",
    name: "Kirill",
    preview: "Sure, let's go for a walk?",
    time: "09:41",
    unread: 2,
    color: "#2563eb",
  },
  {
    id: "design-team",
    name: "Design Team",
    preview: "Slides are ready for the conference dry run.",
    time: "08:16",
    unread: 0,
    color: "#7c3aed",
  },
  {
    id: "anna",
    name: "Anna",
    preview: "Let's keep the sticker animation alive in the demo.",
    time: "Yesterday",
    unread: 0,
    color: "#db2777",
  },
  {
    id: "mobile-core",
    name: "Mobile Core",
    preview: "React Native 0.81 build is green on both platforms.",
    time: "Yesterday",
    unread: 5,
    color: "#059669",
  },
  {
    id: "events",
    name: "Events",
    preview: "Reminder: speaker check-in opens at 7:30.",
    time: "Thu",
    unread: 0,
    color: "#ea580c",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MessengerList() {
  const navigation = useNavigation<ExamplesStackNavigation>();
  const orderedChats = useMemo(() => chats, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Chats</Text>

        <View style={styles.list}>
          {orderedChats.map((chat) => (
            <Pressable
              key={chat.id}
              onPress={() =>
                navigation.navigate(ScreenNames.MESSENGER, {
                  chatId: chat.id,
                  title: chat.name,
                })
              }
              style={({ pressed }) => [
                styles.chatRow,
                pressed && styles.chatRowPressed,
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: chat.color,
                  },
                ]}
              >
                <Text style={styles.avatarText}>{getInitials(chat.name)}</Text>
              </View>

              <View style={styles.chatBody}>
                <View style={styles.chatHeader}>
                  <Text numberOfLines={1} style={styles.chatName}>
                    {chat.name}
                  </Text>
                  <Text style={styles.chatTime}>{chat.time}</Text>
                </View>

                <View style={styles.chatFooter}>
                  <Text numberOfLines={1} style={styles.chatPreview}>
                    {chat.preview}
                  </Text>
                  {chat.unread > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{chat.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  list: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(17, 24, 39, 0.08)",
  },
  chatRowPressed: {
    backgroundColor: "#eef2ff",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  chatBody: {
    flex: 1,
    minWidth: 0,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 12,
  },
  chatName: {
    flex: 1,
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
  },
  chatTime: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
  },
  chatFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chatPreview: {
    flex: 1,
    color: "#6b7280",
    fontSize: 14,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
