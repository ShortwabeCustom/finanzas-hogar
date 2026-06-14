"use client";

import { Toaster } from "react-hot-toast";

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          borderRadius: "10px",
          fontSize: "14px",
          maxWidth: "380px",
        },
        success: {
          style: { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" },
          iconTheme: { primary: "#16a34a", secondary: "#fff" },
        },
        error: {
          style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
          iconTheme: { primary: "#dc2626", secondary: "#fff" },
        },
      }}
    />
  );
}
