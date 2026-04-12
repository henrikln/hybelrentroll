import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { nbNO } from "@clerk/localizations";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hybelrentroll",
  description: "Rent roll management for Norwegian property owners",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={nbNO}
      appearance={{
        variables: {
          colorPrimary: "#7c3aed",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html lang="no" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
