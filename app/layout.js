import "./globals.css";
import { Inter } from "next/font/google";
import CapacitorInit from "app/_components/CapacitorInit";

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
    maximumScale: 1,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`app-body ${inter.className}`}>
        {children}
        <CapacitorInit />
      </body>
    </html>
  );
}
