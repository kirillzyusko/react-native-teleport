import type { FontAwesome6SolidIconName } from "@react-native-vector-icons/fontawesome6";

export type Transaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  positive?: boolean;
  icon: FontAwesome6SolidIconName;
  tint: string;
  bg: string;
};

export const TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    title: "Spotify",
    subtitle: "Subscription",
    amount: "-$9.99",
    icon: "music",
    tint: "#1DB954",
    bg: "#E7F8EE",
  },
  {
    id: "2",
    title: "Salary",
    subtitle: "Acme Inc.",
    amount: "+$4,250.00",
    positive: true,
    icon: "briefcase",
    tint: "#6366f1",
    bg: "#EEF2FF",
  },
  {
    id: "3",
    title: "Uber",
    subtitle: "Ride home",
    amount: "-$18.40",
    icon: "car",
    tint: "#111",
    bg: "#F1F1F3",
  },
  {
    id: "4",
    title: "Starbucks",
    subtitle: "Coffee",
    amount: "-$5.25",
    icon: "mug-hot",
    tint: "#0F5132",
    bg: "#E7F5EC",
  },
  {
    id: "5",
    title: "Apple Store",
    subtitle: "AirPods Pro",
    amount: "-$249.00",
    icon: "headphones",
    tint: "#1a1a2e",
    bg: "#ECECF1",
  },
];
