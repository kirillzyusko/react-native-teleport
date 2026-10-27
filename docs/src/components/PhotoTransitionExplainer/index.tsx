import { useEffect, useId, useRef, useState } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import useBaseUrl from "@docusaurus/useBaseUrl";

import styles from "./styles.module.css";

// Geometry mirrors example/src/screens/PhotoGallery (390×844 screen, 3 columns, portrait 720×1080 photo)
const SAFE = 59;
const TOP = 104;
const TH = 130;
const SC = 3;
const DIFF = (390 * 1.5) / SC - TH;
// the tapped photo is the first cell of the grid
const X0 = 0;
const Y0 = TOP;
const IDS = [15, 10, 20, 25, 29, 36, 42, 49, 54, 58, 75, 76];
const ZL = [0, 190, 380];

type Rect = { x: number; y: number; w: number; h: number };
const rect = (p: number): Rect => {
  const s = 1 + (SC - 1) * p;
  return {
    x: X0 * (1 - p),
    y: Y0 * (1 - p) + SAFE * p,
    w: TH * s,
    h: (TH + DIFF * p) * s,
  };
};
const cellRect = (i: number): Rect => ({
  x: (i % 3) * TH,
  y: TOP + Math.floor(i / 3) * TH,
  w: TH,
  h: TH,
});

const DURATION = 27.6;
const LOOP_HOLD = 2.5;
const T = {
  explode: [0.6, 2.9] as const,
  lab0: 2.2,
  lab2: 2.7,
  tap: 4.2,
  lift: [4.7, 6.1] as const,
  push: [6.9, 7.6] as const,
  F0: 10.4,
  FS: 12.96,
  // the swap is one commit; the handoff shows which layer takes over
  handoff: [12.96, 14.26] as const,
  RESUME: 15.9,
  FE: 19.5,
  SWAP_PROGRESS: 0.24,
  reset: 19.8,
  desc: [20.1, 21.3] as const,
  close: [20.7, 21.2] as const,
  collapse: [22.8, 24.8] as const,
};

const CAPTIONS: Array<[number, string, string]> = [
  [
    0,
    "The gallery: a FlatList of low-res thumbnails",
    "A PortalHost “root” waits above the navigator.",
  ],
  [
    4.2,
    "Tap teleports the thumbnail into the root PortalHost",
    '<Portal hostName="root"> re-parents the same native view, in one frame.',
  ],
  [
    6.9,
    "The detail screen mounts the full-res photo, invisible",
    "Its <Image> sits at opacity 0 on the thumbnail’s path while it loads.",
  ],
  [
    10.2,
    "Both ride the same spring, but you only see the low-res one",
    "One progress value drives translate, scale and height on both layers.",
  ],
  [
    12.96,
    "When onLoad fires mid-flight, one commit swaps them",
    "set({ visibility: { source: 0, target: 1 } }) hands the image over to the detail screen in the same native frame.",
  ],
  [
    15.9,
    "The full-res photo finishes the animation",
    "The hidden thumbnail keeps pace until it ends.",
  ],
  [
    19.5,
    "When the animation ends, the thumbnail teleports back to its cell",
    "It stays hidden while the photo is open, and Close fades in.",
  ],
  [
    24.2,
    "What users see: one continuous image, sharp as soon as it’s ready",
    "No flicker, no blank frames, no second decode of the full-res photo.",
  ],
];

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

