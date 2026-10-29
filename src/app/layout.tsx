import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is metrically compatible with SF Pro Text — Apple devices render SF,
// everything else gets a visually indistinguishable substitute.
const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ledger — Accounting & Finance",
  description:
    "Internal accounting & finance portal: transactions, invoices, expenses, approvals, reports and role-based access — Red, Admin, Manager, Employee.",
  robots: { index: false, follow: false }, // internal system: keep it out of search
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
