import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Trainer App - Session Capture & Client Management",
  description: "Recovered baseline from Vercel deployment metadata",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`app-body ${inter.className}`}>{children}</body>
    </html>
  );
}
