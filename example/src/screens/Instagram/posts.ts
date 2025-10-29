export type PostType = {
  id: number;
  author: string;
  text: string;
  likes: number;
  comments: number;
  video: ReturnType<typeof require>;
};

export const posts: PostType[] = [
  {
    id: 1,
    author: "kirillzyusko",
    text: "Magic forest",
    likes: 126,
    comments: 12,
    video: require("./videos/forest.mp4"),
  },
  {
    id: 2,
    author: "kirillzyusko",
    text: "Beautiful autumn",
    likes: 271,
    comments: 96,
    video: require("./videos/autumn.mp4"),
  },
  {
    id: 3,
    author: "kirillzyusko",
    text: "Squirrel in the forest...",
    likes: 34,
    comments: 3,
    video: require("./videos/squirrel.mp4"),
  },
];
