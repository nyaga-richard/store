import type { Metadata, Viewport } from "next";
import "./globals.css";
import { requestOrigin } from "@/lib/proxy";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await requestOrigin()),
    title: { default: "Trusted Systems Store — Tech & Home in Kenya", template: "%s | Trusted Systems Store" },
    description: "Shop headphones, smartwatches, keyboards, home and lifestyle products with secure checkout and fast delivery across Kenya.",
    openGraph: { type: "website", siteName: "Trusted Systems Store" },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#166534" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
