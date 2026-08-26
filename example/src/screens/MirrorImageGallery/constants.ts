export const COLUMNS = 3;
export const GRID_GAP = 2;

export const SPRING_CONFIG = {
  mass: 1.2,
  damping: 1000,
  stiffness: 500,
  overshootClamping: false,
};

export const getThumbnailSize = (screenWidth: number) =>
  Math.floor((screenWidth - GRID_GAP * (COLUMNS - 1)) / COLUMNS);

export const getPhotoHeight = (
  screenWidth: number,
  photoWidth: number,
  photoHeight: number,
) => screenWidth * (photoHeight / photoWidth);

export const getPortalName = (
  photoId: string,
  source: "low-res" | "full-res",
) => `mirror-gallery-${photoId}-${source}`;
