import { useEffect, useState } from "react";
import { Button, View } from "react-native";

function VideoPlayer() {
  useEffect(() => {
    console.log("VideoPlayer mounted");

    return () => {
      console.log("VideoPlayer unmounted");
    };
  }, []);

  return <></>;
}

export default function MoveElement() {
  const [idx, setIdx] = useState(0);
  const box = <VideoPlayer key="stable-video" />;

  return (
    <View>
      <Button title="next" onPress={() => setIdx(idx + 1)} />
      {idx % 2 === 0 ? box : null}
      <View>{idx % 2 !== 0 ? box : null}</View>
    </View>
  );
}
