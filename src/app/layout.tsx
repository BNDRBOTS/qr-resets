import type { Metadata } from "next";
import "./globals.css";
import "./light-mode-surfaces.css";
import "./header-color-normalization.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "BNDR LLC — ResourceCite + QR Resets",
  description:
    "ResourceCite by BNDR LLC, plus a prototype preview of QR Resets.",
  keywords: [
    "BNDR",
    "ResourceCite",
    "victim advocacy",
    "family court",
    "legal aid",
    "crime victim rights",
  ],
  authors: [{ name: "BNDR LLC" }],
  icons: {
    icon: [
      { url: "/bndr-logo.png", type: "image/png", sizes: "1024x1024" },
      { url: "/favicon.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: "/bndr-logo.png", sizes: "1024x1024" }],
    shortcut: ["/bndr-logo.png"],
  },
  openGraph: {
    title: "BNDR LLC — ResourceCite + QR Resets",
    description:
      "Find legal, advocacy, housing, medical, and practical support resources in one place.",
    siteName: "BNDR LLC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BNDR LLC — ResourceCite + QR Resets",
    description:
      "Find legal, advocacy, housing, medical, and practical support resources in one place.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
