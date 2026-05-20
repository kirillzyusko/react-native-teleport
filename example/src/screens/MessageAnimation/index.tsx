import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Portal, PortalHost } from "react-native-teleport";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const FLIGHT_HOST = "message-animation-flight";
const DRAFT_PORTAL = "message-animation-draft";
const MESSAGE_FONT_SIZE = 17;
const MESSAGE_LINE_HEIGHT = 22;

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "msg-1",
    sender: "them",
    text: "Did you find a good place for lunch?",
  },
  {
    id: "msg-2",
    sender: "me",
    text: "Checking a few options now.",
  },
  {
    id: "msg-3",
    sender: "them",
    text: "Send the address when you have it.",
  },
];

type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ViewRef = ComponentRef<typeof View>;
type ScrollViewRef = ComponentRef<typeof ScrollView>;

type FlightFrames = {
  from: Frame;
  to: Frame;
};

type ActiveDraft = {
  id: string;
  phase: "measuring" | "flying" | "settled";
  text: string;
};

type ChatMessage = {
  id: string;
  sender: "me" | "them";
  text: string;
};

type RenderMessage = ChatMessage & {
  pending?: boolean;
};

type DraftSurfaceProps = {
  frames: FlightFrames | null;
  phase: "composer" | ActiveDraft["phase"];
  progress: Animated.Value;
  text: string;
};

const messageHostName = (id: string) => `message-animation-row-${id}`;

function DraftSurface({ frames, phase, progress, text }: DraftSurfaceProps) {
  if (phase === "flying" && frames) {
    const backgroundColor = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ["rgba(255, 255, 255, 0)", "#2563eb"],
    });
    const color = progress.interpolate({
      inputRange: [0, 1],
      outputRange: ["#0f172a", "#ffffff"],
    });
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, frames.to.x - frames.from.x],
    });
    const translateY = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, frames.to.y - frames.from.y],
    });
    const width = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [frames.from.width, frames.to.width],
    });

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sentBubble,
          styles.flightBubble,
          {
            backgroundColor,
            left: frames.from.x,
            minHeight: frames.to.height,
            top: frames.from.y,
            transform: [{ translateX }, { translateY }],
            width,
          },
        ]}
      >
        <Animated.Text numberOfLines={2} style={[styles.sentText, { color }]}>
          {text}
        </Animated.Text>
      </Animated.View>
    );
  }

  if (phase === "settled") {
    return (
      <View
        pointerEvents="none"
        style={[styles.sentBubble, styles.settledBubble]}
      >
        <Text numberOfLines={2} style={styles.sentText}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.draftTextLayer}>
      <Text numberOfLines={1} style={styles.draftText}>
        {text}
      </Text>
    </View>
  );
}

function MessageBubble({ sender, text }: ChatMessage) {
  return (
    <View
      style={[
        styles.messageRow,
        sender === "me" ? styles.messageRowRight : styles.messageRowLeft,
      ]}
    >
      <View
        style={[
          styles.messageBubble,
          sender === "me" ? styles.sentBubble : styles.receivedBubble,
        ]}
      >
        <Text style={sender === "me" ? styles.sentText : styles.receivedText}>
          {text}
        </Text>
      </View>
    </View>
  );
}

