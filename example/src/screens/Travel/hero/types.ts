export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlatStyle = Record<string, any>;

export type HeroElementRegistration = {
  rect: Rect;
  flatStyle: FlatStyle;
};

export type HeroTransition = {
  sourceRect: Rect;
  targetRect: Rect | null;
  sourceStyle: FlatStyle;
  targetStyle: FlatStyle | null;
};
