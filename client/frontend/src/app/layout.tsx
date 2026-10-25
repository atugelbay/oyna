import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'OYNA — Личный кабинет',
  description: 'Ваш личный кабинет в игровом центре OYNA',
  manifest: '/manifest.json',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#090D17',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>
          <div className="flex justify-center">
            <div className="app-shell w-full max-w-mobile relative">
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
