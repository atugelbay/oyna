import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'OYNA — Личный кабинет',
  description: 'Ваш личный кабинет в игровом центре OYNA',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#111827',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <div className="flex justify-center min-h-screen bg-surface">
            <div className="w-full max-w-mobile relative bg-surface min-h-screen">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
