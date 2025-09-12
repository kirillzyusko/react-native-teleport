function BlurView({ style, ...props }) {
  return (
    <div
      style={{
        position: "absolute",
        top: "0px",
        bottom: "0px",
        left: "0px",
        right: "0px",
        backdropFilter: `blur(${Math.random() * 16}px)`,
      }}
      {...props}
    />
  );
}

export default BlurView;
