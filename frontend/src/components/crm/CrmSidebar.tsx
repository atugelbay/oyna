"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Главная", icon: "/icons/navbar/home.png" },
  { href: "/players", label: "Игроки", icon: "/icons/navbar/players.png" },
  { href: "/rooms", label: "Игровые комнаты", icon: "/icons/navbar/rooms.png" },
  { href: "/results", label: "Результаты игроков", icon: "/icons/navbar/results.png" },
  { href: "/tournaments", label: "Турниры", icon: "/icons/navbar/tournaments.png" },
  { href: "/promos", label: "Акции", icon: "/icons/navbar/stats.png" },
  { href: "/stats", label: "Статистика", icon: "/icons/navbar/promos.png" },
];

/** Навигация на том же градиентном фоне, что и шапка (без отдельной «плашки») */
export function CrmSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-24 shrink-0 flex-col bg-transparent py-2 sm:w-28">
      <nav className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`
                group relative flex shrink-0 flex-col items-center gap-1 rounded-lg py-1.5 transition-colors
                ${isActive ? "text-text-secondary" : "text-text-secondary hover:bg-white/5 hover:text-white"}
              `}
            >
              <span
                className={`
                  flex shrink-0 items-center justify-center
                  ${isActive ? "h-[31px] w-[53px] rounded-[21px] bg-white/90" : "h-10 w-10 rounded-2xl"}
                `}
              >
                <Image
                  src={icon}
                  alt={label}
                  width={26}
                  height={26}
                  className={`h-fit w-fit shrink-0 ${isActive ? "opacity-100 brightness-0" : "opacity-70 group-hover:opacity-100"}`}
                  unoptimized
                />
              </span>
              <span className="text-center text-xs font-medium leading-tight">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
