export type Photo = {
  id: string;
  thumbnail: string;
  fullSize: string;
  width: number;
  height: number;
};

const PHOTO_DATA: { id: number; width: number; height: number }[] = [
  { id: 10, width: 1080, height: 720 },
  { id: 15, width: 720, height: 1080 },
  { id: 20, width: 1080, height: 720 },
  { id: 25, width: 1080, height: 1080 },
  { id: 29, width: 1080, height: 720 },
  { id: 36, width: 720, height: 1080 },
  { id: 42, width: 1080, height: 720 },
  { id: 49, width: 1080, height: 720 },
  { id: 54, width: 720, height: 1080 },
  { id: 58, width: 1080, height: 720 },
  { id: 75, width: 1080, height: 720 },
  { id: 76, width: 720, height: 1080 },
];

const THUMB_SHORT_SIDE = 150;

const PHOTOS: Photo[] = PHOTO_DATA.map(({ id, width, height }) => {
  // Match the thumbnail's aspect to the full image so picsum returns the same
  // crop window — otherwise the cover-cropped thumb and the full image show
  // different parts of the original, producing a content jump at handoff.
  const thumbW =
    width >= height
      ? Math.round(THUMB_SHORT_SIDE * (width / height))
      : THUMB_SHORT_SIDE;
  const thumbH =
    height > width
      ? Math.round(THUMB_SHORT_SIDE * (height / width))
      : THUMB_SHORT_SIDE;

  return {
    id: String(id),
    thumbnail: `https://picsum.photos/id/${id}/${thumbW}/${thumbH}`,
    fullSize: `https://picsum.photos/id/${id}/${width}/${height}`,
    width,
    height,
  };
});

export default PHOTOS;
