import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 2,
          padding: 3,
          borderRadius: 6,
          background: "linear-gradient(135deg, #10b981, #059669)",
        }}
      >
        {/* Bar chart bars — representing KPI dashboard */}
        <div
          style={{
            width: 5,
            height: 10,
            borderRadius: 1,
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <div
          style={{
            width: 5,
            height: 17,
            borderRadius: 1,
            background: "rgba(255,255,255,0.85)",
          }}
        />
        <div
          style={{
            width: 5,
            height: 13,
            borderRadius: 1,
            background: "rgba(255,255,255,0.7)",
          }}
        />
        <div
          style={{
            width: 5,
            height: 22,
            borderRadius: 1,
            background: "white",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
