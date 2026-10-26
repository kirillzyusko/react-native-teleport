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
const X0 = 130;
const Y0 = TOP;
const IDS = [10, 15, 20, 25, 29, 36, 42, 49, 54, 58, 75, 76];
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
    "set({ visibility: { source: 0, target: 1 } }) lands in the same native frame.",
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

type Frame = { caption: number; progress: number; swapped: boolean };

function createScene(root: HTMLElement) {
  const q = <E extends Element = HTMLElement>(k: string) =>
    root.querySelector(`[data-k="${k}"]`) as unknown as E;
  const canvas = q("canvas");
  const attrs = (el: Element, a: Record<string, string | number>) => {
    for (const key in a) el.setAttribute(key, String(a[key]));
  };
  const box = (el: Element, r: Rect) =>
    attrs(el, { x: r.x, y: r.y, width: r.w, height: r.h });
  const labColors = ["#5b8cff", "#a77bff", "#2fe0c4"];

  return (t: number): Frame => {
    const cr = canvas.getBoundingClientRect();
    const k = cr.width / 1920 || 1;
    const center = (el: Element): [number, number] => {
      const r = el.getBoundingClientRect();
      return [
        (r.left + r.width / 2 - cr.left) / k,
        (r.top + r.height / 2 - cr.top) / k,
      ];
    };

    // camera
    const ex = ss(t, ...T.explode) * (1 - ss(t, ...T.collapse));
    const drift = ss(t, T.explode[1], T.collapse[0]);
    const sc = mix(0.9, 0.96, ex);
    const cx = mix(960, 860, ex);
    const cy = mix(520, 565, ex);
    q("stage").style.transform =
      `translate3d(${px(cx - 195)}, ${px(cy - 422)}, 0) scale(${sc}) rotateX(${54 * ex}deg) rotateZ(${(-36 + 5 * drift) * ex}deg)`;

    // layers; the detail screen exists only after the push
    const push = ss(t, ...T.push);
    const [z0, z1, z2] = ZL.map((zz, i) => mix(i * 0.6, zz, ex)) as [
      number,
      number,
      number,
    ];
    q("bezel").style.opacity = String(1 - 0.75 * ex);
    q("L0").style.transform = `translateZ(${px(z0)})`;
    q("L1").style.transform = `translateZ(${px(z1)})`;
    q("L2").style.transform = `translateZ(${px(z2)})`;
    q("L1").style.opacity = String(push);
    q("L2").style.opacity = String(ex);
    const glass = (key: string, c: string, a: number, dashed: boolean) => {
      const g = q(key);
      g.style.border = `2px ${dashed ? "dashed" : "solid"} rgba(${c},${0.85 * ex})`;
      g.style.background = `rgba(${c},${a * ex})`;
      g.style.boxShadow = `0 0 40px rgba(${c},${0.35 * ex}), inset 0 0 30px rgba(${c},${0.12 * ex})`;
    };
    glass("g0", "91,140,255", 0, false);
    glass("g1", "167,123,255", 0.07, false);
    glass("g2", "47,224,196", 0.06, true);

    // spring progress shared by the thumbnail and the full-res photo
    const p = spring(flightU(t));
    const swapped = t >= T.FS;
    const done = t >= T.FE;

    // detail screen: full-res photo + its invisible outline, as SVG geometry (sub-pixel, no layout snapping)
    q("backdrop").style.opacity = String(done ? 1 : p);
    const dr = rect(p);
    box(q("detailClipRect"), dr);
    box(q("ghostRect"), dr);
    box(q("detailImage"), {
      x: dr.x,
      y: dr.y - (1.5 * dr.w - dr.h) / 2,
      w: dr.w,
      h: 1.5 * dr.w,
    });
    (q("detailImage") as unknown as SVGElement).style.opacity = swapped
      ? "1"
      : "0";
    (q("ghostRect") as unknown as SVGElement).style.opacity = String(
      swapped
        ? 0
        : ss(t, T.push[0] + 0.3, T.push[1] + 0.2) * (ex > 0.5 ? 1 : 0),
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
    q("closeBtn").style.opacity = String(ss(t, ...T.close));

    // teleported thumbnail: moves along z between layers, geometry drawn in SVG
    const lift = ss(t, ...T.lift);
    const desc = ss(t, ...T.desc);
    const fz = mix(mix(z0, z2, lift), z0, desc) + 2;
    const fr = rect(t >= T.reset ? 0 : p);
    q("flyer").style.transform = `translate3d(0, 0, ${px(fz)})`;
    box(q("thumbClipRect"), fr);
    box(q("thumbOutline"), fr);
    box(q("thumbImage"), {
      x: fr.x,
      y: fr.y - (1.5 * fr.w - fr.h) / 2,
      w: fr.w,
      h: 1.5 * fr.w,
    });
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
    (q("thumbOutline") as unknown as SVGElement).style.opacity = String(
      swapped ? ex * resetFade : 0,
    );
    q("slot").style.borderColor = `rgba(47,224,196,${0.9 * ex * lift})`;

    // ---------- HUD (internal 1920×1080 coordinates) ----------
    const labOut = 1 - ss(t, T.collapse[0] - 0.4, T.collapse[0]);
    const labK = [
      fade(t, T.lab0, 99) * labOut * ex,
      ss(t, T.push[0] + 0.2, T.push[1] + 0.2) * labOut * ex,
      fade(t, T.lab2, 99) * labOut * ex,
    ];
    const labDy = [46, 0, -46] as const;
    labK.forEach((kk, i) => {
      const [ax, ay] = center(q(`a${i}`));
      const lx = 1390;
      const ly = ay + (labDy[i] ?? 0);
      const lab = q(`lab${i}`);
      lab.style.transform = `translate(${px(lx + 18)}, ${px(ly - 30)})`;
      lab.style.opacity = String(kk);
      attrs(q(`labDot${i}`), {
        cx: ax,
        cy: ay,
        r: 7,
        fill: labColors[i] ?? "#fff",
        opacity: kk,
      });
      attrs(q(`labLine${i}`), {
        d: `M${ax},${ay} L${lx - 30},${ly} L${lx + 6},${ly}`,
        opacity: kk,
      });
    });

    const flightVis =
      clamp((t - T.F0 + 0.4) / 0.4) * (1 - ss(t, T.FE, T.FE + 0.4));
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = center(q(`f${i}`));
      const [x2, y2] = center(q(`d${i}`));
      attrs(q(`align${i}`), { x1, y1, x2, y2, opacity: flightVis });
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

    const fk = (t - T.FS) / 1.4;
    const flashOn = fk >= 0 && fk < 1;
    attrs(q("flash"), {
      "points": [0, 1, 2, 3].map((i) => center(q(`d${i}`)).join(",")).join(" "),
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
      (swapped ? 0 : 1) * ss(t, T.push[0] + 0.3, T.push[1] + 0.3) * chipK,
    );
    place(
      "chipFull",
      d1x + 16,
      d1y - 8,
      (swapped ? 1 : 0) * (1 - ss(t, T.RESUME + 2.5, T.RESUME + 3)) * chipK,
    );

    let caption = 0;
    CAPTIONS.forEach(([start], i) => {
      if (t >= start) caption = i;
    });
    const shownP = t >= T.reset && t < T.desc[1] ? 0 : done ? 1 : p;
    return { caption, progress: shownP, swapped };
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

function Explainer({ title }: { title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const renderRef = useRef<((t: number) => Frame) | null>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const sourceRef = useRef<HTMLSpanElement>(null);
  const targetRef = useRef<HTMLSpanElement>(null);
  const loadRef = useRef<HTMLSpanElement>(null);
  const [caption, setCaption] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const userPaused = useRef(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const base = useBaseUrl("/img/photo-gallery-transition/");

  const draw = (t: number) => {
    const frame = renderRef.current?.(t);
    if (!frame) return;
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

  // set up the scene, scale it to the container, and pick the initial frame
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    renderRef.current = createScene(root);
    const stageWrap = root.querySelector<HTMLElement>(`.${styles.stageWrap}`)!;
    const canvas = root.querySelector<HTMLElement>(`.${styles.canvas}`)!;
    const fit = () => {
      canvas.style.transform = `scale(${stageWrap.clientWidth / 1920})`;
      draw(timeRef.current);
    };
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      timeRef.current = 13.6; // the swap moment, as a still frame
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
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // autoplay while visible, unless the reader paused it
  useEffect(() => {
    setPlaying(visible && !userPaused.current);
  }, [visible]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let t = timeRef.current + dt;
      if (t > DURATION + LOOP_HOLD) t = 0;
      timeRef.current = t;
      draw(Math.min(t, DURATION));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
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
  };

  const detailClip = `${uid}-detailClip`;
  const thumbClip = `${uid}-thumbClip`;
  const [, capTitle = "", capText = ""] = CAPTIONS[caption] ?? [];

  return (
    <figure className={styles.root} ref={rootRef}>
      <div className={styles.stageWrap} role="img" aria-label={title}>
        <div className={styles.canvas} data-k="canvas">
          <div className={styles.viewport}>
            <div className={styles.stage} data-k="stage">
              <div className={styles.bezel} data-k="bezel" />

              <div className={`${styles.layer} ${styles.gallery}`} data-k="L0">
                {IDS.map((id, i) =>
                  i === 1 ? null : (
                    <div
                      key={id}
                      className={styles.cell}
                      style={{
                        left: (i % 3) * 130,
                        top: TOP + Math.floor(i / 3) * 130,
                        backgroundImage: `url(${base}thumb_${id}.jpg)`,
                      }}
                    />
                  ),
                )}
                <div className={styles.slot} data-k="slot" />
                <div className={styles.header}>
                  <span className={styles.time}>9:41</span>
                  <span className={styles.island} />
                  <span className={styles.title}>Photos</span>
                </div>
                <div className={styles.glass} data-k="g0" />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a0"
                />
              </div>

              <div className={styles.layer} data-k="L1">
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
                    fill="none"
                    stroke="#a77bff"
                    strokeWidth="2.5"
                    strokeDasharray="10 7"
                  />
                </svg>
                <div className={styles.closeBtn} data-k="closeBtn">
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
              </div>

              <div className={styles.layer} data-k="L2">
                <div className={styles.glass} data-k="g2" />
                <div
                  className={`${styles.anchor} ${styles.labelAnchor}`}
                  data-k="a2"
                />
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
            </div>
          </div>

          <div className={styles.hud} aria-hidden="true">
            <svg className={styles.hudSvg} width="1920" height="1080">
              {[0, 1, 2].map((i) => (
                <g key={i}>
                  <path
                    data-k={`labLine${i}`}
                    stroke="rgba(220,226,255,.5)"
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
                  stroke="rgba(255,255,255,.6)"
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
              <polygon data-k="flash" fill="none" stroke="#ffd166" />
            </svg>
            <div className={styles.label} data-k="lab0">
              <div className={`${styles.labelName} ${styles.cGallery}`}>
                Gallery screen
              </div>
              <div className={styles.labelSub}>low-res thumbnails</div>
            </div>
            <div className={styles.label} data-k="lab1">
              <div className={`${styles.labelName} ${styles.cDetail}`}>
                Detail screen
              </div>
              <div className={styles.labelSub}>transparent modal</div>
            </div>
            <div className={styles.label} data-k="lab2">
              <div className={`${styles.labelName} ${styles.cHost}`}>
                PortalHost “root”
              </div>
              <div className={styles.labelSub}>from &lt;PortalProvider&gt;</div>
            </div>
            <div className={`${styles.chip} ${styles.cLow}`} data-k="chipLow">
              LOW-RES thumbnail
            </div>
            <div
              className={`${styles.chip} ${styles.cHost}`}
              data-k="chipHidden"
            >
              thumbnail, hidden
            </div>
            <div
              className={`${styles.chip} ${styles.cDetail}`}
              data-k="chipGhost"
            >
              full-res, loading
            </div>
            <div className={`${styles.chip} ${styles.cHot}`} data-k="chipFull">
              FULL-RES photo
            </div>
          </div>
        </div>
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
