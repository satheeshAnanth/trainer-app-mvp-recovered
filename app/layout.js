import "./globals.css";
import { Inter } from "next/font/google";
import BackButtonGuard from "app/_components/BackButtonGuard";
import CapacitorInit from "app/_components/CapacitorInit";
import OfflineBanner from "app/_components/OfflineBanner";
import PushNotificationInit from "app/_components/PushNotificationInit";
import { ToastProvider } from "app/_components/ToastProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Trainer App - Session Capture & Client Management",
  description: "Session capture and client management for fitness trainers",
  manifest: "/manifest.json",
  themeColor: "#2dd4bf",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trainer App",
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
