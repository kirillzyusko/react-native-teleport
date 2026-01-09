import { useEffect, useState } from "react";
import { View, StyleSheet, type ScrollEvent, BackHandler } from "react-native";
import Reanimated, { useAnimatedProps } from "react-native-reanimated";
import { posts } from "./posts";
import ReelsHeader from "./components/ReelsHeader";
import { SCREEN_HEIGHT } from "./constants";
import FullScreenReel from "./components/FullScreenReel";
import { useTransition } from "./hooks/useTransition";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";
import type { ScreenNames } from "../../constants/screenNames";
import { useNavigation } from "@react-navigation/native";

type Props = NativeStackScreenProps<
  ExamplesStackParamList,
  ScreenNames.INSTAGRAM_REELS
>;

export default function Reels({ route }: Props) {
  const post = route.params.post;
  const reels = posts.filter((p) => p.id !== post.id && p.video);
  const [index, setIndex] = useState(0);
  const progress = useTransition((state) => state.progress);
  const goToFeed = useTransition((state) => state.goToFeed);
  const navigation = useNavigation();

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        goToFeed(navigation.goBack);

        return true;
      },
    );

    return () => subscription.remove();
  }, [goToFeed, navigation]);

  const onScroll = (e: ScrollEvent) => {
    const { y } = e.nativeEvent.contentOffset;
    setIndex(Math.round(y / SCREEN_HEIGHT));
  };

  const animatedProps = useAnimatedProps(
    () => ({
      // allow scroll only for reels screen
      scrollEnabled: progress.value === 1,
    }),
    [],
  );

  return (
    <View style={styles.container}>
      <Reanimated.ScrollView
        animatedProps={animatedProps}
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        overScrollMode="never"
        bounces={false}
      >
        <FullScreenReel post={post} portal active={index === 0} />
        {reels.map((p, i) => (
          <FullScreenReel key={p.id} post={p} active={index === i + 1} />
        ))}
      </Reanimated.ScrollView>
      <ReelsHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
