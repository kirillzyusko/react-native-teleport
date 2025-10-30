export type PostType = {
  id: number;
  author: string;
  text: string;
  likes: number;
  comments: number;
  video?: ReturnType<typeof require>;
  photo?: string;
  date: string;
};

export const posts: PostType[] = [
  {
    id: 1,
    author: "kirillzyusko",
    text: "Magic forest",
    likes: 126,
    comments: 12,
    video: require("./videos/forest.mp4"),
    date: "29 October",
  },
  {
    id: 2,
    author: "kirillzyusko",
    text: "Beautiful autumn",
    likes: 271,
    comments: 96,
    video: require("./videos/autumn.mp4"),
    date: "28 October",
  },
  {
    id: 3,
    author: "kirillzyusko",
    text: "Squirrel in the forest...",
    likes: 34,
    comments: 3,
    video: require("./videos/squirrel.mp4"),
    date: "27 October",
  },
  {
    id: 4,
    author: "kirillzyusko",
    text: "Mountains and lake",
    likes: 65,
    comments: 14,
    photo: "https://images.pexels.com/photos/1526713/pexels-photo-1526713.jpeg",
    date: "26 October",
  },
  {
    id: 5,
    author: "kirillzyusko",
    text: "Last Norway trip",
    likes: 189,
    comments: 44,
    photo: "https://images.pexels.com/photos/3791466/pexels-photo-3791466.jpeg",
    date: "25 October",
  },
];
