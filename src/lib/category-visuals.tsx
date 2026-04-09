import type { CSSProperties } from "react";

export const CATEGORY_PRESET_COLORS = [
  "#5E35B1", // Deep Purple 600
  "#3949AB", // Indigo 600
  "#1E88E5", // Blue 600
  "#00897B", // Teal 600
  "#43A047", // Green 600
  "#7CB342", // Light Green 600
  "#FB8C00", // Orange 600
  "#F4511E", // Deep Orange 600
  "#E53935", // Red 600
  "#D81B60", // Pink 600
  "#8E24AA", // Purple 600
  "#546E7A", // Blue Grey 600
];

export const CATEGORY_ICON_LIBRARY = [
  { id: "savings", label: "Ahorro" },
  { id: "food", label: "Comida" },
  { id: "education", label: "Educación" },
  { id: "entertainment", label: "Entretenimiento" },
  { id: "home", label: "Hogar" },
  { id: "income", label: "Ingresos" },
  { id: "debt", label: "Deudas" },
  { id: "health", label: "Salud" },
  { id: "services", label: "Servicios" },
  { id: "transport", label: "Transporte" },
  { id: "shopping", label: "Compras" },
  { id: "subscription", label: "Suscripciones" },
  { id: "bank", label: "Bancario" },
  { id: "transfer", label: "Transferencias" },
  { id: "wallet", label: "Billetera" },
  { id: "other", label: "Otros" },
] as const;

export type CategoryIconId = (typeof CATEGORY_ICON_LIBRARY)[number]["id"];

function toHexChannel(v: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(v)));
  return clamped.toString(16).padStart(2, "0");
}

function normalizeHex(hex: string): string {
  const raw = (hex || "").trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) return raw.toUpperCase();
  return "#5E35B1";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = normalizeHex(hex).replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function blend(hexA: string, hexB: string, ratioFromA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = a.r * ratioFromA + b.r * (1 - ratioFromA);
  const g = a.g * ratioFromA + b.g * (1 - ratioFromA);
  const bCh = a.b * ratioFromA + b.b * (1 - ratioFromA);
  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(bCh)}`;
}

function srgbToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(hexA: string, hexB: string): number {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);
  return (max + 0.05) / (min + 0.05);
}

export function getCategoryIconTheme(color: string): { containerStyle: CSSProperties; iconStyle: CSSProperties } {
  const base = normalizeHex(color);
  const container = blend(base, "#FFFFFF", 0.16);
  const stronger = blend(base, "#111827", 0.62);
  const iconColor = contrastRatio(stronger, container) >= 4.5 ? stronger : "#1F2937";

  return {
    containerStyle: {
      backgroundColor: container,
      borderLeft: `4px solid ${base}`,
    },
    iconStyle: { color: iconColor },
  };
}

export function inferCategoryIconId(name: string): CategoryIconId {
  const n = String(name || "").toLowerCase();
  if (n.includes("ahorro") || n.includes("invers")) return "savings";
  if (n.includes("aliment") || n.includes("despensa") || n.includes("comida") || n.includes("restaurante")) return "food";
  if (n.includes("educ")) return "education";
  if (n.includes("entreten")) return "entertainment";
  if (n.includes("hogar")) return "home";
  if (n.includes("ingres")) return "income";
  if (n.includes("deuda")) return "debt";
  if (n.includes("salud") || n.includes("farmacia")) return "health";
  if (n.includes("servicio") || n.includes("internet") || n.includes("luz") || n.includes("agua")) return "services";
  if (n.includes("transporte") || n.includes("gasolina")) return "transport";
  if (n.includes("ropa") || n.includes("tienda") || n.includes("supermerc")) return "shopping";
  if (n.includes("suscrip")) return "subscription";
  if (n.includes("comision") || n.includes("retiro")) return "bank";
  if (n.includes("transfer") || n.includes("depósito") || n.includes("deposito") || n.includes("abono")) return "transfer";
  return "other";
}

export function resolveCategoryIconId(icon: string | null | undefined, name: string): CategoryIconId {
  const explicit = String(icon || "").trim() as CategoryIconId;
  const valid = CATEGORY_ICON_LIBRARY.some((item) => item.id === explicit);
  if (valid) return explicit;
  return inferCategoryIconId(name);
}

export function CategoryGlyph({ iconId, className = "w-5 h-5" }: { iconId: CategoryIconId; className?: string }) {
  if (iconId === "savings") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.12-4 2.5s1.79 2.5 4 2.5 4 1.12 4 2.5-1.79 2.5-4 2.5m0-10V6m0 12v-2m9-4a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (iconId === "food") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3v7M5 3v7M9 3v7M5 10h4M7 10v11M15 3c1.657 0 3 1.343 3 3v4h-6V6c0-1.657 1.343-3 3-3zM15 10v11" />
      </svg>
    );
  }
  if (iconId === "education") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l7-3.889V16L12 20l-7-4v-5.889L12 14z" />
      </svg>
    );
  }
  if (iconId === "entertainment") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-4.586-2.65A1 1 0 008.667 9.4v5.2a1 1 0 001.499.868l4.586-2.65a1 1 0 000-1.732z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  if (iconId === "home") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11l9-7 9 7M5 10v10h14V10" />
      </svg>
    );
  }
  if (iconId === "income") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7m0 0H9m8 0v8" />
      </svg>
    );
  }
  if (iconId === "debt") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636L5.636 18.364M5.636 5.636l12.728 12.728" />
      </svg>
    );
  }
  if (iconId === "health") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s-7-4.35-7-10a4 4 0 017-2.646A4 4 0 0119 11c0 5.65-7 10-7 10z" />
      </svg>
    );
  }
  if (iconId === "services") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9a4 4 0 015.656 0M6.343 6.172a8 8 0 0111.314 0M3.515 3.343a12 12 0 0116.97 0M12 20h.01" />
      </svg>
    );
  }
  if (iconId === "transport") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l2-6h14l2 6M5 13h14v5H5zM7 18h.01M17 18h.01" />
      </svg>
    );
  }
  if (iconId === "shopping") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 6l1 13h8l1-13M9 6V4a3 3 0 016 0v2" />
      </svg>
    );
  }
  if (iconId === "subscription") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16v10H4zM9 7V5h6v2" />
      </svg>
    );
  }
  if (iconId === "bank") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9-6 9 6M5 10v8m4-8v8m4-8v8m4-8v8M3 18h18" />
      </svg>
    );
  }
  if (iconId === "transfer") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 7l3-3M7 7l3 3M17 17H7m10 0l-3-3m3 3l-3 3" />
      </svg>
    );
  }
  if (iconId === "wallet") {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18v10H3zM16 12h5M3 9l14-4v2" />
      </svg>
    );
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2m10-10h-2M4 12H2m16.95 6.95l-1.414-1.414M6.464 6.464L5.05 5.05m13.9 0l-1.414 1.414M6.464 17.536L5.05 18.95" />
    </svg>
  );
}
