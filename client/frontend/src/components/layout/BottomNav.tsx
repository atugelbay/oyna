'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Wallet, Gamepad2, Tag } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/home', icon: Home, label: 'Главная' },
  { href: '/balance', icon: Wallet, label: 'Баланс' },
  { href: '/sessions', icon: Gamepad2, label: 'Игры' },
  { href: '/promos', icon: Tag, label: 'Акции' },
  { href: '/profile', icon: User, label: 'Профиль' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-surface-card/95 backdrop-blur-md border-t border-white/5 z-50">
      <div className="flex items-center justify-around px-2 py-2 pb-safe">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-0 ${
                active ? 'text-brand drop-shadow-[0_0_8px_rgba(0,208,255,0.6)]' : 'text-gray-600'
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
