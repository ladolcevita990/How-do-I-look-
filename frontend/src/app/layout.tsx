import type { Metadata } from "next";
import SessionProvider from "@/components/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "How Do I Look? — Virtual Try-On",
  description:
    "See how any clothing looks on you before you buy. Upload your photo, pick items from any brand, and build head-to-toe outfits.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-neutral-50 text-neutral-900">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
