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
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow top-right */}
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(251,191,36,0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Ambient glow bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: -10,
            width: 110,
            height: 110,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* House body */}
        <div
          style={{
            position: "absolute",
            bottom: 34,
            left: 40,
            width: 100,
            height: 68,
            background: "white",
            borderRadius: "4px 4px 6px 6px",
            display: "flex",
          }}
        />

        {/* Roof left side */}
        <div
          style={{
            position: "absolute",
            bottom: 98,
            left: 28,
            width: 68,
            height: 8,
            background: "white",
            borderRadius: 4,
            transform: "rotate(-32deg)",
            transformOrigin: "right center",
            display: "flex",
          }}
        />

        {/* Roof right side */}
        <div
          style={{
            position: "absolute",
            bottom: 98,
            right: 28,
            width: 68,
            height: 8,
            background: "white",
            borderRadius: 4,
            transform: "rotate(32deg)",
            transformOrigin: "left center",
            display: "flex",
          }}
        />

        {/* Roof peak dot */}
        <div
          style={{
            position: "absolute",
            top: 31,
            left: 86,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "white",
            display: "flex",
          }}
        />

        {/* Door */}
        <div
          style={{
            position: "absolute",
            bottom: 34,
            left: 75,
            width: 30,
            height: 38,
            background: "linear-gradient(180deg, #3730a3, #1e1b4b)",
            borderRadius: "14px 14px 0 0",
            display: "flex",
          }}
        />

        {/* Window left */}
        <div
          style={{
            position: "absolute",
            bottom: 74,
            left: 48,
            width: 20,
            height: 18,
            background: "linear-gradient(135deg, #a5b4fc, #818cf8)",
            borderRadius: 3,
            display: "flex",
            boxShadow: "0 0 8px rgba(165,180,252,0.5)",
          }}
        />

        {/* Window right */}
        <div
          style={{
            position: "absolute",
            bottom: 74,
            right: 48,
            width: 20,
            height: 18,
            background: "linear-gradient(135deg, #a5b4fc, #818cf8)",
            borderRadius: 3,
            display: "flex",
            boxShadow: "0 0 8px rgba(165,180,252,0.5)",
          }}
        />

        {/* Gold coin badge */}
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 18,
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #fde68a 0%, #f59e0b 50%, #d97706 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(251,191,36,0.6), 0 0 0 3px rgba(251,191,36,0.2)",
          }}
        >
          <div
            style={{
              color: "#7c2d12",
              fontSize: 22,
              fontWeight: "900",
              display: "flex",
              fontFamily: "serif",
              marginTop: -1,
            }}
          >
            $
          </div>
        </div>

        {/* Subtle bottom bar accent */}
        <div
          style={{
            position: "absolute",
            bottom: 14,
            left: 50,
            right: 50,
            height: 3,
            borderRadius: 2,
            background: "linear-gradient(90deg, transparent, rgba(165,180,252,0.6), transparent)",
            display: "flex",
          }}
        />
      </div>
    ),
    { width: 180, height: 180 }
  );
}
