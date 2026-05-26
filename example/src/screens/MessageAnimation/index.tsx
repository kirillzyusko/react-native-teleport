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
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FLIGHT_HOST = "message-animation-flight";
const ATTACHMENT_PREVIEW_HOST = "message-animation-attachment-preview";
const DRAFT_PORTAL = "message-animation-draft";
const MESSAGE_FONT_SIZE = 17;
const MESSAGE_LINE_HEIGHT = 22;
const ATTACHMENT_CARD_WIDTH = 292;

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
  {
    attachment: {
      id: "menu-pdf",
      kind: "pdf",
      meta: "2 pages · 1.2 MB",
      subtitle: "Restaurant menu",
      title: "Lunch menu.pdf",
    },
    id: "msg-4",
    sender: "me",
  },
  {
    attachment: {
      id: "route-map",
      kind: "map",
      meta: "8 min walk",
      subtitle: "Warsaw · 1.1 km",
      title: "Route to Koneser",
    },
    id: "msg-5",
    sender: "me",
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

type Attachment = {
  id: string;
  kind: "map" | "pdf";
  meta: string;
  subtitle: string;
  title: string;
};

type ActiveAttachment = {
  attachment: Attachment;
  from: Frame;
  phase: "closing" | "open" | "opening";
  to: Frame;
};

type ChatMessage = {
  attachment?: Attachment;
  id: string;
  sender: "me" | "them";
  text?: string;
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

type AttachmentCardProps = {
  activeAttachment?: ActiveAttachment | null;
  attachment: Attachment;
  disabled?: boolean;
  hidden?: boolean;
  onClose?: () => void;
  onPress?: (attachment: Attachment) => void;
  previewProgress?: Animated.Value;
};

type AttachmentMessageProps = {
  activeAttachment: ActiveAttachment | null;
  attachment: Attachment;
  onClose: () => void;
  onOpen: (attachment: Attachment) => void;
  previewProgress: Animated.Value;
  registerRef: (node: ViewRef | null) => void;
  sender: ChatMessage["sender"];
};

const messageHostName = (id: string) => `message-animation-row-${id}`;
const attachmentPortalName = (id: string) =>
  `message-animation-attachment-${id}`;

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

function PdfArtwork() {
  return (
    <View style={styles.pdfArtwork}>
      <View style={styles.pdfPage}>
        <View style={styles.pdfHeaderLine} />
        <View style={styles.pdfLine} />
        <View style={[styles.pdfLine, styles.pdfLineShort]} />
        <View style={styles.pdfSection} />
        <View style={styles.pdfLine} />
        <View style={[styles.pdfLine, styles.pdfLineTiny]} />
      </View>
      <View style={styles.pdfBadge}>
        <Text style={styles.pdfBadgeText}>PDF</Text>
      </View>
    </View>
  );
}

function MapArtwork() {
  return (
    <View style={styles.mapArtwork}>
      <View style={styles.mapCanvas}>
        <View style={[styles.mapBlock, styles.mapBlockOne]} />
        <View style={[styles.mapBlock, styles.mapBlockTwo]} />
        <View style={[styles.mapBlock, styles.mapBlockThree]} />
        <View style={[styles.mapRoad, styles.mapRoadOne]} />
        <View style={[styles.mapRoad, styles.mapRoadTwo]} />
        <View style={[styles.mapRoad, styles.mapRoadThree]} />
        <View style={[styles.mapRoad, styles.mapRoadFour]} />
        <View style={styles.mapPark} />
        <View style={styles.mapWater} />
        <View style={styles.mapPin}>
          <FontAwesome6
            color="#ffffff"
            iconStyle="solid"
            name="location-dot"
            size={13}
          />
        </View>
      </View>
    </View>
  );
}

function AttachmentArtwork({ kind }: Pick<Attachment, "kind">) {
  return kind === "pdf" ? <PdfArtwork /> : <MapArtwork />;
}

function AttachmentCard({
  activeAttachment,
  attachment,
  disabled,
  hidden,
  onClose,
  onPress,
  previewProgress,
}: AttachmentCardProps) {
  const isPreview = activeAttachment?.attachment.id === attachment.id;
  const frame = activeAttachment;
  const progress = previewProgress;
  const previewFrameStyle =
    isPreview && frame && progress
      ? {
          borderRadius: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [18, 0],
          }),
          height: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [frame.from.height, frame.to.height],
          }),
          left: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [frame.from.x, frame.to.x],
          }),
          top: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [frame.from.y, frame.to.y],
          }),
          width: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [frame.from.width, frame.to.width],
          }),
        }
      : undefined;

  const content = (
    <>
      <AttachmentArtwork kind={attachment.kind} />
      <View style={styles.attachmentFooter}>
        <View
          style={[
            styles.attachmentIcon,
            attachment.kind === "map"
              ? styles.attachmentIconMap
              : styles.attachmentIconPdf,
          ]}
        >
          <FontAwesome6
            color="#ffffff"
            iconStyle="solid"
            name={attachment.kind === "map" ? "map-location-dot" : "file-pdf"}
            size={16}
          />
        </View>
        <View style={styles.attachmentCopy}>
          <Text numberOfLines={1} style={styles.attachmentTitle}>
            {attachment.title}
          </Text>
          <Text numberOfLines={1} style={styles.attachmentSubtitle}>
            {attachment.subtitle} · {attachment.meta}
          </Text>
        </View>
        {isPreview && onClose && (
          <Pressable onPress={onClose} style={styles.attachmentCloseButton}>
            <FontAwesome6
              color="#0f172a"
              iconStyle="solid"
              name="xmark"
              size={16}
            />
          </Pressable>
        )}
      </View>
    </>
  );

  return (
    <Animated.View
      style={[
        styles.attachmentCard,
        hidden && styles.hidden,
        isPreview && styles.attachmentPreviewCard,
        previewFrameStyle,
      ]}
    >
      {content}
      {onPress && !isPreview && !hidden && (
        <Pressable
          disabled={disabled}
          onPress={() => onPress(attachment)}
          style={({ pressed }) => [
            styles.attachmentPressTarget,
            pressed && !disabled && styles.attachmentCardPressed,
          ]}
        />
      )}
    </Animated.View>
  );
}

