import type { ImageSourcePropType } from "react-native";

export type Movie = {
  id: string;
  title: string;
  year: string;
  duration: string;
  genre: string;
  rating: string;
  poster: ImageSourcePropType;
  description: string;
};

export const movies: [Movie, ...Movie[]] = [
  {
    id: "interstellar",
    title: "Interstellar",
    year: "2014",
    duration: "2h 49m",
    genre: "Adventure / Sci-Fi",
    rating: "8.8",
    poster: {
      uri: "https://image.tmdb.org/t/p/w780/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    },
    description:
      "Explorers travel through a wormhole to find humanity a future beyond a failing Earth.",
  },
  {
    id: "inception",
    title: "Inception",
    year: "2010",
    duration: "2h 28m",
    genre: "Action / Sci-Fi",
    rating: "8.4",
    poster: {
      uri: "https://image.tmdb.org/t/p/w780/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    },
    description:
      "A thief who steals secrets inside dreams is offered one last job: planting an idea instead.",
  },
  {
    id: "the-dark-knight",
    title: "The Dark Knight",
    year: "2008",
    duration: "2h 32m",
    genre: "Action / Crime",
    rating: "8.5",
    poster: {
      uri: "https://image.tmdb.org/t/p/w780/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    },
    description:
      "Batman, Gordon, and Harvey Dent face Gotham's criminal underworld as the Joker turns order into chaos.",
  },
  {
    id: "fight-club",
    title: "Fight Club",
    year: "1999",
    duration: "2h 19m",
    genre: "Drama / Thriller",
    rating: "8.4",
    poster: {
      uri: "https://image.tmdb.org/t/p/w780/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg",
    },
    description:
      "An insomniac office worker and a soap salesman build an underground outlet that spirals out of control.",
  },
  {
    id: "the-matrix",
    title: "The Matrix",
    year: "1999",
    duration: "2h 16m",
    genre: "Action / Sci-Fi",
    rating: "8.2",
    poster: {
      uri: "https://image.tmdb.org/t/p/w780/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
    },
    description:
      "A hacker joins rebels fighting the machine-made simulation that has hidden the truth from humanity.",
  },
];
