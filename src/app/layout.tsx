import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "BNDR. — Resource Directory + QR Resets",
  description:
    "BNDR Resource Directory and QR Resets: searchable resources plus dignity-first direct-aid planning and requests.",
  keywords: [
    "BNDR",
    "resource directory",
    "victim advocacy",
    "family court",
    "legal aid",
    "crime victim rights",
  ],
  authors: [{ name: "BNDR." }],
  icons: {
    icon: [
      { url: "/bndr-logo.png", type: "image/png", sizes: "1024x1024" },
      { url: "/favicon.png", type: "image/png", sizes: "1024x1024" },
    ],
    apple: [{ url: "/bndr-logo.png", sizes: "1024x1024" }],
    shortcut: ["/bndr-logo.png"],
  },
  openGraph: {
    title: "BNDR. — Resource Directory + QR Resets",
    description:
      "A source-backed directory of victim, advocacy & family-court resources.",
    siteName: "BNDR.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BNDR. — Resource Directory + QR Resets",
    description:
      "A source-backed directory of victim, advocacy & family-court resources.",
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
