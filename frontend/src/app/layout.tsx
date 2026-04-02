import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import "./globals.css";

const ubuntu = Ubuntu({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-ubuntu",
});

export const metadata: Metadata = {
  title: "OYNA",
  description: "OYNA Gaming Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className={ubuntu.variable}>
      <body className={ubuntu.className}>
        <AppThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
