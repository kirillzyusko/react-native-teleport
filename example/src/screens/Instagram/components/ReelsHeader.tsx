import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  BackHandler,
} from "react-native";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Reanimated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { Portal } from "react-native-teleport";
import { FLOATING_ELEMENTS_DESTINATION } from "../constants";
import { useTransition } from "../hooks/useTransition";
import { useCallback, useEffect } from "react";

function ReelsHeader() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { goToFeed, progress, y } = useTransition();

  const onGoBack = useCallback(() => {
    goToFeed(navigation.goBack);
  }, [goToFeed, navigation]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onGoBack();

        return true;
      },
    );

    return () => subscription.remove();
  }, [onGoBack]);

  const style = useAnimatedStyle(
    () => ({
      opacity: progress.value,
      transform: [
        {
          translateY: interpolate(progress.value, [0, 1], [y, 0]),
        },
      ],
    }),
    [y],
  );

  return (
    <Portal hostName={FLOATING_ELEMENTS_DESTINATION} style={styles.container}>
      <Reanimated.View
        style={[
          {
            paddingTop: insets.top,
          },
          style,
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Reels</Text>
          <TouchableOpacity onPress={onGoBack}>
            <FontAwesome6
              name="chevron-left"
              iconStyle="solid"
              size={22}
              style={styles.back}
            />
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    width: "100%",
  },
  header: {
    flexDirection: "row",
    paddingHorizontal: 20,
  },
  title: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    fontWeight: "600",
    color: "white",
    fontSize: 20,
  },
  back: {
    color: "white",
  },
});

export default ReelsHeader;
