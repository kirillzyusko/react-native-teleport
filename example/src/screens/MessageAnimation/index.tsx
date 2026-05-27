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
  Image,
  type ImageSourcePropType,
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
import BlurView from "../../components/BlurView";
import { AttachmentArtwork, type AttachmentKind } from "./AttachmentArtwork";

const FLIGHT_HOST = "message-animation-flight";
const ATTACHMENT_PREVIEW_HOST = "message-animation-attachment-preview";
const STICKER_PREVIEW_HOST = "message-animation-sticker-preview";
const DRAFT_PORTAL = "message-animation-draft";
const MESSAGE_FONT_SIZE = 17;
const MESSAGE_LINE_HEIGHT = 22;
const ATTACHMENT_CARD_WIDTH = 292;
const STICKER_KEYBOARD_HEIGHT = 300;
const STICKER_PREVIEW_SIZE = 224;
const STICKERS: Sticker[] = [
  {
    id: "love",
    label: "Love",
    source:
      "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXllcGk2eG1qcGxkdG1vNnlqM2RmN2Q0Z2xsNHR5N2Z1cDk3YjFiNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fWfowxJtHySJ0SGCgN/giphy.gif",
  },
  {
    id: "lol",
    label: "Laugh",
    source:
      "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWkwNjBnbmE0dHdkaWRuajBqNmJrcGI2OHRoODByM2t5cXF1Zm9nYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/14fe94oGGsupaw/giphy.gif",
  },
  {
    id: "yes",
    label: "Yes",
    source:
      "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExenpia3U5ajV6cGV4M3ZqcHY0ZDQ4ZXV2cnRrY2F4dDZjNXE0eHp6YyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/g9582DNuQppxC/giphy.gif",
  },
  {
    id: "wow",
    label: "Wow",
    source:
      "https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMDFtbWFyYXNocGl2dm4xaDZvdDg0YmNhbGNkOWF1d2ozeDNpMGd1MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LPFNd1AJBoYcVUExmE/giphy.gif",
  },
  {
    id: "fire",
    label: "Fire",
    source:
      "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHd5MncwYW1qNXVlaWRudGFnb290OTU3NGJsd2NrcDI2czBncWNhbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/V7jkATiqn3mRie2LI2/giphy.gif",
  },
  {
    id: "party",
    label: "Party",
    source:
      "https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExdDRmY3FtanFpeGl3eGlydzA4M3VnamtyOGFiY2oyZWRwbHNoMWJ4MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/kaBU6pgv0OsPHz2yxy/giphy.gif",
  },
  {
    id: "coffee",
    label: "Coffee",
    source:
      "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGRiazh4bmYyYzhlZjEwcjdocDQ3YmoyaHVwem9xaGZhdWg1ZWNnNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/wyi5tYZJvkMLIgRmXv/giphy.gif",
  },
  {
    id: "pizza",
    label: "Pizza",
    source:
      "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTMwaDd5ZnR6NnJwOTVrb2Z3aWNtMHVqNXJvN2RjNWhvbXVvdjRlcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ZqlvCTNHpqrio/giphy.gif",
  },
  {
    id: "ok",
    label: "Ok",
    source:
      "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZnZ3ZXltem12OHF4aXdyMjRoMWhsN3N1aHFldmZlMzd2Z3RmYmJzaCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/meJN6qdG74lUKAJTQl/giphy.gif",
  },
  {
    id: "cool",
    label: "Cool",
    source:
      "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGtkbzM1d2QxNzliMHRuam1tdnRyc2tjdjFlbGhkanF6YWJkbDFrYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/wYyTHMm50f4Dm/giphy.gif",
  },
  {
    id: "star",
    label: "Star",
    source:
      "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbHVjbm1nZ2YwanBwdWcwNTFzcm4zbnhjeGtyaDZra3Rtd2FqY21tOCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/AAsj7jdrHjtp6/giphy.gif",
  },
  {
    id: "clap",
    label: "Clap",
    source:
      "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYzdidjRxZXUxZXdtb2dnaW56aXQ5bHU2ZjI2NWlsbmdpaWVqbHoxbCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d3mlE7uhX8KFgEmY/giphy.gif",
  },
  {
    id: "rocket",
    label: "Rocket",
    source: require("./stickers/rocket.gif"),
  },
  {
    id: "sparkle",
    label: "Sparkle",
    source: require("./stickers/sparkle.gif"),
  },
  {
    id: "thanks",
    label: "Thanks",
    source: require("./stickers/thanks.gif"),
  },
  {
    id: "idea",
    label: "Idea",
    source: require("./stickers/idea.gif"),
  },
];

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
      meta: "1 page · 480 KB",
      subtitle: "Bistro",
      title: "Koneser menu.pdf",
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
  kind: AttachmentKind;
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

