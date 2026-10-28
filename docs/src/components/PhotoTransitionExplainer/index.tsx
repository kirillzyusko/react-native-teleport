import { useEffect, useId, useMemo, useRef, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useBaseUrl from "@docusaurus/useBaseUrl";

import styles from "./styles.module.css";

// Geometry mirrors example/src/screens/PhotoGallery (390×844 screen, 3 columns)
const SAFE = 59;
const TOP = 104;
const TH = 130;
const SC = 3;
const IDS = [15, 10, 20, 25, 29, 36, 42, 49, 54, 58, 75, 76];
// height / width of the photos that can be tapped
const ASPECT: Record<number, number> = { 15: 1080 / 720, 49: 720 / 1080 };
const ZL = [0, 190, 380];

type Rect = { x: number; y: number; w: number; h: number };
const cellRect = (i: number): Rect => ({
  x: (i % 3) * TH,
  y: TOP + Math.floor(i / 3) * TH,
  w: TH,
  h: TH,
});
// the tapped photo: its cell in the grid and its proportions
type Hero = { cell: number; id: number; aspect: number };
const heroAt = (cell: number): Hero => {
  const id = IDS[cell] ?? IDS[0]!;
  return { cell, id, aspect: ASPECT[id] ?? 1 };
};
// the photo's frame at progress p: its cell at 0, full width below the status bar at 1
const heroRect = ({ cell, aspect }: Hero, p: number): Rect => {
  const c = cellRect(cell);
  const s = 1 + (SC - 1) * p;
  const diff = (390 * aspect) / SC - TH;
  return {
    x: c.x * (1 - p),
    y: c.y * (1 - p) + SAFE * p,
    w: TH * s,
    h: (TH + diff * p) * s,
  };
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const ss = (t: number, a: number, b: number) => {
  const k = clamp((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
// critically damped spring that settles with ~zero velocity at u = 1
const spring = (u: number) => {
  const k = 7;
  return (1 - (1 + k * u) * Math.exp(-k * u)) / (1 - (1 + k) * Math.exp(-k));
};
// position for a trapezoid velocity profile: eases in over `ai`, out over `ao`
const ramp = (x: number, ai: number, ao: number) => {
  x = clamp(x);
  const area = 1 - ai / 2 - ao / 2;
  let d: number;
  if (x < ai) d = (x * x) / (2 * ai);
  else if (x <= 1 - ao) d = ai / 2 + (x - ai);
  else d = ai / 2 + (1 - ao - ai) + ao / 2 - ((1 - x) * (1 - x)) / (2 * ao);
  return d / area;
};
const px = (v: number) => `${v.toFixed(2)}px`;

// ---------- story: chapters of the transition, each with its own start state ----------

export type ChapterId = "teleport" | "animate" | "handoff" | "return" | "close";
// "animate" is the flight without a handoff; the pipeline uses "handoff", which includes the flight
const PIPELINE: ChapterId[] = ["teleport", "handoff", "return", "close"];

type Chips = { low: number; hidden: number; ghost: number; full: number };
type Readout = {
  progress: number;
  source: number;
  target: number;
  host: string;
  fullRes: string;
};
const READOUTS: Array<keyof Readout> = [
  "progress",
  "host",
  "source",
  "target",
  "fullRes",
];
// what the app looks like at a moment of a chapter
type Core = {
  tap: "thumb" | "close" | null;
  tapK: number;
  /** step 4: nothing animates yet, the detail screen opens as is */
  plain: boolean;
  /** collapses the exploded layers: 1 shows the phone as users see it */
  flat: number;
  /** thumbnail z: 0 in its cell, 1 in the root host */
  lift: number;
  inHost: boolean;
  thumbP: number;
  thumbShown: boolean;
  outline: number;
  push: number;
  backdrop: number;
  detailP: number;
  ghost: number;
  ghostText: string;
  detailShown: boolean;
  /** seconds since the swap while the handoff is drawn */
  handT: number | null;
  flashK: number | null;
  closeK: number;
  guides: number;
  /** guides from the teleported thumbnail down to its empty cell */
  drop: number;
  chips: Chips;
  readout: Readout;
};
type Scene = Core & {
  ex: number;
  drift: number;
  fade: number;
  hud: number;
  labels: [number, number, number];
  caption: number;
};

const HOST = '"root"';
const IDLE: Core = {
  tap: null,
  tapK: -1,
  plain: false,
  flat: 0,
  lift: 0,
  inHost: false,
  thumbP: 0,
  thumbShown: true,
  outline: 0,
  push: 0,
  backdrop: 0,
  detailP: 0,
  ghost: 0,
  ghostText: "full-res, loading",
  detailShown: false,
  handT: null,
  flashK: null,
  closeK: 0,
  guides: 0,
  drop: 0,
  chips: { low: 0, hidden: 0, ghost: 0, full: 0 },
  readout: {
    progress: 0,
    source: 1,
    target: 0,
    host: "undefined",
    fullRes: "not requested",
  },
};
const core = (
  o: Partial<Omit<Core, "chips" | "readout">> & {
    chips?: Partial<Chips>;
    readout?: Partial<Readout>;
  },
): Core => ({
  ...IDLE,
  ...o,
  chips: { ...IDLE.chips, ...o.chips },
  readout: { ...IDLE.readout, ...o.readout },
});

type Chapter = {
  duration: number;
  /** a representative moment, shown as a still frame with reduced motion */
  still: number;
  title: string;
  captions: Array<[number, string, string]>;
  at: (u: number) => Core;
  /** store values that exist at this step; all of them by default */
  readouts?: Array<keyof Readout>;
  /** the tapped cell; the first one by default */
  cell?: number;
};

const H = { F0: 1.6, FS: 4.16, SWAP: 0.24, LAND: 1.3, RESUME: 7.1, FE: 10.7 };
const handoffU = (u: number) => {
  if (u <= H.F0) return 0;
  if (u < H.FS) return H.SWAP * ramp((u - H.F0) / (H.FS - H.F0), 0, 0.25);
  if (u < H.RESUME) return H.SWAP;
  if (u < H.FE)
    return (
      H.SWAP + (1 - H.SWAP) * ramp((u - H.RESUME) / (H.FE - H.RESUME), 0.2, 0)
    );
  return 1;
};
const LOADED = "loaded (onLoad fired)";

const CHAPTERS: Record<ChapterId, Chapter> = {
  teleport: {
    duration: 4.4,
    still: 3.6,
    title:
      "3D view of the teleport step: tapping a thumbnail moves it from the gallery into the root PortalHost, above every screen.",
    captions: [
      [
        0,
        "Every thumbnail is wrapped in a `<Portal>`",
        "Without a host name, it renders in place, inside the `FlatList`.",
      ],
      [
        0.9,
        "Tap teleports the thumbnail into the root `PortalHost`",
        '`<Portal hostName="root">` re-parents the same native view, in one frame.',
      ],
    ],
    at: (u) => {
      const inHost = u >= 0.9;
      return core({
        tap: "thumb",
        tapK: (u - 0.9) / 0.7,
        lift: ss(u, 1.4, 2.8),
        inHost,
        chips: { low: ss(u, 2.5, 3) },
        readout: { host: inHost ? HOST : "undefined" },
      });
    },
  },
  animate: {
    duration: 7.4,
    still: 3.4,
    title:
      "3D view of the animation step: a spring moves the low-res thumbnail from its cell to full screen inside the root PortalHost, while the full-res photo stays hidden.",
    captions: [
      [
        0,
        "The detail screen opens on top, transparent",
        "Its full-res photo is mounted but hidden: `visibility.target` is `0`.",
      ],
      [
        1.4,
        "A spring drives `progress` from `0` to `1`",
        "The thumbnail’s translate, scale and height are interpolated from it, above every screen.",
      ],
      [
        5.2,
        "The animation ends on the low-res thumbnail",
        "It’s blurry at full screen: nothing shows the full-res photo yet.",
      ],
    ],
    at: (u) => {
      const p = spring(clamp((u - 1.4) / 3.6));
      return core({
        lift: 1,
        inHost: true,
        thumbP: p,
        push: ss(u, 0.2, 0.9),
        backdrop: p,
        detailP: 1,
        ghost: ss(u, 0.5, 1.1),
        ghostText: "full-res, hidden",
        chips: { low: 1, ghost: ss(u, 0.6, 1.2) },
        readout: {
          progress: p,
          host: HOST,
          fullRes:
            u < 0.2 ? "not requested" : u < 2.4 ? "loading" : "loaded, hidden",
        },
      });
    },
  },
  handoff: {
    duration: 11.3,
    still: H.FS + H.LAND + 0.5,
    title:
      "3D view of the handoff step: the full-res photo follows the thumbnail’s path invisibly and takes over in one commit as soon as it loads, in the middle of the animation.",
    captions: [
      [
        0,
        "The detail screen mounts the full-res photo, invisible",
        "Its `<Image>` sits at `opacity: 0` on the thumbnail’s path while it loads.",
      ],
      [
        1.4,
        "Both ride the same spring, but you only see the low-res one",
        "One `progress` value drives translate, scale and height on both layers.",
      ],
      [
        H.FS,
        "When `onLoad` fires mid-flight, one commit swaps them",
        "`set({ visibility: { source: 0, target: 1 } })` hands the image over to the detail screen in the same native frame.",
      ],
      [
        H.RESUME,
        "The full-res photo finishes the animation",
        "The hidden thumbnail keeps pace until it ends.",
      ],
    ],
    at: (u) => {
      const p = spring(handoffU(u));
      const swapped = u >= H.FS;
      const landed = u >= H.FS + H.LAND;
      return core({
        lift: 1,
        inHost: true,
        thumbP: p,
        thumbShown: !swapped,
        outline: swapped ? ss(u, H.FS, H.FS + 0.5) : 0,
        push: ss(u, 0.2, 0.9),
        backdrop: p,
        detailP: p,
        ghost: landed ? 0 : ss(u, 0.5, 1.1),
        detailShown: landed,
        handT: swapped && u < H.FS + H.LAND + 0.4 ? u - H.FS : null,
        flashK:
          landed && u < H.FS + H.LAND + 1.4 ? (u - H.FS - H.LAND) / 1.4 : null,
        guides: clamp((u - H.F0 + 0.4) / 0.4) * (1 - ss(u, H.FE, H.FE + 0.4)),
        chips: {
          low: swapped ? 0 : 1,
          hidden: swapped ? 1 : 0,
          ghost: landed ? 0 : ss(u, 0.6, 1.2),
          full: landed ? 1 - ss(u, H.RESUME + 2.5, H.RESUME + 3) : 0,
        },
        readout: {
          progress: p,
          source: swapped ? 0 : 1,
          target: swapped ? 1 : 0,
          host: HOST,
          fullRes: u < 0.2 ? "not requested" : swapped ? LOADED : "loading",
        },
      });
    },
  },
  return: {
    duration: 4.2,
    still: 1.3,
    title:
      "3D view of the return step: after the animation the hidden thumbnail teleports back into its cell and the Close button appears.",
    captions: [
      [
        0,
        "When the animation ends, the thumbnail teleports back to its cell",
        "It stays hidden while the photo is open, and Close fades in.",
      ],
    ],
    at: (u) => {
      const reset = u >= 0.4;
      // the hidden thumbnail's progress resets to 0 instantly; fade its outline through the jump
      const resetFade = reset ? ss(u, 0.4, 0.65) : 1 - ss(u, 0.15, 0.4);
      return core({
        lift: 1 - ss(u, 0.7, 1.9),
        inHost: !reset,
        thumbP: reset ? 0 : 1,
        thumbShown: false,
        outline: resetFade,
        push: 1,
        backdrop: 1,
        detailP: 1,
        detailShown: true,
        closeK: ss(u, 1.3, 1.8),
        chips: { hidden: resetFade * (1 - ss(u, 1.9, 2.4)) },
        readout: {
          progress: reset && u < 1.9 ? 0 : 1,
          source: 0,
          target: 1,
          host: reset ? "undefined" : HOST,
          fullRes: LOADED,
        },
      });
    },
  },
  close: {
    duration: 6,
    still: 2.6,
    title:
      "3D view of the back transition: the full-res photo shrinks back into the cell, then the thumbnail is shown and the detail screen is removed.",
    captions: [
      [
        0,
        "Close runs the same interpolation in reverse",
        "`goBack` springs `progress` back to `0`, and the full-res photo shrinks into the cell on the detail screen.",
      ],
      [
        3.9,
        "Then the thumbnail shows up and the detail screen closes",
        "`visibility` goes back to `{ source: 1, target: 0 }`, and `navigation.goBack()` removes the screen.",
      ],
    ],
    at: (u) => {
      const end = 3.9;
      const p = 1 - spring(clamp((u - 1.1) / (end - 1.1)));
      const done = u >= end;
      return core({
        tap: "close",
        tapK: (u - 0.5) / 0.7,
        thumbShown: done,
        outline: done ? 0 : 1,
        push: 1 - ss(u, end, end + 0.35),
        backdrop: p,
        detailP: p,
        detailShown: true,
        closeK: 1,
        chips: {
          hidden: done ? 0 : 1 - ss(u, 1.1, 1.5),
          full: ss(u, 1.1, 1.5) * (1 - ss(u, end - 0.4, end)),
        },
        readout: {
          progress: p,
          source: done ? 1 : 0,
          target: done ? 0 : 1,
          fullRes: LOADED,
        },
      });
    },
  },
};

// chapters that tell more when played on their own than as a part of the pipeline
const ALONE: Partial<Record<ChapterId, Chapter>> = {
  // step 4: the detail screen opens as is, under the teleported thumbnail; same photo as the step's screenshot
  teleport: {
    duration: 9.6,
    still: 5.6,
    title:
      "3D view of the teleport step: tapping a thumbnail moves it into the root PortalHost, above every screen, so it stays on top of the detail screen.",
    captions: [
      ...CHAPTERS.teleport.captions,
      [
        3.4,
        "The detail screen opens below the thumbnail",
        "The root host sits above every screen, so the thumbnail stays on top of the detail screen.",
      ],
      [
        6.9,
        "What users see: the thumbnail on top of the detail screen",
        "It keeps its grid position until the next step animates it.",
      ],
    ],
    readouts: ["host", "fullRes"],
    cell: 7,
    at: (u) => {
      const inHost = u >= 0.9;
      const loaded = u >= 4.4;
      const loading = loaded ? 0 : ss(u, 3.6, 3.9);
      return core({
        tap: "thumb",
        tapK: (u - 0.9) / 0.7,
        plain: true,
        flat: ss(u, 6.9, 8.1),
        outline: ss(u, 2.8, 3.2),
        drop: ss(u, 2.8, 3.2),
        lift: ss(u, 1.4, 2.8),
        inHost,
        push: ss(u, 3.4, 3.9),
        backdrop: 1,
        detailP: 1,
        detailShown: loaded,
        ghost: loading,
        closeK: 1,
        // the thumbnail is drawn over the photo in this view, so only it gets a chip
        chips: { low: ss(u, 2.5, 3) },
        readout: {
          host: inHost ? HOST : "undefined",
          fullRes: u < 3.4 ? "not requested" : loaded ? "loaded" : "loading",
        },
      });
    },
  },
};

const PIPELINE_TITLE =
  "3D breakdown of the Photo Gallery hero transition: the thumbnail teleports into a root PortalHost, flies to full screen together with an invisible full-res photo, the two swap in one commit as soon as the photo loads, the thumbnail returns to its cell, and Close plays the transition in reverse.";
const INTRO: [string, string] = [
  "The gallery: a `FlatList` of low-res thumbnails",
  'A `PortalHost` named `"root"` waits above the navigator.',
];
const OUTRO: [string, string] = [
  "What users see: one continuous image, sharp as soon as it’s ready",
  "No flicker, no blank frames, no second decode of the full-res photo.",
];

type Plan = {
  full: boolean;
  chapters: Array<{ id: ChapterId; start: number; chapter: Chapter }>;
  end: number;
  total: number;
  loopTo: number;
  still: number;
  title: string;
  captions: Array<[number, string, string]>;
  readouts: Array<keyof Readout>;
  hero: Hero;
};

// a single chapter explodes the phone and loops; several chapters play as one story, from the flat phone and back
const makePlan = (ids: ChapterId[]): Plan => {
  const full = ids.length > 1;
  let t = full ? 3.3 : 2;
  const chapters = ids.map((id) => {
    const chapter = (!full && ALONE[id]) || CHAPTERS[id];
    const c = { id, start: t, chapter };
    t += chapter.duration;
    return c;
  });
  const first = chapters[0] ?? {
    id: "teleport" as ChapterId,
    start: 0,
    chapter: CHAPTERS.teleport,
  };
  const captions: Array<[number, string, string]> = [];
  if (full) captions.push([0, ...INTRO]);
  chapters.forEach((c, i) =>
    c.chapter.captions.forEach(([s, a, b]) =>
      captions.push([!full && i === 0 && s === 0 ? 0 : c.start + s, a, b]),
    ),
  );
  if (full) captions.push([t + 0.4, ...OUTRO]);
  const handoff = chapters.find((c) => c.id === "handoff");
  return {
    full,
    chapters,
    end: t,
    total: full ? t + 4 : t + 1.4,
    loopTo: full ? 0 : first.start,
    still: handoff
      ? handoff.start + CHAPTERS.handoff.still
      : first.start + first.chapter.still,
    title: full ? PIPELINE_TITLE : first.chapter.title,
    captions,
    readouts: (!full && first.chapter.readouts) || READOUTS,
    hero: heroAt((!full && first.chapter.cell) || 0),
  };
};

const sceneAt = (plan: Plan, t: number): Scene => {
  let ch = plan.chapters[0] ?? {
    id: "teleport" as ChapterId,
    start: 0,
    chapter: CHAPTERS.teleport,
  };
  for (const c of plan.chapters) if (t >= c.start) ch = c;
  const { chapter } = ch;
  const c = chapter.at(clamp(t - ch.start, 0, chapter.duration));
  const { full, end } = plan;
  const ex =
    (full
      ? ss(t, 0.6, 2.9) * (1 - ss(t, end + 0.4, end + 2.4))
      : ss(t, 0.3, 1.8)) *
    (1 - c.flat);
  // labels and chips fade out before the layers collapse
  const hud = (full ? 1 - ss(t, end, end + 0.4) : 1) * (1 - ss(c.flat, 0, 0.3));
  const [in0, in2] = full ? [2.2, 2.7] : [1.2, 1.5];
  let caption = 0;
  plan.captions.forEach(([start], i) => {
    if (t >= start) caption = i;
  });
  return {
    ...c,
    ex,
    drift: ss(t, full ? 2.9 : 1.8, end),
    fade: full ? 1 : 1 - ss(t, end + 1, end + 1.35),
    hud,
    labels: [
      ss(t, in0, in0 + 0.35) * hud,
      ss(c.push, 0.3, 1) * hud,
      ss(t, in2, in2 + 0.35) * hud,
    ],
    caption,
  };
};

// ---------- hover tooltips ----------

type Tone = "gallery" | "detail" | "host" | "hot";
type TipKey =
  | "gallery"
  | "cell"
  | "header"
  | "slot"
  | "detail"
  | "full"
  | "close"
  | "host"
  | "thumb";
type Tip = { tone: Tone; title: string; body: string; code: string };
const KEYS: TipKey[] = [
  "gallery",
  "cell",
  "header",
  "slot",
  "detail",
  "full",
  "close",
  "host",
  "thumb",
];
const PLANES: TipKey[] = ["gallery", "detail", "host"];

// what each part of the scene does, in the current state
const tipFor = (key: TipKey, sc: Core): Tip => {
  switch (key) {
    case "gallery":
      return {
        tone: "gallery",
        title: "Gallery screen",
        body: "A FlatList of low-res thumbnails, about 150 px each. Small images keep long lists fast and light on memory.",
        code: "<FlatList numColumns={3} />",
      };
    case "cell":
      return {
        tone: "gallery",
        title: "Thumbnail",
        body: "Every cell wraps its image in a <Portal> without a host name, so it renders in place. Only the tapped one teleports.",
        code: "<Portal hostName={undefined}>",
      };
    case "header":
      return {
        tone: "gallery",
        title: "Your own header",
        body: "A regular React Navigation header. Teleported content still draws above it, because the root PortalHost sits above the navigator.",
        code: 'options={{ title: "Photos" }}',
      };
    case "slot":
      return {
        tone: "gallery",
        title: "Empty cell",
        body: "The thumbnail was moved, not copied. Its wrapper View keeps the cell’s size, so the list doesn’t reflow.",
        code: "<View style={{ width, height }}>",
      };
    case "detail":
      if (sc.plain)
        return {
          tone: "detail",
          title: "Detail screen",
          body: "A transparent modal with a black backdrop. It covers the gallery, but not the root host above it, so the teleported thumbnail stays in sight.",
          code: 'presentation: "containedTransparentModal"',
        };
      return {
        tone: "detail",
        title: "Detail screen",
        body: "A transparent modal pushed without a native animation, so the gallery stays visible underneath. Its backdrop fades in with progress.",
        code: 'presentation: "containedTransparentModal"',
      };
    case "full":
      if (sc.plain)
        return sc.detailShown
          ? {
              tone: "hot",
              title: "Full-res photo",
              body: "A plain <Image> on the detail screen. Anything in the root host, like the thumbnail, draws on top of this screen.",
              code: "source={{ uri: photo.fullSize }}",
            }
          : {
              tone: "detail",
              title: "Full-res photo, loading",
              body: "A plain <Image> on the detail screen. Until it’s downloaded and decoded, the screen stays black, as in step 2.",
              code: "source={{ uri: photo.fullSize }}",
            };
      if (sc.detailShown)
        return {
          tone: "hot",
          title: "Full-res photo",
          body: "Rendered once, only on the detail screen. It follows the same interpolation as the thumbnail, so it can take over at any point of the animation.",
          code: "onLoad={onLoad}",
        };
      return sc.ghostText === IDLE.ghostText
        ? {
            tone: "detail",
            title: "Full-res photo, loading",
            body: "Mounted at opacity 0 on the same path as the thumbnail. Nothing is shown until onLoad fires.",
            code: "opacity: visibility.target",
          }
        : {
            tone: "detail",
            title: "Full-res photo, hidden",
            body: "Mounted at its final size at opacity 0. Without a handoff, nothing ever shows it.",
            code: "opacity: visibility.target",
          };
    case "close":
      if (sc.plain)
        return {
          tone: "detail",
          title: "Close button",
          body: "Goes through the store: goBack clears id, so the thumbnail’s <Portal> renders in its cell again.",
          code: "goBack(navigation.goBack)",
        };
      return {
        tone: "detail",
        title: "Close button",
        body: "Fades in once the opening animation has finished. Closing runs the same interpolation in reverse, back into the cell.",
        code: "goBack(navigation.goBack)",
      };
    case "host":
      return {
        tone: "host",
        title: "PortalHost “root”",
        body: "Rendered by <PortalProvider> above the navigator. Anything teleported here draws above every screen, header and tab bar.",
        code: "<PortalProvider>",
      };
    case "thumb":
      if (!sc.inHost && sc.thumbShown)
        return {
          tone: "gallery",
          title: "Thumbnail",
          body: "A low-res image in its cell. On tap, its <Portal> switches to the root host.",
          code: 'hostName={isAnimating ? "root" : undefined}',
        };
      if (sc.thumbShown)
        return {
          tone: "host",
          title: "Teleported thumbnail",
          body: sc.plain
            ? "The same native view, now a child of the root PortalHost: nothing is re-mounted or re-decoded. It keeps its grid position, above every screen."
            : "The same native view, now a child of the root PortalHost: nothing is re-mounted or re-decoded. progress drives its translate, scale and height.",
          code: '<Portal hostName="root">',
        };
      if (sc.inHost)
        return {
          tone: "host",
          title: "Thumbnail, hidden",
          body: "visibility.source is 0. It keeps following progress until the spring finishes, then teleports back to its cell.",
          code: "opacity: visibility.source",
        };
      return {
        tone: "gallery",
        title: "Thumbnail, back in its cell",
        body: "Hidden while the photo is open, so the cell doesn’t flash behind the viewer. It shows again when the viewer closes.",
        code: "s.ownerId === photo.id",
      };
  }
};

// ---------- drawing ----------

type Pt = [number, number];
type Quad = [Pt, Pt, Pt, Pt];
// projective map of the unit square onto a quad (top-left, top-right, bottom-right, bottom-left)
const quadMap = ([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Quad) => {
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1 || 1e-6;
  const g = (dx3 * dy2 - dx2 * dy3) / den;
  const h = (dx1 * dy3 - dx3 * dy1) / den;
  return (u: number, v: number): Pt => {
    const w = g * u + h * v + 1;
    return [
      ((x1 - x0 + g * x1) * u + (x3 - x0 + h * x3) * v + x0) / w,
      ((y1 - y0 + g * y1) * u + (y3 - y0 + h * y3) * v + y0) / w,
    ];
  };
};
const subQuad = (q: Quad, r: Rect): Quad => {
  const m = quadMap(q);
  const [u0, v0, u1, v1] = [
    r.x / 390,
    r.y / 844,
    (r.x + r.w) / 390,
    (r.y + r.h) / 844,
  ];
  return [m(u0, v0), m(u1, v0), m(u1, v1), m(u0, v1)];
};

type Rgb = [number, number, number];
type Palette = Record<Tone, Rgb> & { glow: number };
const readPalette = (el: Element): Palette => {
  const cs = getComputedStyle(el);
  const rgb = (name: string): Rgb => {
    const [r = 255, g = 255, b = 255] = cs
      .getPropertyValue(name)
      .split(",")
      .map((c) => Number(c.trim()));
    return [r, g, b];
  };
  return {
    gallery: rgb("--viz-gallery-rgb"),
    detail: rgb("--viz-detail-rgb"),
    host: rgb("--viz-host-rgb"),
    hot: rgb("--viz-hot-rgb"),
    glow: Number(cs.getPropertyValue("--viz-glow")) || 1,
  };
};
const rgba = ([r, g, b]: Rgb, a: number) =>
  `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(3)})`;
const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [
  mix(a[0], b[0], k),
  mix(a[1], b[1], k),
  mix(a[2], b[2], k),
];

// hover state the scene reacts to; amounts are eased by the caller
type Fx = {
  hk: Record<TipKey, number>;
  focus: TipKey | null;
  focusK: number;
  cell: number;
  tiltX: number;
  tiltY: number;
  now: number;
  fadeIn: number;
  motion: boolean;
};
type Frame = { vis: Record<TipKey, number>; solidDetail: boolean };

function createScene(
  root: HTMLElement,
  palette: { current: Palette },
  hero: Hero,
) {
  const cache = new Map<string, Element>();
  const q = <E extends Element = HTMLElement>(k: string) => {
    let el = cache.get(k);
    if (!el) {
      el = root.querySelector(`[data-k="${k}"]`) ?? undefined;
      if (el) cache.set(k, el);
    }
    return el as unknown as E;
  };
  const canvas = q("canvas");
  const attrs = (el: Element, a: Record<string, string | number>) => {
    for (const key in a) el.setAttribute(key, String(a[key]));
  };
  const box = (el: Element, r: Rect) =>
    attrs(el, { x: r.x, y: r.y, width: r.w, height: r.h });
  const rect = (p: number) => heroRect(hero, p);
  // the photo covers its frame, like resizeMode="cover"
  const photoBox = (r: Rect): Rect => {
    const h = Math.max(r.h, r.w * hero.aspect);
    const w = h / hero.aspect;
    return { x: r.x - (w - r.w) / 2, y: r.y - (h - r.h) / 2, w, h };
  };
  const corners4 = (prefix: string, r: Rect) =>
    (
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as const
    ).forEach(([a, b], i) => {
      q(`${prefix}${i}`).style.left = px(r.x + a * r.w);
      q(`${prefix}${i}`).style.top = px(r.y + b * r.h);
    });
  const opacity = (key: string, v: number) => {
    (q(key) as unknown as SVGElement | HTMLElement).style.opacity = String(v);
  };

  return (sc: Scene, fx: Fx): Frame => {
    const pal = palette.current;
    const cr = canvas.getBoundingClientRect();
    const k = cr.width / 1920 || 1;
    const center = (el: Element): Pt => {
      const r = el.getBoundingClientRect();
      return [
        (r.left + r.width / 2 - cr.left) / k,
        (r.top + r.height / 2 - cr.top) / k,
      ];
    };
    const corners = (prefix: string): Quad => [
      center(q(`${prefix}0`)),
      center(q(`${prefix}1`)),
      center(q(`${prefix}2`)),
      center(q(`${prefix}3`)),
    ];

    // hover: the hovered part glows and everything else steps back; nothing moves, so the scene stays put under the pointer
    const hv = (key: TipKey) => fx.hk[key];
    const focusAll = Math.max(...KEYS.map(hv));
    const own0 = Math.max(hv("gallery"), hv("cell"), hv("header"), hv("slot"));
    const own1 = Math.max(hv("detail"), hv("full"), hv("close"));
    const own2 = hv("host");
    const ownFly = Math.max(hv("thumb"), sc.inHost ? own2 : own0);
    const dim = (own: number) => 1 - 0.5 * clamp(focusAll - own);
    const breathe = fx.motion ? 0.85 + 0.15 * Math.sin(fx.now * 0.005) : 1;

    // camera
    const { ex } = sc;
    const sCam = mix(0.9, 0.96, ex);
    const cx = mix(960, 860, ex);
    const cy = mix(520, 575, ex);
    q("stage").style.transform =
      `translate3d(${px(cx - 195)}, ${px(cy - 422)}, 0) scale(${sCam}) rotateX(${(54 + 3 * fx.tiltY) * ex}deg) rotateZ(${(-36 + 5 * sc.drift + 3 * fx.tiltX) * ex}deg)`;
    q("viewport").style.opacity = String(sc.fade * fx.fadeIn);

    // layers; the detail screen exists only while it's pushed
    const [z0, z1, z2] = ZL.map((zz, i) => mix(i * 0.6, zz, ex)) as [
      number,
      number,
      number,
    ];
    q("bezel").style.opacity = String((1 - 0.75 * ex) * dim(own0));
    q("L0").style.transform = `translateZ(${px(z0)})`;
    q("L1").style.transform = `translateZ(${px(z1)})`;
    q("L2").style.transform = `translateZ(${px(z2)})`;
    q("L0").style.opacity = String(dim(own0));
    q("L1").style.opacity = String(sc.push * dim(own1));
    q("L2").style.opacity = String(ex * dim(own2));
    const glass = (key: string, c: Rgb, a: number, own: number) => {
      const g = q(key);
      const on = Math.max(ex, 0.9 * own);
      const lit = own * breathe;
      g.style.borderColor = rgba(c, (0.85 + 0.15 * lit) * on);
      g.style.background = rgba(c, (a + 0.06 * lit) * on);
      g.style.boxShadow = `0 0 ${px(40 + 60 * lit)} ${rgba(c, (0.35 + 0.45 * lit) * on * pal.glow)}, inset 0 0 ${px(30 + 40 * lit)} ${rgba(c, (0.12 + 0.2 * lit) * on * pal.glow)}`;
    };
    glass("g0", pal.gallery, 0, own0);
    glass("g1", pal.detail, 0.07, own1);
    glass("g2", pal.host, 0.06, own2);

    // detail screen: full-res photo + its invisible outline, as SVG geometry (sub-pixel, no layout snapping)
    q("backdrop").style.opacity = String(sc.backdrop);
    const dr = rect(sc.detailP);
    box(q("detailClipRect"), dr);
    box(q("ghostRect"), dr);
    box(q("detailImage"), photoBox(dr));
    opacity("detailImage", sc.detailShown ? 1 : 0);
    opacity("ghostRect", sc.ghost * (ex > 0.5 ? 1 : 0));
    corners4("d", dr);
    opacity("closeBtn", sc.closeK);

    // the thumbnail: moves along z between its cell and the root host, geometry drawn in SVG
    const fz = mix(z0, z2, sc.lift) + 2;
    const fr = rect(sc.thumbP);
    q("flyer").style.transform = `translate3d(0, 0, ${px(fz)})`;
    q("flyer").style.opacity = String(dim(ownFly));
    box(q("thumbClipRect"), fr);
    box(q("thumbOutline"), fr);
    box(q("thumbImage"), photoBox(fr));
    corners4("f", fr);
    opacity("thumbImage", sc.thumbShown ? 1 : 0);
    // a hidden thumbnail is drawn as its outline; a visible one is outlined only to point it out on the flat phone
    const outlineK = sc.thumbShown ? sc.outline : ex * sc.outline;
    opacity("thumbOutline", outlineK);
    q("slot").style.borderColor = rgba(pal.host, 0.9 * ex * sc.lift);

    // handoff: the visible image travels from the root host down to the detail screen and sharpens on the way
    const handK = sc.handT === null ? 0 : ss(sc.handT, 0, H.LAND);
    const inHandoff = sc.handT !== null && sc.handT < H.LAND;
    q("handoff").style.transform =
      `translate3d(0, 0, ${px(mix(z2, z1, handK) + 3)})`;
    q("handoff").style.opacity = String(
      (inHandoff ? 1 : 0) * dim(Math.max(hv("full"), own1)),
    );
    box(q("handoffClipRect"), dr);
    box(q("handoffHit"), dr);
    box(q("handoffThumb"), photoBox(dr));
    box(q("handoffFull"), photoBox(dr));
    opacity(
      "handoffThumb",
      sc.handT === null ? 1 : 1 - ss(sc.handT, 0.1, 0.85),
    );
    corners4("x", dr);
    for (let i = 0; i < 3; i++) {
      const lag = 0.11 * (i + 1);
      const kk = sc.handT === null ? 0 : ss(sc.handT, lag, H.LAND + lag);
      const on = sc.handT !== null && sc.handT < H.LAND + lag;
      const plane = q(`trail${i}`);
      plane.style.transform = `translate3d(0, 0, ${px(mix(z2, z1, kk) + 2)})`;
      plane.style.opacity = String(
        on ? (0.75 - 0.18 * i) * ex * Math.sin(Math.PI * kk) : 0,
      );
      const c = mixRgb(pal.host, pal.detail, kk);
      for (const part of ["Glow", "Line"]) {
        const el = q(`trail${part}${i}`);
        box(el, dr);
        el.setAttribute("stroke", rgba(c, part === "Glow" ? 0.35 : 1));
      }
    }

    // ---------- HUD (internal 1920×1080 coordinates) ----------
    const labOwn = [own0, own1, own2];
    const labColors = [pal.gallery, pal.detail, pal.host];
    const labDy = [46, 0, -46] as const;
    sc.labels.forEach((kk, i) => {
      const [ax, ay] = center(q(`a${i}`));
      const lx = 1390;
      const ly = ay + (labDy[i] ?? 0);
      const own = labOwn[i] ?? 0;
      const op = kk * ex * dim(own);
      const lab = q(`lab${i}`);
      lab.style.transform = `translate(${px(lx + 18)}, ${px(ly - 30)}) scale(${1 + 0.06 * own})`;
      lab.style.opacity = String(op);
      attrs(q(`labDot${i}`), {
        cx: ax,
        cy: ay,
        r: 7 + 4 * own * breathe,
        fill: rgba(labColors[i] ?? pal.host, 1),
        opacity: op,
      });
      attrs(q(`labLine${i}`), {
        d: `M${ax},${ay} L${lx - 30},${ly} L${lx + 6},${ly}`,
        opacity: op,
      });
    });

    const beam = inHandoff ? Math.sin(Math.PI * handK) : 0;
    const slotQuad =
      sc.drop > 0 ? subQuad(corners("c0"), cellRect(hero.cell)) : null;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = center(q(`f${i}`));
      const [x2, y2] = slotQuad?.[i] ?? center(q(`d${i}`));
      attrs(q(`align${i}`), {
        x1,
        y1,
        x2,
        y2,
        "opacity": Math.max(sc.guides, sc.drop) * ex,
        "stroke-width": 2 + 2.5 * beam,
      });
    }

    const fQuad = corners("f");
    const dQuad = corners("d");
    const tapAt: Pt =
      sc.tap === "close"
        ? center(q("closeAnchor"))
        : [(fQuad[0][0] + fQuad[2][0]) / 2, (fQuad[0][1] + fQuad[2][1]) / 2];
    const rippleOn = sc.tap !== null && sc.tapK > 0 && sc.tapK < 1;
    attrs(q("ripple"), {
      cx: tapAt[0],
      cy: tapAt[1],
      r: 18 + 90 * clamp(sc.tapK),
      opacity: rippleOn ? 1 - sc.tapK : 0,
    });
    attrs(q("touch"), {
      cx: tapAt[0],
      cy: tapAt[1],
      r: 20,
      opacity: rippleOn ? 1 - sc.tapK : 0,
    });

    const flashOn = sc.flashK !== null && sc.flashK >= 0 && sc.flashK < 1;
    attrs(q("flash"), {
      "points": dQuad.map((pt) => pt.join(",")).join(" "),
      "stroke": rgba(pal.hot, 1),
      "stroke-width": 8 * (1 - clamp(sc.flashK ?? 1)) + 3,
      "opacity": flashOn ? 1 - (sc.flashK ?? 1) : 0,
    });

    const [f0x, f0y] = fQuad[0];
    const [d1x, d1y] = dQuad[1];
    const chipK = ex * sc.hud;
    const place = (key: string, x: number, y: number, op: number) => {
      const c = q(key);
      c.style.transform = `translate(${px(x)}, ${px(y)})`;
      c.style.opacity = String(op * chipK);
    };
    place("chipLow", f0x - 10, f0y - 62, sc.chips.low);
    place("chipHidden", f0x - 10, f0y - 62, sc.chips.hidden);
    place("chipGhost", d1x + 16, d1y - 8, sc.chips.ghost);
    place("chipFull", d1x + 16, d1y - 8, sc.chips.full);
    if (q("chipGhost").textContent !== sc.ghostText)
      q("chipGhost").textContent = sc.ghostText;

    // what can be hovered right now
    const vis: Record<TipKey, number> = {
      gallery: 1,
      cell: 1,
      header: 1,
      slot: sc.lift > 0.3 ? 1 : 0,
      detail: sc.push,
      full: sc.push > 0.5 ? 1 : 0,
      close: sc.closeK * sc.push,
      host: ex,
      thumb: sc.thumbShown ? 1 : outlineK,
    };

    // glowing outline around the hovered part
    const quadFor = (key: TipKey): Quad | null => {
      switch (key) {
        case "thumb":
          return fQuad;
        case "full":
          return inHandoff ? corners("x") : dQuad;
        case "gallery":
        case "detail":
        case "host":
          return null;
        case "cell":
          return fx.cell >= 0
            ? subQuad(corners("c0"), cellRect(fx.cell))
            : null;
        case "slot":
          return subQuad(corners("c0"), cellRect(hero.cell));
        case "header":
          return subQuad(corners("c0"), { x: 0, y: 0, w: 390, h: TOP });
        case "close": {
          const btn = q("closeBtn");
          return subQuad(corners("c1"), {
            x: btn.offsetLeft,
            y: btn.offsetTop,
            w: btn.offsetWidth,
            h: btn.offsetHeight,
          });
        }
      }
    };
    const focusQuad = fx.focus ? quadFor(fx.focus) : null;
    if (focusQuad && fx.focus) {
      const pts = focusQuad.map((pt) => pt.join(",")).join(" ");
      const c = pal[tipFor(fx.focus, sc).tone];
      for (const part of ["auraGlow", "auraLine"]) {
        attrs(q(part), {
          "points": pts,
          "stroke": rgba(c, part === "auraGlow" ? 0.35 : 0.95),
          "stroke-dashoffset": fx.motion ? -fx.now * 0.03 : 0,
        });
      }
    }
    q("aura").setAttribute(
      "opacity",
      String((focusQuad ? fx.focusK : 0) * breathe),
    );

    return { vis, solidDetail: sc.push * sc.backdrop > 0.5 };
  };
}

// captions mark code with backticks, like Markdown
const rich = (text: string) =>
  text
    .split("`")
    .map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));

// Server-rendered placeholder (also what search engines and llms.txt see): same box, plus a text transcript
function Transcript({ plan }: { plan: Plan }) {
  return (
    <figure className={styles.root}>
      <div className={styles.stageWrap} role="img" aria-label={plan.title} />
      <figcaption className={styles.srOnly}>
        <p>Animation transcript:</p>
        <ol>
          {plan.captions.map(([start, heading, text]) => (
            <li key={start}>{rich(`${heading}. ${text}`)}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

type Props = {
  /** chapters to play, in order; defaults to the whole pipeline */
  chapters?: ChapterId[];
  /** the animation, its caption and the timeline, without the store values: for an overview */
  compact?: boolean;
};

export default function PhotoTransitionExplainer({
  chapters = PIPELINE,
  compact = false,
}: Props) {
  const key = chapters.join(",");
  const plan = useMemo(() => makePlan(key.split(",") as ChapterId[]), [key]);
  return (
    <BrowserOnly fallback={<Transcript plan={plan} />}>
      {() => <Explainer plan={plan} compact={compact} />}
    </BrowserOnly>
  );
}

const TONE_CLASS: Record<Tone, string | undefined> = {
  gallery: styles.toneGallery,
  detail: styles.toneDetail,
  host: styles.toneHost,
  hot: styles.toneHot,
};

const noHover = () =>
  Object.fromEntries(KEYS.map((key) => [key, 0])) as Record<TipKey, number>;

function Explainer({ plan, compact }: { plan: Plan; compact: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const renderRef = useRef<((sc: Scene, fx: Fx) => Frame) | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const hostRef = useRef<HTMLSpanElement>(null);
  const loadRef = useRef<HTMLSpanElement>(null);
  const [caption, setCaption] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipOn, setTipOn] = useState(false);
  const userPaused = useRef(false);
  const playingRef = useRef(false);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const loopedAt = useRef<number | null>(null);
  const pointer = useRef({
    inside: false,
    pinned: false,
    tapped: false,
    type: "mouse",
    x: 0,
    y: 0,
  });
  const fxRef = useRef<Fx & { key: TipKey | null; tipId: string }>({
    hk: noHover(),
    focus: null,
    focusK: 0,
    cell: -1,
    tiltX: 0,
    tiltY: 0,
    now: 0,
    fadeIn: 1,
    motion: true,
    key: null,
    tipId: "",
  });
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = useBaseUrl("/img/photo-gallery-transition/");

  const draw = (t: number) => {
    const sc = sceneAt(plan, t);
    const frame = renderRef.current?.(sc, fxRef.current);
    if (!frame) return;
    sceneRef.current = sc;
    frameRef.current = frame;
    const { readout } = sc;
    if (scrubRef.current) scrubRef.current.value = String(t);
    if (progressRef.current)
      progressRef.current.textContent = readout.progress.toFixed(2);
    if (barRef.current)
      barRef.current.style.width = `${(readout.progress * 100).toFixed(1)}%`;
    if (sourceRef.current)
      sourceRef.current.textContent = String(readout.source);
    if (targetRef.current)
      targetRef.current.textContent = String(readout.target);
    if (hostRef.current) hostRef.current.textContent = readout.host;
    if (loadRef.current) loadRef.current.textContent = readout.fullRes;
    setCaption(sc.caption);
  };

  // topmost visible part under the pointer: objects win over layers, and an opaque layer hides what's below it
  const pick = (x: number, y: number): [TipKey | null, number] => {
    const frame = frameRef.current;
    if (!frame) return [null, -1];
    let glassKey: TipKey | null = null;
    for (const el of document.elementsFromPoint(x, y)) {
      const target = el.closest<HTMLElement | SVGElement>("[data-tip]");
      if (!target || !rootRef.current?.contains(target)) continue;
      const key = target.dataset.tip as TipKey;
      const cell = Number(target.dataset.cell ?? -1);
      if (target.dataset.direct !== undefined) {
        if (Number(target.style.opacity || 1) > 0.3) return [key, cell];
        continue;
      }
      if (frame.vis[key] < 0.15) continue;
      if (!PLANES.includes(key)) return [key, cell];
      if (key === "gallery" || (key === "detail" && frame.solidDetail))
        return [key, cell];
      glassKey ??= key;
    }
    return [glassKey, -1];
  };

  const step = (now: number) => {
    rafRef.current = 0;
    const dt = Math.min(0.05, (now - lastRef.current) / 1000);
    lastRef.current = now;
    const fx = fxRef.current;
    if (playingRef.current) {
      let t = timeRef.current + dt;
      if (t > plan.total) {
        t = plan.loopTo;
        loopedAt.current = plan.full ? null : now;
      }
      timeRef.current = t;
    }
    fx.fadeIn =
      loopedAt.current === null ? 1 : ss(now - loopedAt.current, 0, 350);
    if (fx.fadeIn === 1) loopedAt.current = null;
    const t = Math.min(timeRef.current, plan.total);
    const ptr = pointer.current;
    const root = rootRef.current;
    const stage = stageRef.current;
    fx.now = now;

    if ((ptr.inside || ptr.tapped) && root) {
      const [key, cell] = pick(ptr.x, ptr.y);
      ptr.tapped = false;
      fx.key = key;
      if (key === "cell") fx.cell = cell;
    } else if (!ptr.pinned) fx.key = null;
    const ease = 1 - Math.exp(-dt * 11);
    let busy = loopedAt.current !== null;
    for (const key of KEYS) {
      const aim = fx.key === key ? 1 : 0;
      fx.hk[key] += (aim - fx.hk[key]) * ease;
      if (Math.abs(aim - fx.hk[key]) < 0.002) fx.hk[key] = aim;
      else busy = true;
    }
    if (fx.key) fx.focus = fx.key;
    fx.focusK = fx.focus ? fx.hk[fx.focus] : 0;
    if (!fx.key && fx.focusK === 0) fx.focus = null;
    const r = stage?.getBoundingClientRect();
    const tilt = ptr.inside && ptr.type === "mouse" && fx.motion && r;
    const aimX = tilt ? clamp(((ptr.x - r.left) / r.width) * 2 - 1, -1, 1) : 0;
    const aimY = tilt ? clamp(((ptr.y - r.top) / r.height) * 2 - 1, -1, 1) : 0;
    fx.tiltX += (aimX - fx.tiltX) * (1 - Math.exp(-dt * 4));
    fx.tiltY += (aimY - fx.tiltY) * (1 - Math.exp(-dt * 4));
    if (Math.abs(aimX - fx.tiltX) + Math.abs(aimY - fx.tiltY) > 0.002)
      busy = true;
    draw(t);

    // tooltip next to the pointer, kept inside the figure
    const sc = sceneRef.current;
    const next = fx.key && sc ? tipFor(fx.key, sc) : null;
    const id = next ? `${fx.key}:${next.title}` : "";
    if (id !== fx.tipId) {
      fx.tipId = id;
      if (next) setTip(next);
      setTipOn(!!next);
    }
    const el = tipRef.current;
    if (next && el && root) {
      const rr = root.getBoundingClientRect();
      const w = el.offsetWidth;
      let x = ptr.x - rr.left + 16;
      if (x + w > rr.width) x = ptr.x - rr.left - w - 16;
      el.style.left = px(clamp(x, 0, Math.max(0, rr.width - w)));
      el.style.top = px(ptr.y - rr.top + 18);
    }

    if (playingRef.current || ptr.inside || ptr.pinned || busy)
      rafRef.current = requestAnimationFrame(step);
  };
  const kick = () => {
    if (rafRef.current) return;
    lastRef.current = performance.now();
    rafRef.current = requestAnimationFrame(step);
  };
  // effects reach the loop through refs, so they don't depend on this render's closures
  const kickRef = useRef(kick);
  const drawRef = useRef(draw);
  useEffect(() => {
    kickRef.current = kick;
    drawRef.current = draw;
  });

  // set up the scene, scale it to the container, and pick the initial frame
  useEffect(() => {
    const root = rootRef.current;
    const stageWrap = stageRef.current;
    if (!root || !stageWrap) return;
    const palette = { current: readPalette(root) };
    renderRef.current = createScene(root, palette, plan.hero);
    const canvas = root.querySelector<HTMLElement>(`.${styles.canvas}`)!;
    const fit = () => {
      canvas.style.transform = `scale(${stageWrap.clientWidth / 1920})`;
      drawRef.current(timeRef.current);
    };
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    fxRef.current.motion = !reduced;
    if (reduced) {
      timeRef.current = plan.still;
      userPaused.current = true;
    }
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stageWrap);
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { threshold: 0.4 },
    );
    io.observe(stageWrap);
    // colors follow the docs theme
    const mo = new MutationObserver(() => {
      palette.current = readPalette(root);
      drawRef.current(timeRef.current);
    });
    mo.observe(document.documentElement, { attributeFilter: ["data-theme"] });
    // a tap outside the figure closes a tooltip opened by touch
    const outside = (e: Event) => {
      if (!root.contains(e.target as Node)) {
        pointer.current.pinned = false;
        kickRef.current();
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("pointerdown", outside);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [plan]);

  // autoplay while visible, unless the reader paused it
  useEffect(() => {
    setPlaying(visible && !userPaused.current);
  }, [visible]);

  useEffect(() => {
    playingRef.current = playing;
    if (playing) kickRef.current();
  }, [playing]);

  const toggle = () => {
    userPaused.current = playing;
    if (!playing && timeRef.current >= plan.total) timeRef.current = 0;
    setPlaying(!playing);
  };
  const scrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    userPaused.current = true;
    setPlaying(false);
    loopedAt.current = null;
    fxRef.current.fadeIn = 1;
    timeRef.current = Number(e.target.value);
    draw(timeRef.current);
    kick();
  };

  // mouse: hover; touch and pen: tap to show the tooltip, tap elsewhere to hide it
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    Object.assign(pointer.current, {
      inside: true,
      type: "mouse",
      x: e.clientX,
      y: e.clientY,
    });
    kick();
  };
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointer.current.inside = false;
    kick();
  };
  const onPointerDown = (e: React.PointerEvent) => {
    pointer.current.type = e.pointerType;
  };
  const onClick = (e: React.MouseEvent) => {
    if (pointer.current.type === "mouse") return;
    Object.assign(pointer.current, {
      pinned: true,
      tapped: true,
      x: e.clientX,
      y: e.clientY,
    });
    kick();
  };

  const detailClip = `${uid}-detailClip`;
  const thumbClip = `${uid}-thumbClip`;
  const handoffClip = `${uid}-handoffClip`;
  const [, capTitle = "", capText = ""] = plan.captions[caption] ?? [];
  const shows = (key: keyof Readout) => plan.readouts.includes(key);
  const { hero } = plan;
  const corner = (prefix: string) =>
    [0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className={`${styles.anchor} ${styles[`corner${i}`]}`}
        data-k={`${prefix}${i}`}
      />
    ));
  const anchors = (prefix: string) =>
    [0, 1, 2, 3].map((i) => (
      <div key={i} className={styles.anchor} data-k={`${prefix}${i}`} />
    ));

  const playButton = (
    <button
      type="button"
      className={styles.play}
      onClick={toggle}
      aria-label={playing ? "Pause animation" : "Play animation"}
    >
      {playing ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect
            x="3"
            y="2"
            width="3.5"
            height="12"
            rx="1"
            fill="currentColor"
          />
          <rect
            x="9.5"
            y="2"
            width="3.5"
            height="12"
            rx="1"
            fill="currentColor"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );

  return (
    <figure className={styles.root} ref={rootRef}>
      <div
        ref={stageRef}
        className={styles.stageWrap}
        role="img"
        aria-label={plan.title}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <div className={styles.canvas} data-k="canvas">
          <div className={styles.viewport} data-k="viewport">
            <div className={styles.stage} data-k="stage">
              <div className={styles.bezel} data-k="bezel" />

              <div
                className={`${styles.layer} ${styles.gallery}`}
                data-k="L0"
                data-tip="gallery"
              >
                {IDS.map((id, i) =>
                  i === hero.cell ? null : (
                    <div
                      key={id}
                      className={styles.cell}
                      data-tip="cell"
                      data-cell={i}
                      style={{
                        left: cellRect(i).x,
                        top: cellRect(i).y,
                        backgroundImage: `url(${base}thumb_${id}.jpg)`,
                      }}
                    />
                  ),
                )}
                <div
                  className={styles.slot}
                  data-k="slot"
                  data-tip="slot"
                  style={{
                    left: cellRect(hero.cell).x,
                    top: cellRect(hero.cell).y,
                  }}
                />
                <div className={styles.header} data-tip="header">
                  <span className={styles.time}>9:41</span>
                  <span className={styles.island} />
                  <span className={styles.title}>Photos</span>
                </div>
                <div className={styles.glass} data-k="g0" />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a0"
                />
                {corner("c0")}
              </div>

              <div className={styles.layer} data-k="L1" data-tip="detail">
                <div className={styles.backdrop} data-k="backdrop" />
                <svg
                  className={styles.svgLayer}
                  width="390"
                  height="844"
                  viewBox="0 0 390 844"
                >
                  <defs>
                    <clipPath id={detailClip}>
                      <rect data-k="detailClipRect" />
                    </clipPath>
                  </defs>
                  <image
                    data-k="detailImage"
                    href={`${base}full_${hero.id}.jpg`}
                    preserveAspectRatio="none"
                    clipPath={`url(#${detailClip})`}
                  />
                  <rect
                    data-k="ghostRect"
                    data-tip="full"
                    className={styles.hit}
                    fill="none"
                    stroke="#a77bff"
                    strokeWidth="2.5"
                    strokeDasharray="10 7"
                  />
                </svg>
                <div
                  className={styles.closeBtn}
                  data-k="closeBtn"
                  data-tip="close"
                >
                  Close
                </div>
                <div
                  className={`${styles.anchor} ${styles.closeAnchor}`}
                  data-k="closeAnchor"
                />
                <div className={styles.glass} data-k="g1" />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a1"
                />
                {anchors("d")}
                {corner("c1")}
              </div>

              <div className={styles.layer} data-k="L2" data-tip="host">
                <div
                  className={`${styles.glass} ${styles.dashed}`}
                  data-k="g2"
                />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a2"
                />
                {corner("c2")}
              </div>

              <div className={styles.flyer} data-k="flyer">
                <svg
                  className={styles.svgLayer}
                  width="390"
                  height="844"
                  viewBox="0 0 390 844"
                >
                  <defs>
                    <clipPath id={thumbClip}>
                      <rect data-k="thumbClipRect" />
                    </clipPath>
                  </defs>
                  <image
                    data-k="thumbImage"
                    href={`${base}thumb_${hero.id}.jpg`}
                    preserveAspectRatio="none"
                    clipPath={`url(#${thumbClip})`}
                  />
                  <rect
                    data-k="thumbOutline"
                    data-tip="thumb"
                    className={styles.hit}
                    fill="none"
                    stroke="#2fe0c4"
                    strokeWidth="3"
                    strokeDasharray="0.01 7"
                    strokeLinecap="round"
                  />
                </svg>
                {anchors("f")}
              </div>

              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.flyer} data-k={`trail${i}`}>
                  <svg
                    className={styles.svgLayer}
                    width="390"
                    height="844"
                    viewBox="0 0 390 844"
                  >
                    <rect
                      data-k={`trailGlow${i}`}
                      fill="none"
                      strokeWidth="12"
                    />
                    <rect
                      data-k={`trailLine${i}`}
                      fill="none"
                      strokeWidth="3"
                    />
                  </svg>
                </div>
              ))}

              <div className={styles.flyer} data-k="handoff">
                <svg
                  className={styles.svgLayer}
                  width="390"
                  height="844"
                  viewBox="0 0 390 844"
                >
                  <defs>
                    <clipPath id={handoffClip}>
                      <rect data-k="handoffClipRect" />
                    </clipPath>
                  </defs>
                  <image
                    data-k="handoffFull"
                    href={`${base}full_${hero.id}.jpg`}
                    preserveAspectRatio="none"
                    clipPath={`url(#${handoffClip})`}
                  />
                  <image
                    data-k="handoffThumb"
                    href={`${base}thumb_${hero.id}.jpg`}
                    preserveAspectRatio="none"
                    clipPath={`url(#${handoffClip})`}
                  />
                  <rect
                    data-k="handoffHit"
                    data-tip="full"
                    className={styles.hit}
                    fill="none"
                  />
                </svg>
                {anchors("x")}
              </div>
            </div>
          </div>

          <div className={styles.hud} aria-hidden="true">
            <svg className={styles.hudSvg} width="1920" height="1080">
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <path
                    data-k={`labLine${i}`}
                    className={styles.labLine}
                    strokeWidth="2"
                    fill="none"
                  />
                  <circle data-k={`labDot${i}`} />
                </g>
              ))}
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  data-k={`align${i}`}
                  className={styles.guide}
                  strokeWidth="2"
                  strokeDasharray="6 7"
                />
              ))}
              <circle
                data-k="ripple"
                fill="none"
                stroke="#fff"
                strokeWidth="4"
              />
              <circle data-k="touch" fill="rgba(255,255,255,.85)" />
              <polygon data-k="flash" fill="none" />
              <g data-k="aura" opacity="0">
                <polygon
                  data-k="auraGlow"
                  fill="none"
                  strokeWidth="14"
                  strokeLinejoin="round"
                />
                <polygon
                  data-k="auraLine"
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray="22 10"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
            <div
              className={styles.label}
              data-k="lab0"
              data-tip="gallery"
              data-direct=""
            >
              <div className={`${styles.labelName} ${styles.cGallery}`}>
                Gallery screen
              </div>
              <div className={styles.labelSub}>low-res thumbnails</div>
            </div>
            <div
              className={styles.label}
              data-k="lab1"
              data-tip="detail"
              data-direct=""
            >
              <div className={`${styles.labelName} ${styles.cDetail}`}>
                Detail screen
              </div>
              <div className={styles.labelSub}>transparent modal</div>
            </div>
            <div
              className={styles.label}
              data-k="lab2"
              data-tip="host"
              data-direct=""
            >
              <div className={`${styles.labelName} ${styles.cHost}`}>
                PortalHost “root”
              </div>
              <div className={styles.labelSub}>from &lt;PortalProvider&gt;</div>
            </div>
            <div
              className={`${styles.chip} ${styles.chipLow}`}
              data-k="chipLow"
              data-tip="thumb"
              data-direct=""
            >
              LOW-RES thumbnail
            </div>
            <div
              className={`${styles.chip} ${styles.chipHost}`}
              data-k="chipHidden"
              data-tip="thumb"
              data-direct=""
            >
              thumbnail, hidden
            </div>
            <div
              className={`${styles.chip} ${styles.chipDetail}`}
              data-k="chipGhost"
              data-tip="full"
              data-direct=""
            >
              full-res, loading
            </div>
            <div
              className={`${styles.chip} ${styles.chipHot}`}
              data-k="chipFull"
              data-tip="full"
              data-direct=""
            >
              FULL-RES photo
            </div>
          </div>
        </div>
      </div>

      <div
        ref={tipRef}
        className={`${styles.tip} ${tip ? TONE_CLASS[tip.tone] : ""} ${tipOn ? styles.tipOn : ""}`}
        aria-hidden="true"
      >
        <div className={styles.tipTitle}>{tip?.title}</div>
        <div className={styles.tipBody}>{tip?.body}</div>
        <code className={styles.tipCode}>{tip?.code}</code>
      </div>

      <figcaption className={styles.caption}>
        <div>
          <div className={styles.capTitle}>{rich(capTitle)}</div>
          <div className={styles.capText}>{rich(capText)}</div>
        </div>
      </figcaption>

      <div className={styles.controls}>
        {playButton}
        <input
          ref={scrubRef}
          className={styles.scrubber}
          type="range"
          min={0}
          max={plan.total}
          step={1 / 60}
          defaultValue={0}
          onChange={scrub}
          aria-label="Animation timeline"
        />
        {compact ? null : (
          <dl className={styles.state}>
            {shows("progress") ? (
              <div>
                <dt>progress</dt>
                <dd>
                  <span ref={progressRef}>0.00</span>
                  <span className={styles.bar}>
                    <span ref={barRef} />
                  </span>
                </dd>
              </div>
            ) : null}
            {shows("host") ? (
              <div>
                <dt>hostName</dt>
                <dd>
                  <span ref={hostRef}>undefined</span>
                </dd>
              </div>
            ) : null}
            {shows("source") ? (
              <div>
                <dt>visibility.source</dt>
                <dd>
                  <span ref={sourceRef}>1</span>
                </dd>
              </div>
            ) : null}
            {shows("target") ? (
              <div>
                <dt>visibility.target</dt>
                <dd>
                  <span ref={targetRef}>0</span>
                </dd>
              </div>
            ) : null}
            {shows("fullRes") ? (
              <div>
                <dt>full-res</dt>
                <dd>
                  <span ref={loadRef}>not requested</span>
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    </figure>
  );
}
