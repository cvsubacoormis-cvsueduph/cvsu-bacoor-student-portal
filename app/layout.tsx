import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Cavite State University Bacoor City Campus Student Portal ",
  description: "Cavite State University Bacoor City Campus Student Portal",
};

import { Toaster } from "react-hot-toast";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import ConnectivityIndicator from "@/components/ConnectivityIndicator";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <Script
        async
        src="https://analytics.cvsu-bacoor.com/script.js"
        data-website-id="8316ee4b-feeb-4942-ac08-ebb67c27baea"
      />
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          {children}
          <Toaster position="top-right" />
          <ConnectivityIndicator />
        </body>
      </html>
    </ClerkProvider>
  );
}