function AttachmentMessage({
  activeAttachment,
  attachment,
  onClose,
  onOpen,
  previewProgress,
  registerRef,
  sender,
}: AttachmentMessageProps) {
  const isActive = activeAttachment?.attachment.id === attachment.id;

  return (
    <View
      style={[
        styles.messageRow,
        sender === "me" ? styles.messageRowRight : styles.messageRowLeft,
      ]}
    >
      <View ref={registerRef} collapsable={false} style={styles.attachmentSlot}>
        {isActive && <AttachmentCard attachment={attachment} hidden />}
        <Portal
          hostName={isActive ? ATTACHMENT_PREVIEW_HOST : undefined}
          name={attachmentPortalName(attachment.id)}
          style={isActive ? StyleSheet.absoluteFillObject : undefined}
        >
          <AttachmentCard
            activeAttachment={activeAttachment}
            attachment={attachment}
            disabled={Boolean(activeAttachment)}
            onClose={onClose}
            onPress={onOpen}
            previewProgress={previewProgress}
          />
        </Portal>
      </View>
    </View>
  );
}

function MessageBubble({ sender, text }: ChatMessage & { text: string }) {
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
  const attachmentRefs = useRef<Record<string, ViewRef | null>>({});
  const composerBubbleRef = useRef<ViewRef>(null);
  const rootRef = useRef<ViewRef>(null);
  const inputSlotRef = useRef<ViewRef>(null);
  const destinationSlotRef = useRef<ViewRef>(null);
  const scrollRef = useRef<ScrollViewRef>(null);
  const attachmentProgress = useRef(new Animated.Value(0)).current;
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [activeAttachment, setActiveAttachment] =
    useState<ActiveAttachment | null>(null);
  const [frames, setFrames] = useState<FlightFrames | null>(null);
  const [rootFrame, setRootFrame] = useState<Frame>({
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  });

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

  const registerAttachmentRef = useCallback(
    (id: string) => (node: ViewRef | null) => {
      attachmentRefs.current[id] = node;
    },
    [],
  );

  const handleAttachmentOpen = useCallback(
    async (attachment: Attachment) => {
      if (activeAttachment || rootFrame.width === 0 || rootFrame.height === 0) {
        return;
      }

      const from = await measureInRoot(
        attachmentRefs.current[attachment.id] ?? null,
      );

      if (!from) {
        return;
      }

      attachmentProgress.stopAnimation();
      attachmentProgress.setValue(0);
      setActiveAttachment({
        attachment,
        from,
        phase: "opening",
        to: rootFrame,
      });

      requestAnimationFrame(() => {
        Animated.timing(attachmentProgress, {
          duration: 460,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (!finished) {
            return;
          }

          setActiveAttachment((current) =>
            current?.attachment.id === attachment.id
              ? { ...current, phase: "open" }
              : current,
          );
        });
      });
    },
    [activeAttachment, attachmentProgress, measureInRoot, rootFrame],
  );

  const handleAttachmentClose = useCallback(() => {
    if (!activeAttachment || activeAttachment.phase === "closing") {
      return;
    }

    const id = activeAttachment.attachment.id;

    setActiveAttachment((current) =>
      current?.attachment.id === id
        ? { ...current, phase: "closing" }
        : current,
    );
    attachmentProgress.stopAnimation();

    Animated.timing(attachmentProgress, {
      duration: 360,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setActiveAttachment((current) =>
        current?.attachment.id === id ? null : current,
      );
    });
  }, [activeAttachment, attachmentProgress]);

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
      if (message.attachment) {
        return (
          <AttachmentMessage
            key={message.id}
            activeAttachment={activeAttachment}
            attachment={message.attachment}
            onClose={handleAttachmentClose}
            onOpen={handleAttachmentOpen}
            previewProgress={attachmentProgress}
            registerRef={registerAttachmentRef(message.attachment.id)}
            sender={message.sender}
          />
        );
      }

      if (!message.pending || !activeDraft) {
        if (!message.text) {
          return null;
        }

        return (
          <MessageBubble key={message.id} {...message} text={message.text} />
        );
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
    [
      activeAttachment,
      activeDraft,
      attachmentProgress,
      handleAttachmentClose,
      handleAttachmentOpen,
      registerAttachmentRef,
    ],
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
      <View
        ref={rootRef}
        collapsable={false}
        onLayout={({ nativeEvent }) => {
          const { height, width } = nativeEvent.layout;

          setRootFrame({ height, width, x: 0, y: 0 });
        }}
        style={styles.root}
      >
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
        <View
          pointerEvents={activeAttachment ? "box-none" : "none"}
          style={StyleSheet.absoluteFillObject}
        >
          <PortalHost
            name={ATTACHMENT_PREVIEW_HOST}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  attachmentCard: {
    backgroundColor: "#ffffff",
    borderColor: "#dbe4ef",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    height: 206,
    maxWidth: "100%",
    overflow: "hidden",
    width: ATTACHMENT_CARD_WIDTH,
  },
  attachmentCardPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  attachmentCloseButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  attachmentCopy: {
    flex: 1,
  },
  attachmentFooter: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    gap: 10,
    height: 64,
    paddingHorizontal: 12,
  },
  attachmentIcon: {
    alignItems: "center",
    borderRadius: 11,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  attachmentIconMap: {
    backgroundColor: "#16a34a",
  },
  attachmentIconPdf: {
    backgroundColor: "#dc2626",
  },
  attachmentPressTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  attachmentPreviewCard: {
    borderRadius: 0,
    elevation: 10,
    position: "absolute",
    shadowColor: "#020617",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  attachmentSlot: {
    maxWidth: "82%",
    width: ATTACHMENT_CARD_WIDTH,
  },
  attachmentSubtitle: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  attachmentTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 19,
  },
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
  hidden: {
    opacity: 0,
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
  mapArtwork: {
    backgroundColor: "#dff5e7",
    flex: 1,
    overflow: "hidden",
  },
  mapBlock: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderColor: "#cbd5e1",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    position: "absolute",
  },
  mapBlockOne: {
    height: 138,
    left: 124,
    top: 142,
    transform: [{ rotate: "-8deg" }],
    width: 180,
  },
  mapBlockThree: {
    height: 150,
    left: 560,
    top: 336,
    transform: [{ rotate: "12deg" }],
    width: 238,
  },
  mapBlockTwo: {
    height: 184,
    left: 384,
    top: 112,
    transform: [{ rotate: "7deg" }],
    width: 246,
  },
  mapCanvas: {
    backgroundColor: "#dff5e7",
    height: 1100,
    left: -420,
    position: "absolute",
    top: -320,
    width: 1200,
  },
  mapPark: {
    backgroundColor: "#b7e6c8",
    borderRadius: 999,
    height: 212,
    left: 392,
    position: "absolute",
    top: 244,
    width: 276,
  },
  mapPin: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 3,
    height: 32,
    justifyContent: "center",
    left: 548,
    position: "absolute",
    top: 366,
    width: 32,
  },
  mapRoad: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 18,
    position: "absolute",
    width: 780,
  },
  mapRoadFour: {
    left: 196,
    top: 528,
    transform: [{ rotate: "-31deg" }],
  },
  mapRoadOne: {
    left: 250,
    top: 340,
    transform: [{ rotate: "-18deg" }],
  },
  mapRoadThree: {
    left: 238,
    top: 452,
    transform: [{ rotate: "22deg" }],
  },
  mapRoadTwo: {
    left: 364,
    top: 398,
    transform: [{ rotate: "7deg" }],
  },
  mapWater: {
    backgroundColor: "#93c5fd",
    borderRadius: 999,
    height: 250,
    left: 734,
    position: "absolute",
    top: 466,
    transform: [{ rotate: "-20deg" }],
    width: 360,
  },
  pdfArtwork: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    flex: 1,
    justifyContent: "center",
  },
  pdfBadge: {
    backgroundColor: "#dc2626",
    borderRadius: 8,
    bottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
    right: 16,
  },
  pdfBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0,
  },
  pdfHeaderLine: {
    backgroundColor: "#dc2626",
    borderRadius: 999,
    height: 10,
    marginBottom: 14,
    width: "58%",
  },
  pdfLine: {
    backgroundColor: "#cbd5e1",
    borderRadius: 999,
    height: 7,
    marginBottom: 9,
    width: "100%",
  },
  pdfLineShort: {
    width: "72%",
  },
  pdfLineTiny: {
    width: "46%",
  },
  pdfPage: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    height: "76%",
    overflow: "hidden",
    padding: 14,
    width: "48%",
  },
  pdfSection: {
    backgroundColor: "#e0f2fe",
    borderRadius: 6,
    height: 28,
    marginBottom: 11,
    width: "100%",
  },
  placeholder: {
    color: "#94a3b8",
    fontSize: MESSAGE_FONT_SIZE,
    lineHeight: MESSAGE_LINE_HEIGHT,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  previewArtwork: {
    flex: 1,
    padding: 18,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020617",
  },
  previewCloseButton: {
    alignItems: "center",
    backgroundColor: "#e2e8f0",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  previewFullContent: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f8fafc",
  },
  previewHeader: {
    alignItems: "center",
    borderBottomColor: "#e2e8f0",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  previewHeaderCopy: {
    flex: 1,
  },
  previewSafeArea: {
    flex: 1,
  },
  previewSubtitle: {
    color: "#64748b",
    fontSize: 14,
    lineHeight: 18,
    marginTop: 3,
  },
  previewSurface: {
    backgroundColor: "#ffffff",
    elevation: 10,
    overflow: "hidden",
    position: "absolute",
    shadowColor: "#020617",
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
  },
  previewTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 25,
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