type Sticker = {
  id: string;
  label: string;
  source: ImageSourcePropType | string;
};

type ActiveSticker = {
  from: Frame;
  phase: "closing" | "open" | "opening";
  sticker: Sticker;
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

type StickerKeyboardProps = {
  activeSticker: ActiveSticker | null;
  bottomInset: number;
  keyboardProgress: Animated.Value;
  onClose: () => void;
  onStickerPress: (sticker: Sticker) => void;
  previewProgress: Animated.Value;
  registerRef: (id: string) => (node: ViewRef | null) => void;
  visible: boolean;
};

type StickerTileProps = {
  activeSticker: ActiveSticker | null;
  onPress: (sticker: Sticker) => void;
  previewProgress: Animated.Value;
  registerRef: (node: ViewRef | null) => void;
  sticker: Sticker;
};

type StickerArtworkProps = {
  activeSticker: ActiveSticker | null;
  onPress?: (sticker: Sticker) => void;
  previewProgress: Animated.Value;
  sticker: Sticker;
};

type StickerPreviewLayerProps = {
  activeSticker: ActiveSticker | null;
  onClose: () => void;
  previewProgress: Animated.Value;
};

const messageHostName = (id: string) => `message-animation-row-${id}`;
const attachmentPortalName = (id: string) =>
  `message-animation-attachment-${id}`;
const stickerPortalName = (id: string) => `message-animation-sticker-${id}`;
const stickerImageSource = (source: Sticker["source"]): ImageSourcePropType =>
  typeof source === "string" ? { uri: source } : source;

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
  const closeButtonOpacity =
    isPreview && progress
      ? progress.interpolate({
          extrapolate: "clamp",
          inputRange: [0.55, 1],
          outputRange: [0, 1],
        })
      : 1;

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
          <Animated.View style={{ opacity: closeButtonOpacity }}>
            <Pressable onPress={onClose} style={styles.attachmentCloseButton}>
              <FontAwesome6
                color="#0f172a"
                iconStyle="solid"
                name="xmark"
                size={16}
              />
            </Pressable>
          </Animated.View>
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
      {!hidden && content}
      {!hidden && onPress && !isPreview && (
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

function StickerKeyboard({
  activeSticker,
  bottomInset,
  keyboardProgress,
  onClose,
  onStickerPress,
  previewProgress,
  registerRef,
  visible,
}: StickerKeyboardProps) {
  const translateY = keyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [STICKER_KEYBOARD_HEIGHT + bottomInset, 0],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        styles.stickerKeyboard,
        {
          height: STICKER_KEYBOARD_HEIGHT + bottomInset,
          paddingBottom: bottomInset + 14,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.stickerKeyboardHeader}>
        <Text style={styles.stickerKeyboardTitle}>Stickers</Text>
        <Pressable onPress={onClose} style={styles.stickerKeyboardClose}>
          <FontAwesome6
            color="#334155"
            iconStyle="solid"
            name="chevron-down"
            size={15}
          />
        </Pressable>
      </View>
      <View style={styles.stickerGrid}>
        {STICKERS.map((sticker) => (
          <StickerTile
            key={sticker.id}
            activeSticker={activeSticker}
            onPress={onStickerPress}
            previewProgress={previewProgress}
            registerRef={registerRef(sticker.id)}
            sticker={sticker}
          />
        ))}
      </View>
    </Animated.View>
  );
}

function StickerTile({
  activeSticker,
  onPress,
  previewProgress,
  registerRef,
  sticker,
}: StickerTileProps) {
  const isActive = activeSticker?.sticker.id === sticker.id;

  return (
    <View ref={registerRef} collapsable={false} style={styles.stickerTileSlot}>
      {isActive && <View style={[styles.stickerTile, styles.hidden]} />}
      <Portal
        hostName={isActive ? STICKER_PREVIEW_HOST : undefined}
        name={stickerPortalName(sticker.id)}
        style={isActive ? StyleSheet.absoluteFillObject : undefined}
      >
        <StickerArtwork
          activeSticker={activeSticker}
          onPress={onPress}
          previewProgress={previewProgress}
          sticker={sticker}
        />
      </Portal>
    </View>
  );
}

function StickerArtwork({
  activeSticker,
  onPress,
  previewProgress,
  sticker,
}: StickerArtworkProps) {
  const isPreview = activeSticker?.sticker.id === sticker.id;
  const progress = previewProgress;
  const from = activeSticker?.from;
  const to = activeSticker?.to;
  const previewStyle =
    isPreview && from && to
      ? {
          height: from.height,
          left: from.x,
          top: from.y,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  0,
                  to.x + to.width / 2 - (from.x + from.width / 2),
                ],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [
                  0,
                  to.y + to.height / 2 - (from.y + from.height / 2),
                ],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, to.width / from.width],
              }),
            },
          ],
          width: from.width,
        }
      : undefined;

  return (
    <Animated.View
      style={[
        styles.stickerTile,
        isPreview && styles.stickerPreviewTile,
        previewStyle,
      ]}
    >
      <Image
        accessibilityLabel={sticker.label}
        source={stickerImageSource(sticker.source)}
        style={styles.stickerImage}
      />
      {onPress && !isPreview && (
        <Pressable
          accessibilityLabel={sticker.label}
          accessibilityRole="button"
          onPress={() => onPress(sticker)}
          style={styles.stickerPressTarget}
        />
      )}
    </Animated.View>
  );
}

