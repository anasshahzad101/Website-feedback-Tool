import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { getPublicBranding } from "@/lib/app-settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const b = await getPublicBranding();
  return {
    title: b.appName,
    description: `Review and collect website feedback with ${b.brandName}.`,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialBranding = await getPublicBranding();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers initialBranding={initialBranding}>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
