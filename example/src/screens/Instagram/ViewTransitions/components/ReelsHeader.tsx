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
import { useCallback, useEffect } from "react";
import { useViewTransition } from "../hooks/useViewTransition";
import { prepareViewTransition, runViewTransition } from "../viewTransition";

function ReelsHeader() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const clearTarget = useViewTransition((state) => state.clearTarget);
  const postId = useViewTransition((state) => state.postId);
  const setRunning = useViewTransition((state) => state.setRunning);
  const setTarget = useViewTransition((state) => state.setTarget);

  const onGoBack = useCallback(() => {
    if (!postId) {
      navigation.goBack();
      return;
    }

    prepareViewTransition(() => {
      setRunning(true);
    });

    runViewTransition(
      () => {
        setTarget(postId, "feed");
        navigation.goBack();
      },
      "to-feed",
      clearTarget,
    );
  }, [clearTarget, navigation, postId, setRunning, setTarget]);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
    </View>
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
