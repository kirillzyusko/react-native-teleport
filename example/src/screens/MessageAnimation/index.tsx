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
  Image,
} from "react-native";
import { Portal, PortalHost } from "react-native-teleport";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const FLIGHT_HOST = "message-animation-flight";
const ATTACHMENT_PREVIEW_HOST = "message-animation-attachment-preview";
const DRAFT_PORTAL = "message-animation-draft";
const MESSAGE_FONT_SIZE = 17;
const MESSAGE_LINE_HEIGHT = 22;
const ATTACHMENT_CARD_WIDTH = 292;
const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA0IDAgUiA+PiA+PiAvQ29udGVudHMgNSAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iago1IDAgb2JqCjw8IC9MZW5ndGggMzAwID4+CnN0cmVhbQpCVAovRjEgMjQgVGYKNTYgNzQ0IFRkCihQcmFnYSBMdW5jaCBNZW51KSBUagowIC00MiBUZAovRjEgMTQgVGYKKFRvZGF5J3Mgc2FtcGxlIGF0dGFjaG1lbnQpIFRqCjAgLTM4IFRkCi9GMSAxNiBUZgooMS4gVG9tYXRvIHNvdXAgLSAxOCBQTE4pIFRqCjAgLTI4IFRkCigyLiBQaWVyb2dpIHdpdGggaGVyYnMgLSAzMiBQTE4pIFRqCjAgLTI4IFRkCigzLiBBcHBsZSBjYWtlIC0gMTkgUExOKSBUagowIC00MiBUZAovRjEgMTIgVGYKKEdlbmVyYXRlZCBzYW1wbGUgUERGIGZvciB0aGUgdGVsZXBvcnQgY2hhdCBkZW1vLikgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDEgMDAwMDAgbiAKMDAwMDAwMDMxMSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjY2MgolJUVPRgo=";
const MAP_HTML = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; margin: 0; width: 100%; }
      .leaflet-control-attribution { display: none; }
      .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .leaflet-top.leaflet-left { top: 72px; }
      .leaflet-control-zoom {
        border: 0;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.22);
        overflow: hidden;
      }
      .leaflet-control-zoom a {
        border: 0;
        color: #0f172a;
        height: 36px;
        line-height: 36px;
        width: 36px;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const map = L.map("map", { zoomControl: true }).setView([52.2531, 21.0446], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(map);
      L.marker([52.2531, 21.0446]).addTo(map).bindPopup("Koneser");
      let resizeTicks = 0;
      const resizeTimer = setInterval(() => {
        map.invalidateSize({ pan: false });
        resizeTicks += 1;

        if (resizeTicks > 14) {
          clearInterval(resizeTimer);
        }
      }, 80);
      window.addEventListener("resize", () => map.invalidateSize());
    </script>
  </body>
</html>`;
const PDF_HTML = `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; width: 100%; }
      body {
        align-items: center;
        background: #f1f5f9;
        display: flex;
        justify-content: center;
        overflow: hidden;
      }
      #viewer {
        align-items: center;
        display: flex;
        height: 100%;
        justify-content: center;
        width: 100%;
      }
      canvas {
        background: #ffffff;
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.16);
        display: block;
      }
      #fallback {
        color: #64748b;
        display: none;
        font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  </head>
  <body>
    <div id="viewer">
      <canvas id="page"></canvas>
      <div id="fallback">Unable to render PDF preview</div>
    </div>
    <script>
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      const pdfBytes = Uint8Array.from(
        atob("${SAMPLE_PDF_BASE64}"),
        (character) => character.charCodeAt(0),
      );
      let pdfPage = null;
      let renderTask = null;

      async function renderPage() {
        const canvas = document.getElementById("page");
        const viewer = document.getElementById("viewer");
        const context = canvas.getContext("2d");
        const sourceViewport = pdfPage.getViewport({ scale: 1 });
        const scale =
          Math.min(
            viewer.clientWidth / sourceViewport.width,
            viewer.clientHeight / sourceViewport.height,
          ) * 0.88;
        const viewport = pdfPage.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;

        if (renderTask) {
          renderTask.cancel();
          try {
            await renderTask.promise;
          } catch (_error) {}
          renderTask = null;
        }

        canvas.style.height = viewport.height + "px";
        canvas.style.width = viewport.width + "px";
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        const currentRenderTask = pdfPage.render({ canvasContext: context, viewport });
        renderTask = currentRenderTask;

        try {
          await currentRenderTask.promise;
        } catch (error) {
          if (error?.name !== "RenderingCancelledException") {
            throw error;
          }
        } finally {
          if (renderTask === currentRenderTask) {
            renderTask = null;
          }
        }
      }

      async function start() {
        try {
          const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
          pdfPage = await pdf.getPage(1);
          await renderPage();
        } catch (_error) {
          document.getElementById("page").style.display = "none";
          document.getElementById("fallback").style.display = "block";
        }
      }

      window.addEventListener("resize", () => {
        if (pdfPage) {
          renderPage().catch(() => {});
        }
      });
      start();
    </script>
  </body>
</html>`;

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
    <WebView
      originWhitelist={["*"]}
      source={{ html: PDF_HTML }}
      style={styles.attachmentWebView}
    />
  );
}

function MapArtwork() {
  return (
    <WebView
      originWhitelist={["*"]}
      source={{ html: MAP_HTML }}
      style={styles.attachmentWebView}
    />
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
  attachmentWebView: {
    backgroundColor: "#f1f5f9",
    flex: 1,
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
