import "./globals.css";
import { Inter } from "next/font/google";
import BackButtonGuard from "app/_components/BackButtonGuard";
import CapacitorInit from "app/_components/CapacitorInit";
import OfflineBanner from "app/_components/OfflineBanner";
import PushNotificationInit from "app/_components/PushNotificationInit";
import { ToastProvider } from "app/_components/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Cadence - Session Capture & Client Management",
  description: "Session capture and client management for fitness trainers",
  manifest: "/manifest.json",
  themeColor: "#2dd4bf",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Cadence",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`app-body ${inter.className}`}>
        <ToastProvider>
          <OfflineBanner />
          {children}
          <BackButtonGuard />
          <CapacitorInit />
          <PushNotificationInit />
        </ToastProvider>
      </body>
    </html>
  );
}