function StickerPreviewLayer({
  activeSticker,
  onClose,
  previewProgress,
}: StickerPreviewLayerProps) {
  const scrimOpacity = previewProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.16],
  });

  return (
    <View
      pointerEvents={activeSticker ? "box-none" : "none"}
      style={StyleSheet.absoluteFillObject}
    >
      {activeSticker && (
        <Pressable onPress={onClose} style={StyleSheet.absoluteFillObject}>
          <BlurView visible={activeSticker.phase !== "closing"} />
          <Animated.View
            pointerEvents="none"
            style={[styles.stickerPreviewScrim, { opacity: scrimOpacity }]}
          />
        </Pressable>
      )}
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <PortalHost
          name={STICKER_PREVIEW_HOST}
          style={StyleSheet.absoluteFillObject}
        />
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
  const isHidingStickerKeyboardRef = useRef(false);
  const scrollRef = useRef<ScrollViewRef>(null);
  const stickerRefs = useRef<Record<string, ViewRef | null>>({});
  const textInputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const attachmentProgress = useRef(new Animated.Value(0)).current;
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const stickerKeyboardProgress = useRef(new Animated.Value(0)).current;
  const stickerPreviewProgress = useRef(new Animated.Value(0)).current;

  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const [activeDraft, setActiveDraft] = useState<ActiveDraft | null>(null);
  const [activeAttachment, setActiveAttachment] =
    useState<ActiveAttachment | null>(null);
  const [activeSticker, setActiveSticker] = useState<ActiveSticker | null>(
    null,
  );
  const [frames, setFrames] = useState<FlightFrames | null>(null);
  const [isStickerKeyboardVisible, setStickerKeyboardVisible] = useState(false);
  const [rootFrame, setRootFrame] = useState<Frame>({
    height: 0,
    width: 0,
    x: 0,
    y: 0,
  });
  const contentTranslateY = stickerKeyboardProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -STICKER_KEYBOARD_HEIGHT],
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

  const registerStickerRef = useCallback(
    (id: string) => (node: ViewRef | null) => {
      stickerRefs.current[id] = node;
    },
    [],
  );

  const showStickerKeyboard = useCallback(() => {
    isHidingStickerKeyboardRef.current = false;
    setStickerKeyboardVisible(true);
    stickerKeyboardProgress.stopAnimation();
    Animated.timing(stickerKeyboardProgress, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [stickerKeyboardProgress]);

  const hideStickerKeyboard = useCallback(
    ({ blurInput = true }: { blurInput?: boolean } = {}) => {
      if (isHidingStickerKeyboardRef.current && !blurInput) {
        return;
      }

      if (!isStickerKeyboardVisible) {
        if (blurInput) {
          textInputRef.current?.blur();
        }

        return;
      }

      isHidingStickerKeyboardRef.current = true;

      if (blurInput) {
        textInputRef.current?.blur();
      }

      stickerKeyboardProgress.stopAnimation();
      Animated.timing(stickerKeyboardProgress, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }).start(({ finished }) => {
        isHidingStickerKeyboardRef.current = false;

        if (finished) {
          setStickerKeyboardVisible(false);
        }
      });
    },
    [isStickerKeyboardVisible, stickerKeyboardProgress],
  );

  const handleInputEndEditing = useCallback(() => {
    hideStickerKeyboard({ blurInput: false });
  }, [hideStickerKeyboard]);

  const handleStickerKeyboardClose = useCallback(() => {
    hideStickerKeyboard();
  }, [hideStickerKeyboard]);

  const handleStickerPress = useCallback(
    async (sticker: Sticker) => {
      if (activeSticker || rootFrame.width === 0 || rootFrame.height === 0) {
        return;
      }

      const from = await measureInRoot(stickerRefs.current[sticker.id] ?? null);

      if (!from) {
        return;
      }

      const previewSize = Math.min(
        STICKER_PREVIEW_SIZE,
        rootFrame.width - 72,
        rootFrame.height - STICKER_KEYBOARD_HEIGHT - 64,
      );
      const size = Math.max(168, previewSize);
      const to = {
        height: size,
        width: size,
        x: (rootFrame.width - size) / 2,
        y: (rootFrame.height - STICKER_KEYBOARD_HEIGHT - size) / 2,
      };

      stickerPreviewProgress.stopAnimation();
      stickerPreviewProgress.setValue(0);
      setActiveSticker({
        from,
        phase: "opening",
        sticker,
        to,
      });

      requestAnimationFrame(() => {
        Animated.timing(stickerPreviewProgress, {
          duration: 420,
          easing: Easing.out(Easing.cubic),
          toValue: 1,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) {
            return;
          }

          setActiveSticker((current) =>
            current?.sticker.id === sticker.id
              ? { ...current, phase: "open" }
              : current,
          );
        });
      });
    },
    [activeSticker, measureInRoot, rootFrame, stickerPreviewProgress],
  );

  const handleStickerClose = useCallback(() => {
    if (!activeSticker || activeSticker.phase === "closing") {
      return;
    }

    const id = activeSticker.sticker.id;

    setActiveSticker((current) =>
      current?.sticker.id === id ? { ...current, phase: "closing" } : current,
    );
    stickerPreviewProgress.stopAnimation();

    Animated.timing(stickerPreviewProgress, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setActiveSticker((current) =>
        current?.sticker.id === id ? null : current,
      );
    });
  }, [activeSticker, stickerPreviewProgress]);

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
            <Image
              source={require("./avatar.jpeg")}
              style={styles.avatarText}
            />
          </View>
          <View>
            <Text style={styles.contactName}>Ksenia</Text>
            <Text style={styles.contactStatus}>online</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.chatContent,
            { transform: [{ translateY: contentTranslateY }] },
          ]}
        >
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.messagesContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
            showsVerticalScrollIndicator={false}
          >
            {renderedMessages.map(renderMessage)}
          </ScrollView>

          <View
            style={[styles.composer, { paddingBottom: insets.bottom + 12 }]}
          >
            <View
              ref={inputSlotRef}
              collapsable={false}
              style={styles.inputSlot}
            >
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
                ref={textInputRef}
                autoCapitalize="sentences"
                editable={!activeDraft}
                onChangeText={setInputText}
                onEndEditing={handleInputEndEditing}
                onFocus={showStickerKeyboard}
                onSubmitEditing={handleSend}
                placeholder=""
                returnKeyType="send"
                selectionColor="#2563eb"
                showSoftInputOnFocus={false}
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
        </Animated.View>

        <StickerKeyboard
          activeSticker={activeSticker}
          bottomInset={insets.bottom}
          keyboardProgress={stickerKeyboardProgress}
          onClose={handleStickerKeyboardClose}
          onStickerPress={handleStickerPress}
          previewProgress={stickerPreviewProgress}
          registerRef={registerStickerRef}
          visible={isStickerKeyboardVisible}
        />

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
        <StickerPreviewLayer
          activeSticker={activeSticker}
          onClose={handleStickerClose}
          previewProgress={stickerPreviewProgress}
        />
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
    width: 40,
    height: 40,
    borderRadius: 20,
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  chatContent: {
    flex: 1,
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
    elevation: 2,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 56,
    zIndex: 2,
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
    overflow: "hidden",
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
  stickerGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 14,
  },
  stickerImage: {
    height: "100%",
    width: "100%",
  },
  stickerKeyboard: {
    backgroundColor: "#f8fafc",
    borderTopColor: "#dbe4ef",
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    paddingTop: 10,
    position: "absolute",
    right: 0,
  },
  stickerKeyboardClose: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  stickerKeyboardHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  stickerKeyboardTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  stickerPressTarget: {
    ...StyleSheet.absoluteFillObject,
  },
  stickerPreviewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#020617",
  },
  stickerPreviewTile: {
    elevation: 18,
    position: "absolute",
    shadowColor: "#020617",
    shadowOffset: { height: 20, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 30,
  },
  stickerTile: {
    alignItems: "center",
    aspectRatio: 1,
    justifyContent: "center",
    overflow: "visible",
    width: "100%",
  },
  stickerTileSlot: {
    flexBasis: "22%",
    flexGrow: 1,
    maxWidth: "23.5%",
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