// what each part of the scene does, at time t
const tipFor = (key: TipKey, t: number): Tip => {
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
      return {
        tone: "detail",
        title: "Detail screen",
        body: "A transparent modal pushed without a native animation, so the gallery stays visible underneath. Its backdrop fades in with progress.",
        code: 'presentation: "containedTransparentModal"',
      };
    case "full":
      return t < T.FS
        ? {
            tone: "detail",
            title: "Full-res photo, loading",
            body: "Mounted at opacity 0 on the same path as the thumbnail. Nothing is shown until onLoad fires.",
            code: "opacity: visibility.target",
          }
        : {
            tone: "hot",
            title: "Full-res photo",
            body: "Rendered once, only on the detail screen. It follows the same interpolation as the thumbnail, so it can take over at any point of the animation.",
            code: "onLoad={onLoad}",
          };
    case "close":
      return {
        tone: "detail",
        title: "Close button",
        body: "Fades in once the opening spring has finished. Closing runs the same interpolation in reverse, back into the cell.",
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
      if (t < T.tap)
        return {
          tone: "gallery",
          title: "Thumbnail",
          body: "A low-res image in its cell. On tap, its <Portal> switches to the root host.",
          code: 'hostName={isAnimating ? "root" : undefined}',
        };
      if (t < T.FS)
        return {
          tone: "host",
          title: "Teleported thumbnail",
          body: "The same native view, now a child of the root PortalHost: nothing is re-mounted or re-decoded. progress drives its translate, scale and height.",
          code: '<Portal hostName="root">',
        };
      if (t < T.reset)
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

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const ss = (t: number, a: number, b: number) => {
  const k = clamp((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const fade = (t: number, a: number, b: number, d = 0.35, o = 0.3) =>
  clamp((t - a) / d) * (1 - clamp((t - (b - o)) / o));
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
const flightU = (t: number) => {
  if (t <= T.F0) return 0;
  if (t < T.FS)
    return T.SWAP_PROGRESS * ramp((t - T.F0) / (T.FS - T.F0), 0, 0.25);
  if (t < T.RESUME) return T.SWAP_PROGRESS;
  if (t < T.FE)
    return (
      T.SWAP_PROGRESS +
      (1 - T.SWAP_PROGRESS) * ramp((t - T.RESUME) / (T.FE - T.RESUME), 0.2, 0)
    );
  return 1;
};
const px = (v: number) => `${v.toFixed(2)}px`;

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

// sparkles sit around the edges of the hovered element, a few inside it
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const sparkParams = (n: number, seed: number, size: number) =>
  Array.from({ length: n }, (_, i) => {
    const j = i + seed;
    const s = (i + rand(j) * 0.7) / n;
    const o = 0.02 + 0.05 * rand(j + 40);
    const edge = Math.floor(s * 4);
    const f = s * 4 - edge;
    const inner = i % 5 === 4;
    const [u, v]: Pt = inner
      ? [0.15 + 0.7 * rand(j + 240), 0.15 + 0.7 * rand(j + 280)]
      : edge === 0
        ? [f, -o]
        : edge === 1
          ? [1 + o, f]
          : edge === 2
            ? [1 - f, 1 + o]
            : [-o, 1 - f];
    return {
      u,
      v,
      w: 0.6 + 0.8 * rand(j + 80),
      ph: rand(j + 120) * Math.PI * 2,
      r: size * (0.6 + 0.8 * rand(j + 160)),
      rot: rand(j + 200) * 90,
    };
  });
const SPARKS = sparkParams(18, 0, 14);
const BURST = sparkParams(20, 500, 22);

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
  motion: boolean;
};
type Frame = {
  caption: number;
  progress: number;
  swapped: boolean;
  vis: Record<TipKey, number>;
  solidDetail: boolean;
};

function createScene(root: HTMLElement, palette: { current: Palette }) {
  const cache = new Map<string, Element>();
  const q = <E extends Element = HTMLElement>(k: string) => {
    let el = cache.get(k);
    if (!el) {
      el = root.querySelector(`[data-k="${k}"]`) ?? undefined;
      if (el) cache.set(k, el);
    }
    return el as unknown as E;
  };
  const all = (k: string) =>
    Array.from(root.querySelectorAll(`[data-k="${k}"]`));
  const sparks = all("spark");
  const burst = all("burst");
  const canvas = q("canvas");
  const attrs = (el: Element, a: Record<string, string | number>) => {
    for (const key in a) el.setAttribute(key, String(a[key]));
  };
  const box = (el: Element, r: Rect) =>
    attrs(el, { x: r.x, y: r.y, width: r.w, height: r.h });

  return (t: number, fx: Fx): Frame => {
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

    // hover: the hovered part lifts and glows, everything else steps back
    const hv = (key: TipKey) => fx.hk[key];
    const focusAll = Math.max(...KEYS.map(hv));
    const inHost = t >= T.tap && t < T.reset;
    const own0 = Math.max(hv("gallery"), hv("cell"), hv("header"), hv("slot"));
    const own1 = Math.max(hv("detail"), hv("full"), hv("close"));
    const own2 = hv("host");
    const ownFly = Math.max(hv("thumb"), inHost ? own2 : own0);
    const dim = (own: number) => 1 - 0.5 * clamp(focusAll - own);
    const breathe = fx.motion ? 0.85 + 0.15 * Math.sin(fx.now * 0.005) : 1;

    // camera
    const ex = ss(t, ...T.explode) * (1 - ss(t, ...T.collapse));
    const drift = ss(t, T.explode[1], T.collapse[0]);
    const sc = mix(0.9, 0.96, ex);
    const cx = mix(960, 860, ex);
    const cy = mix(520, 575, ex);
    q("stage").style.transform =
      `translate3d(${px(cx - 195)}, ${px(cy - 422)}, 0) scale(${sc}) rotateX(${(54 + 3 * fx.tiltY) * ex}deg) rotateZ(${(-36 + 5 * drift + 3 * fx.tiltX) * ex}deg)`;

    // layers; the detail screen exists only after the push
    const push = ss(t, ...T.push);
    const [z0, z1, z2] = ZL.map(
      (zz, i) => mix(i * 0.6, zz, ex) + 36 * [own0, own1, own2][i]! * ex,
    ) as [number, number, number];
    q("bezel").style.opacity = String((1 - 0.75 * ex) * dim(own0));
    q("L0").style.transform = `translateZ(${px(z0)})`;
    q("L1").style.transform = `translateZ(${px(z1)})`;
    q("L2").style.transform = `translateZ(${px(z2)})`;
    q("L0").style.opacity = String(dim(own0));
    q("L1").style.opacity = String(push * dim(own1));
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

    // spring progress shared by the thumbnail and the full-res photo
    const p = spring(flightU(t));
    const swapped = t >= T.FS;
    const done = t >= T.FE;
    const [H0, H1] = T.handoff;
    const handK = ss(t, H0, H1);
    const inHandoff = t >= H0 && t < H1;
    const landed = t >= H1;

    // detail screen: full-res photo + its invisible outline, as SVG geometry (sub-pixel, no layout snapping)
    const backdrop = done ? 1 : p;
    q("backdrop").style.opacity = String(backdrop);
    const dr = rect(p);
    const photoBox = (r: Rect): Rect => ({
      x: r.x,
      y: r.y - (1.5 * r.w - r.h) / 2,
      w: r.w,
      h: 1.5 * r.w,
    });
    box(q("detailClipRect"), dr);
    box(q("ghostRect"), dr);
    box(q("detailImage"), photoBox(dr));
    (q("detailImage") as unknown as SVGElement).style.opacity = landed
      ? "1"
      : "0";
    (q("ghostRect") as unknown as SVGElement).style.opacity = String(
      landed ? 0 : ss(t, T.push[0] + 0.3, T.push[1] + 0.2) * (ex > 0.5 ? 1 : 0),
    );
    (
      [
        ["d0", 0, 0],
        ["d1", 1, 0],
        ["d2", 1, 1],
        ["d3", 0, 1],
      ] as const
    ).forEach(([key, a, b]) => {
      q(key).style.left = px(dr.x + a * dr.w);
      q(key).style.top = px(dr.y + b * dr.h);
    });
    const closeK = ss(t, ...T.close);
    q("closeBtn").style.opacity = String(closeK);

    // teleported thumbnail: moves along z between layers, geometry drawn in SVG
    const lift = ss(t, ...T.lift);
    const desc = ss(t, ...T.desc);
    const fz = mix(mix(z0, z2, lift), z0, desc) + 2 + 24 * hv("thumb") * ex;
    const fr = rect(t >= T.reset ? 0 : p);
    q("flyer").style.transform = `translate3d(0, 0, ${px(fz)})`;
    q("flyer").style.opacity = String(dim(ownFly));
    box(q("thumbClipRect"), fr);
    box(q("thumbOutline"), fr);
    box(q("thumbImage"), photoBox(fr));
    (
      [
        ["f0", 0, 0],
        ["f1", 1, 0],
        ["f2", 1, 1],
        ["f3", 0, 1],
      ] as const
    ).forEach(([key, a, b]) => {
      q(key).style.left = px(fr.x + a * fr.w);
      q(key).style.top = px(fr.y + b * fr.h);
    });
    // the hidden thumbnail's progress resets to 0 instantly; fade its outline through the jump
    const resetFade =
      t < T.reset
        ? 1 - ss(t, T.reset - 0.25, T.reset)
        : ss(t, T.reset, T.reset + 0.25);
    (q("thumbImage") as unknown as SVGElement).style.opacity = swapped
      ? "0"
      : "1";
    const outlineK = swapped ? ex * resetFade * ss(t, H0, H0 + 0.5) : 0;
    (q("thumbOutline") as unknown as SVGElement).style.opacity =
      String(outlineK);
    q("slot").style.borderColor = rgba(pal.host, 0.9 * ex * lift);

    // handoff: the visible image travels from the root host down to the detail screen and sharpens on the way
    const xz = mix(z2, z1, handK) + 3;
    q("handoff").style.transform = `translate3d(0, 0, ${px(xz)})`;
    q("handoff").style.opacity = String(
      (inHandoff ? 1 : 0) * dim(Math.max(hv("full"), own1)),
    );
    box(q("handoffClipRect"), dr);
    box(q("handoffHit"), dr);
    box(q("handoffThumb"), photoBox(dr));
    box(q("handoffFull"), photoBox(dr));
    (q("handoffThumb") as unknown as SVGElement).style.opacity = String(
      1 - ss(t, H0 + 0.1, H0 + 0.85),
    );
    (
      [
        ["x0", 0, 0],
        ["x1", 1, 0],
        ["x2", 1, 1],
        ["x3", 0, 1],
      ] as const
    ).forEach(([key, a, b]) => {
      q(key).style.left = px(dr.x + a * dr.w);
      q(key).style.top = px(dr.y + b * dr.h);
    });
    for (let i = 0; i < 3; i++) {
      const lag = 0.11 * (i + 1);
      const kk = ss(t, H0 + lag, H1 + lag);
      const on = t >= H0 && t < H1 + lag;
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
    const labOut = 1 - ss(t, T.collapse[0] - 0.4, T.collapse[0]);
    const labK = [
      fade(t, T.lab0, 99) * labOut * ex,
      ss(t, T.push[0] + 0.2, T.push[1] + 0.2) * labOut * ex,
      fade(t, T.lab2, 99) * labOut * ex,
    ];
    const labOwn = [own0, own1, own2];
    const labColors = [pal.gallery, pal.detail, pal.host];
    const labDy = [46, 0, -46] as const;
    labK.forEach((kk, i) => {
      const [ax, ay] = center(q(`a${i}`));
      const lx = 1390;
      const ly = ay + (labDy[i] ?? 0);
      const own = labOwn[i] ?? 0;
      const op = kk * dim(own);
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

    const flightVis =
      clamp((t - T.F0 + 0.4) / 0.4) * (1 - ss(t, T.FE, T.FE + 0.4));
    const beam = inHandoff ? Math.sin(Math.PI * handK) : 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = center(q(`f${i}`));
      const [x2, y2] = center(q(`d${i}`));
      attrs(q(`align${i}`), {
        x1,
        y1,
        x2,
        y2,
        "opacity": flightVis,
        "stroke-width": 2 + 2.5 * beam,
      });
    }

    const tk = (t - T.tap) / 0.7;
    const [ax0, ay0] = center(q("f0"));
    const [ax2, ay2] = center(q("f2"));
    const rippleOn = tk > 0 && tk < 1;
    attrs(q("ripple"), {
      cx: (ax0 + ax2) / 2,
      cy: (ay0 + ay2) / 2,
      r: 18 + 90 * clamp(tk),
      opacity: rippleOn ? 1 - tk : 0,
    });
    attrs(q("touch"), {
      cx: (ax0 + ax2) / 2,
      cy: (ay0 + ay2) / 2,
      r: 20,
      opacity: rippleOn ? 1 - tk : 0,
    });

    const dQuad = corners("d");
    const fk = (t - H1) / 1.4;
    const flashOn = fk >= 0 && fk < 1;
    attrs(q("flash"), {
      "points": dQuad.map((pt) => pt.join(",")).join(" "),
      "stroke": rgba(pal.hot, 1),
      "stroke-width": 8 * (1 - clamp(fk)) + 3,
      "opacity": flashOn ? 1 - fk : 0,
    });

    const [f0x, f0y] = center(q("f0"));
    const [d1x, d1y] = center(q("d1"));
    const chipK = ex * labOut;
    const place = (key: string, x: number, y: number, op: number) => {
      const c = q(key);
      c.style.transform = `translate(${px(x)}, ${px(y)})`;
      c.style.opacity = String(op);
    };
    place(
      "chipLow",
      f0x - 10,
      f0y - 62,
      (swapped ? 0 : 1) * ss(t, T.lift[1] - 0.2, T.lift[1] + 0.3) * chipK,
    );
    place(
      "chipHidden",
      f0x - 10,
      f0y - 62,
      (swapped ? 1 : 0) *
        resetFade *
        (1 - ss(t, T.desc[1], T.desc[1] + 0.5)) *
        chipK,
    );
    place(
      "chipGhost",
      d1x + 16,
      d1y - 8,
      (landed ? 0 : 1) * ss(t, T.push[0] + 0.3, T.push[1] + 0.3) * chipK,
    );
    place(
      "chipFull",
      d1x + 16,
      d1y - 8,
      (landed ? 1 : 0) * (1 - ss(t, T.RESUME + 2.5, T.RESUME + 3)) * chipK,
    );

    // what can be hovered right now
    const vis: Record<TipKey, number> = {
      gallery: 1,
      cell: 1,
      header: 1,
      slot: t >= T.tap && t < T.desc[1] ? 1 : 0,
      detail: push,
      full: push > 0.5 ? 1 : 0,
      close: closeK,
      host: ex,
      thumb: swapped ? outlineK : 1,
    };

    // glowing outline and sparkles around the hovered part
    const quadFor = (key: TipKey): Quad | null => {
      switch (key) {
        case "thumb":
          return corners("f");
        case "full":
          return inHandoff ? corners("x") : dQuad;
        case "gallery":
          return corners("c0");
        case "detail":
          return corners("c1");
        case "host":
          return corners("c2");
        case "cell":
          return fx.cell >= 0
            ? subQuad(corners("c0"), cellRect(fx.cell))
            : null;
        case "slot":
          return subQuad(corners("c0"), cellRect(0));
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
    const tone = (key: TipKey): Rgb => pal[tipFor(key, t).tone];
    const focusQuad = fx.focus ? quadFor(fx.focus) : null;
    const auraOn =
      fx.focus && !PLANES.includes(fx.focus) && focusQuad ? fx.focusK : 0;
    if (focusQuad && fx.focus) {
      const pts = focusQuad.map((pt) => pt.join(",")).join(" ");
      const c = tone(fx.focus);
      for (const part of ["auraGlow", "auraLine"]) {
        attrs(q(part), {
          "points": pts,
          "stroke": rgba(c, part === "auraGlow" ? 0.35 : 0.95),
          "stroke-dashoffset": fx.motion ? -fx.now * 0.03 : 0,
        });
      }
    }
    q("aura").setAttribute("opacity", String(auraOn * breathe));

    const drawSparks = (
      key: string,
      els: Element[],
      params: typeof SPARKS,
      quad: Quad | null,
      amount: number,
      c: Rgb,
    ) => {
      const map = quad && amount > 0.01 && fx.motion ? quadMap(quad) : null;
      if (map) q<SVGElement>(`halo-${key}`).style.color = rgba(c, 1);
      els.forEach((el, i) => {
        const sp = params[i];
        if (!map || !sp) {
          el.setAttribute("opacity", "0");
          return;
        }
        const tw = (0.5 + 0.5 * Math.sin(fx.now * 0.0032 * sp.w + sp.ph)) ** 3;
        const [x, y] = map(sp.u, sp.v);
        el.setAttribute(
          "transform",
          `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(sp.rot + fx.now * 0.03 * sp.w).toFixed(1)}) scale(${(sp.r * (0.55 + 0.45 * tw)).toFixed(2)})`,
        );
        el.setAttribute("opacity", (amount * tw).toFixed(3));
        (el as SVGElement).style.color = rgba(c, 1);
      });
    };
    drawSparks(
      "spark",
      sparks,
      SPARKS,
      focusQuad,
      fx.focusK,
      fx.focus ? tone(fx.focus) : pal.host,
    );
    // a burst of sparkles when the full-res photo takes over
    const burstK =
      t >= H1 - 0.2 && t < H1 + 1.6
        ? ex * ss(t, H1 - 0.2, H1) * (1 - ss(t, H1 + 0.4, H1 + 1.6))
        : 0;
    drawSparks(
      "burst",
      burst,
      BURST,
      burstK > 0 ? dQuad : null,
      burstK,
      pal.hot,
    );

    let caption = 0;
    CAPTIONS.forEach(([start], i) => {
      if (t >= start) caption = i;
    });
    const shownP = t >= T.reset && t < T.desc[1] ? 0 : done ? 1 : p;
    return {
      caption,
      progress: shownP,
      swapped,
      vis,
      solidDetail: push * backdrop > 0.5,
    };
  };
}

const TITLE =
  "3D breakdown of the Photo Gallery hero transition: the thumbnail teleports into a root PortalHost, flies to full screen together with an invisible full-res photo, and the two swap in one commit as soon as the photo loads.";

// Server-rendered placeholder (also what search engines and llms.txt see): same box, plus a text transcript
function Transcript() {
  return (
    <figure className={styles.root}>
      <div className={styles.stageWrap} role="img" aria-label={TITLE} />
      <figcaption className={styles.srOnly}>
        <p>Animation transcript:</p>
        <ol>
          {CAPTIONS.map(([start, heading, text]) => (
            <li key={start}>{`${heading}. ${text}`}</li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}

export default function PhotoTransitionExplainer() {
  return (
    <BrowserOnly fallback={<Transcript />}>
      {() => <Explainer title={TITLE} />}
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

function Explainer({ title }: { title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const renderRef = useRef<((t: number, fx: Fx) => Frame) | null>(null);
  const frameRef = useRef<Frame | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
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
    motion: true,
    key: null,
    tipId: "",
  });
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = useBaseUrl("/img/photo-gallery-transition/");

  const draw = (t: number) => {
    const frame = renderRef.current?.(t, fxRef.current);
    if (!frame) return;
    frameRef.current = frame;
    if (scrubRef.current) scrubRef.current.value = String(t);
    if (progressRef.current)
      progressRef.current.textContent = frame.progress.toFixed(2);
    if (barRef.current)
      barRef.current.style.width = `${(frame.progress * 100).toFixed(1)}%`;
    if (sourceRef.current)
      sourceRef.current.textContent = frame.swapped ? "0" : "1";
    if (targetRef.current)
      targetRef.current.textContent = frame.swapped ? "1" : "0";
    if (loadRef.current)
      loadRef.current.textContent = frame.swapped
        ? "loaded (onLoad fired)"
        : t >= T.push[0]
          ? "loading"
          : "not requested";
    setCaption(frame.caption);
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
    if (playingRef.current) {
      let t = timeRef.current + dt;
      if (t > DURATION + LOOP_HOLD) t = 0;
      timeRef.current = t;
    }
    const t = Math.min(timeRef.current, DURATION);
    const fx = fxRef.current;
    const ptr = pointer.current;
    const root = rootRef.current;
    const stage = stageRef.current;

    // pick what's under the pointer, then ease the hover amounts towards it
    if ((ptr.inside || ptr.tapped) && root) {
      const [key, cell] = pick(ptr.x, ptr.y);
      ptr.tapped = false;
      fx.key = key;
      if (key === "cell") fx.cell = cell;
    } else if (!ptr.pinned) fx.key = null;
    const ease = 1 - Math.exp(-dt * 11);
    let busy = false;
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
    fx.now = now;
    draw(t);

    // tooltip next to the pointer, kept inside the figure
    const next = fx.key ? tipFor(fx.key, t) : null;
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
  // effects start the loop through a ref, so they don't depend on this render's closures
  const kickRef = useRef(kick);
  useEffect(() => {
    kickRef.current = kick;
  });

  // set up the scene, scale it to the container, and pick the initial frame
  useEffect(() => {
    const root = rootRef.current;
    const stageWrap = stageRef.current;
    if (!root || !stageWrap) return;
    const palette = { current: readPalette(root) };
    renderRef.current = createScene(root, palette);
    const canvas = root.querySelector<HTMLElement>(`.${styles.canvas}`)!;
    const fit = () => {
      canvas.style.transform = `scale(${stageWrap.clientWidth / 1920})`;
      draw(timeRef.current);
    };
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    fxRef.current.motion = !reduced;
    if (reduced) {
      timeRef.current = 14.8; // right after the swap, as a still frame
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
      draw(timeRef.current);
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
  }, []);

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
    if (!playing && timeRef.current >= DURATION) timeRef.current = 0;
    setPlaying(!playing);
  };
  const scrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    userPaused.current = true;
    setPlaying(false);
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
  const halo = `${uid}-halo`;
  const [, capTitle = "", capText = ""] = CAPTIONS[caption] ?? [];
  const corner = (prefix: string) =>
    [0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className={`${styles.anchor} ${styles[`corner${i}`]}`}
        data-k={`${prefix}${i}`}
      />
    ));
  const star = (key: string) =>
    Array.from({ length: key === "spark" ? SPARKS.length : BURST.length }).map(
      (_, i) => (
        <g key={i} data-k={key} opacity="0">
          <circle r="2.6" fill={`url(#${halo}-${key})`} />
          <path
            d="M0 -1C.12 -.12 .12 -.12 1 0C.12 .12 .12 .12 0 1C-.12 .12 -.12 .12 -1 0C-.12 -.12 -.12 -.12 0 -1Z"
            fill="currentColor"
          />
          <circle r=".22" fill="#fff" />
        </g>
      ),
    );

  return (
    <figure className={styles.root} ref={rootRef}>
      <div
        ref={stageRef}
        className={styles.stageWrap}
        role="img"
        aria-label={title}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        <div className={styles.canvas} data-k="canvas">
          <div className={styles.viewport}>
            <div className={styles.stage} data-k="stage">
              <div className={styles.bezel} data-k="bezel" />

              <div
                className={`${styles.layer} ${styles.gallery}`}
                data-k="L0"
                data-tip="gallery"
              >
                {IDS.map((id, i) =>
                  i === 0 ? null : (
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
                <div className={styles.slot} data-k="slot" data-tip="slot" />
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
                    href={`${base}full_15.jpg`}
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
                <div className={styles.glass} data-k="g1" />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a1"
                />
                {["d0", "d1", "d2", "d3"].map((k) => (
                  <div key={k} className={styles.anchor} data-k={k} />
                ))}
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
                    href={`${base}thumb_15.jpg`}
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
                {["f0", "f1", "f2", "f3"].map((k) => (
                  <div key={k} className={styles.anchor} data-k={k} />
                ))}
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
                    href={`${base}full_15.jpg`}
                    preserveAspectRatio="none"
                    clipPath={`url(#${handoffClip})`}
                  />
                  <image
                    data-k="handoffThumb"
                    href={`${base}thumb_15.jpg`}
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
                {["x0", "x1", "x2", "x3"].map((k) => (
                  <div key={k} className={styles.anchor} data-k={k} />
                ))}
              </div>
            </div>
          </div>

          <div className={styles.hud} aria-hidden="true">
            <svg className={styles.hudSvg} width="1920" height="1080">
              <defs>
                {["spark", "burst"].map((key) => (
                  // currentColor in a gradient resolves on the gradient itself, so each group has its own
                  <radialGradient
                    key={key}
                    id={`${halo}-${key}`}
                    data-k={`halo-${key}`}
                  >
                    <stop
                      offset="0"
                      stopColor="currentColor"
                      stopOpacity="0.55"
                    />
                    <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                  </radialGradient>
                ))}
              </defs>
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
              {star("spark")}
              {star("burst")}
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
        <div className={styles.capTitle}>{capTitle}</div>
        <div className={styles.capText}>{capText}</div>
      </figcaption>

      <div className={styles.controls}>
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
        <input
          ref={scrubRef}
          className={styles.scrubber}
          type="range"
          min={0}
          max={DURATION}
          step={1 / 60}
          defaultValue={0}
          onChange={scrub}
          aria-label="Animation timeline"
        />
        <dl className={styles.state}>
          <div>
            <dt>progress</dt>
            <dd>
              <span ref={progressRef}>0.00</span>
              <span className={styles.bar}>
                <span ref={barRef} />
              </span>
            </dd>
          </div>
          <div>
            <dt>visibility.source</dt>
            <dd ref={sourceRef}>1</dd>
          </div>
          <div>
            <dt>visibility.target</dt>
            <dd ref={targetRef}>0</dd>
          </div>
          <div>
            <dt>full-res</dt>
            <dd ref={loadRef}>not requested</dd>
          </div>
        </dl>
      </div>
    </figure>
  );
}
