'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Wallet, Gamepad2, Trophy, UserRound } from 'lucide-react';
const items = [
  { href: '/home', icon: House, label: 'Главная' },
  { href: '/balance', icon: Wallet, label: 'Баланс' },
  { href: '/sessions', icon: Gamepad2, label: 'Игры' },
  { href: '/leaderboard', icon: Trophy, label: 'Рейтинг' },
  { href: '/profile', icon: UserRound, label: 'Профиль' },
];
export function BottomNav() {
  const pathname = usePathname();
  return <nav aria-label="Основная навигация" className="bottom-nav fixed bottom-0 left-1/2 z-50 w-full max-w-mobile -translate-x-1/2 border-t border-white/10 bg-[#0e1721]/95 px-2 pt-2 backdrop-blur-xl">
    <div className="flex justify-around">{items.map(({ href, icon: Icon, label }) => {
      const active = pathname.startsWith(href);
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium transition-colors ${active ? 'bg-brand/10 text-brand' : 'text-slate-400 hover:text-white'}`}><Icon size={21} strokeWidth={active ? 2.3 : 1.7} />{label}</Link>;
    })}</div>
  </nav>;
}
