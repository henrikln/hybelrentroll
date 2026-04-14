import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 10,
          padding: 24,
          borderRadius: 36,
          background: "linear-gradient(135deg, #10b981, #059669)",
        }}
      >
        {/* Bar chart bars */}
        <div
          style={{
            width: 26,
            height: 50,
            borderRadius: 5,
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <div
          style={{
            width: 26,
            height: 90,
            borderRadius: 5,
            background: "rgba(255,255,255,0.85)",
          }}
        />
        <div
          style={{
            width: 26,
            height: 65,
            borderRadius: 5,
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <div
          style={{
            width: 26,
            height: 115,
            borderRadius: 5,
            background: "white",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
