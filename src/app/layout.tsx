import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real-Time Quiz App",
  description: "A synchronized quiz answering clicker app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
