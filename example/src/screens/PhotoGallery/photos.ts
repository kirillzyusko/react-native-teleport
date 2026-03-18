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

const PHOTOS: Photo[] = PHOTO_DATA.map(({ id, width, height }) => ({
  id: String(id),
  thumbnail: `https://picsum.photos/id/${id}/150/150`,
  fullSize: `https://picsum.photos/id/${id}/${width}/${height}`,
  width,
  height,
}));

export default PHOTOS;
