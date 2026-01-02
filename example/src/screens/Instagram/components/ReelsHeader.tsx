import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { FontAwesome6 } from "@react-native-vector-icons/fontawesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTransition } from "../hooks/useTransition";

function ReelsHeader() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { goToFeed, progress, y } = useTransition();

  const onGoBack = () => {
    goToFeed(navigation.goBack);
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        paddingTop: insets.top,
        width: "100%",
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [y, 0],
            }),
          },
        ],
      }}
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
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
