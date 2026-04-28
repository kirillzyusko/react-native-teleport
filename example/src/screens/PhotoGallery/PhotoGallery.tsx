import { FlatList, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import PHOTOS, { type Photo } from "./photos";
import PhotoPreview from "./PhotoPreview";
import { ScreenNames } from "../../constants/screenNames";
import type { ExamplesStackParamList } from "../../navigation/ExamplesStack";

function PhotoGallery() {
  const navigation =
    useNavigation<NativeStackNavigationProp<ExamplesStackParamList>>();

  const onPhotoOpen = (photo: Photo) => {
    navigation.navigate(ScreenNames.PHOTO_DETAIL, { photo });
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={PHOTOS}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <PhotoPreview photo={item} onOpen={onPhotoOpen} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});

export default PhotoGallery;
