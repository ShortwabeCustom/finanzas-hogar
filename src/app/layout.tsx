import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import ToastProvider from "@/components/providers/ToastProvider";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finanzas del Hogar",
  description: "Control de finanzas personales y del hogar",
  appleWebApp: {
    capable: true,
    title: "Finanzas",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={ibmPlexSans.className}>
        <SessionProvider>{children}</SessionProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