export default function MessageAnimation() {
  const insets = useSafeAreaInsets();
  const composerBubbleRef = useRef<ViewRef>(null);
  const rootRef = useRef<ViewRef>(null);
  const inputSlotRef = useRef<ViewRef>(null);
  const destinationSlotRef = useRef<ViewRef>(null);
  const scrollRef = useRef<ScrollViewRef>(null);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [frames, setFrames] = useState<FlightFrames | null>(null);

  const canSend = inputText.trim().length > 0 && !activeDraft;
  const shouldShowPlaceholder =
    !inputText && activeDraft?.phase !== "measuring";
  const portalHostName = activeDraft
    ? activeDraft.phase === "flying"
      ? FLIGHT_HOST
      : activeDraft.phase === "settled"
        ? messageHostName(activeDraft.id)
        : undefined
    : undefined;
  const draftPhase = activeDraft?.phase ?? "composer";

  const renderedMessages = useMemo<RenderMessage[]>(
    () =>
      activeDraft
        ? [
            ...messages,
            {
              id: activeDraft.id,
              pending: true,
              sender: "me",
              text: activeDraft.text,
            },
          ]
        : messages,
    [activeDraft, messages],
  );

  const measureInRoot = useCallback((node: ViewRef | null) => {
    return new Promise<Frame | null>((resolve) => {
      const root = rootRef.current;

      if (!root || !node) {
        resolve(null);
        return;
      }

      root.measure(
        (
          _x: number,
          _y: number,
          _width: number,
          _height: number,
          rootPageX: number,
          rootPageY: number,
        ) => {
          node.measure(
            (
              nodeX: number,
              nodeY: number,
              width: number,
              height: number,
              pageX: number,
              pageY: number,
            ) => {
              const relativeX =
                Number.isFinite(pageX) && Number.isFinite(rootPageX)
                  ? pageX - rootPageX
                  : nodeX;
              const relativeY =
                Number.isFinite(pageY) && Number.isFinite(rootPageY)
                  ? pageY - rootPageY
                  : nodeY;

              resolve({
                height,
                width,
                x: relativeX,
                y: relativeY,
              });
            },
          );
        },
      );
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();

    if (!text || activeDraft) {
      return;
    }

    setActiveDraft({
      id: `message-${Date.now()}`,
      phase: "measuring",
      text,
    });
    setInputText("");
    setFrames(null);
    progress.setValue(0);
  }, [activeDraft, inputText, progress]);

  const renderMessage = useCallback(
    (message: RenderMessage) => {
      if (!message.pending || !activeDraft) {
        return <MessageBubble key={message.id} {...message} />;
      }

      return (
        <View
          key={message.id}
          style={[styles.messageRow, styles.messageRowRight]}
        >
          <View
            ref={destinationSlotRef}
            collapsable={false}
            style={styles.destinationSlot}
          >
            <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
              <PortalHost
                name={messageHostName(activeDraft.id)}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
            <View style={[styles.sentBubble, styles.destinationGhost]}>
              <Text numberOfLines={2} style={styles.sentText}>
                {activeDraft.text}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [activeDraft],
  );

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    Animated.timing(placeholderOpacity, {
      duration: shouldShowPlaceholder ? 180 : 80,
      easing: Easing.out(Easing.cubic),
      toValue: shouldShowPlaceholder ? 1 : 0,
      useNativeDriver: true,
    }).start();
  }, [placeholderOpacity, shouldShowPlaceholder]);

  useEffect(() => {
    if (activeDraft?.phase !== "measuring") {
      return;
    }

    const measureHandle = setTimeout(async () => {
      const [from, to] = await Promise.all([
        measureInRoot(composerBubbleRef.current),
        measureInRoot(destinationSlotRef.current),
      ]);

      if (!from || !to) {
        setActiveDraft(null);
        return;
      }

      setFrames({ from, to });
      setActiveDraft((draft) =>
        draft?.id === activeDraft.id ? { ...draft, phase: "flying" } : draft,
      );
      progress.setValue(0);

      Animated.timing(progress, {
        duration: 540,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        setActiveDraft((draft) =>
          draft?.id === activeDraft.id ? { ...draft, phase: "settled" } : draft,
        );

        settleTimeoutRef.current = setTimeout(() => {
          setMessages((current) => [
            ...current,
            {
              id: activeDraft.id,
              sender: "me",
              text: activeDraft.text,
            },
          ]);
          setActiveDraft((draft) =>
            draft?.id === activeDraft.id ? null : draft,
          );
          setFrames(null);
          progress.setValue(0);
        }, 180);
      });
    }, 80);

    return () => clearTimeout(measureHandle);
  }, [activeDraft, measureInRoot, progress]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View ref={rootRef} collapsable={false} style={styles.root}>
        <View style={styles.conversationHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>K</Text>
          </View>
          <View>
            <Text style={styles.contactName}>Ksenia</Text>
            <Text style={styles.contactStatus}>online</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        >
          {renderedMessages.map(renderMessage)}
        </ScrollView>

        <View style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}>
          <View ref={inputSlotRef} collapsable={false} style={styles.inputSlot}>
            <Animated.Text
              style={[styles.placeholder, { opacity: placeholderOpacity }]}
            >
              Message
            </Animated.Text>
            {activeDraft && (
              <>
                <View
                  ref={composerBubbleRef}
                  collapsable={false}
                  style={[styles.sentBubble, styles.composerGhost]}
                >
                  <Text numberOfLines={1} style={styles.sentText}>
                    {activeDraft.text}
                  </Text>
                </View>
                <Portal
                  hostName={portalHostName}
                  name={DRAFT_PORTAL}
                  style={StyleSheet.absoluteFillObject}
                >
                  <DraftSurface
                    frames={frames}
                    phase={draftPhase}
                    progress={progress}
                    text={activeDraft.text}
                  />
                </Portal>
              </>
            )}
            <TextInput
              autoCapitalize="sentences"
              editable={!activeDraft}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              placeholder=""
              returnKeyType="send"
              selectionColor="#2563eb"
              style={styles.textInput}
              value={inputText}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
              pressed && canSend && styles.sendButtonPressed,
            ]}
          >
            <FontAwesome6
              color="#ffffff"
              iconStyle="solid"
              name="paper-plane"
              size={16}
            />
          </Pressable>
        </View>

        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <PortalHost
            name={FLIGHT_HOST}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  composer: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderTopColor: "#dbe4ef",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  contactName: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800",
  },
  contactStatus: {
    color: "#16a34a",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  container: {
    backgroundColor: "#e9eff6",
    flex: 1,
  },
  conversationHeader: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderBottomColor: "#dbe4ef",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 56,
  },
  composerGhost: {
    left: 0,
    maxWidth: "100%",
    minHeight: 44,
    opacity: 0,
    position: "absolute",
    top: 0,
  },
  destinationGhost: {
    maxWidth: "100%",
    minHeight: 44,
    opacity: 0,
  },
  destinationSlot: {
    maxWidth: "78%",
    minHeight: 44,
  },
  draftText: {
    color: "#0f172a",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
  },
  draftTextLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  flightBubble: {
    position: "absolute",
  },
  inputSlot: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    height: 44,
    overflow: "hidden",
  },
  messageBubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 8,
    width: "100%",
  },
  messageRowLeft: {
    justifyContent: "flex-start",
  },
  messageRowRight: {
    justifyContent: "flex-end",
  },
  messagesContent: {
    paddingBottom: 20,
    paddingHorizontal: 14,
    paddingTop: 18,
  },
  placeholder: {
    color: "#94a3b8",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  receivedBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  receivedText: {
    color: "#1f2937",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
  },
  root: {
    flex: 1,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sendButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  sendButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  sentBubble: {
    backgroundColor: "#2563eb",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 5,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  sentText: {
    color: "#ffffff",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
  },
  settledBubble: {
    minHeight: 44,
    width: "100%",
  },
  textInput: {
    ...StyleSheet.absoluteFillObject,
    color: "#0f172a",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
});
