"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCrmSidebarLayout } from "@/lib/crm-sidebar-layout-context";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Главная", icon: "/icons/navbar/home.png", match: ["/dashboard"] },
  { href: "/players", label: "Игроки", icon: "/icons/navbar/players.png", match: ["/players"] },
  {
    href: "/live",
    label: "Зал",
    icon: "/icons/navbar/rooms.png",
    match: ["/live", "/rooms", "/sessions-log", "/bookings"],
  },
  {
    href: "/cash",
    label: "Касса",
    icon: "/icons/navbar/stats.png",
    match: ["/cash", "/payments", "/finance", "/stats", "/certificates"],
  },
  {
    href: "/tournaments",
    label: "События",
    icon: "/icons/navbar/tournaments.png",
    match: ["/tournaments", "/promos", "/results"],
  },
  {
    href: "/schedule",
    label: "Команда",
    icon: "/icons/navbar/players.png",
    match: ["/schedule", "/operators", "/sources"],
  },
];

function isNavActive(pathname: string, match: string[]) {
  return match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Навигация на том же градиентном фоне, что и шапка (без отдельной «плашки») */
export function CrmSidebar() {
  const pathname = usePathname();
  const { collapsed, railWidthClass } = useCrmSidebarLayout();

  return (
    <aside
      className={`hidden shrink-0 flex-col bg-transparent py-2 transition-[width] duration-200 ease-out md:flex ${railWidthClass}`}
    >
      <nav
        id="crm-sidebar-nav"
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${collapsed ? "items-center gap-1 px-1" : "gap-2 px-2"}`}
      >
        {NAV_ITEMS.map(({ href, label, icon, match }) => {
          const isActive = isNavActive(pathname, match);
          const iconWrap = collapsed
            ? isActive
              ? "h-10 w-10 rounded-2xl bg-white/90"
              : "h-10 w-10 rounded-2xl"
            : isActive
              ? "h-[31px] w-[53px] rounded-[21px] bg-white/90"
              : "h-10 w-10 rounded-2xl";

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={collapsed ? label : undefined}
              className={`
                group relative flex shrink-0 flex-col items-center rounded-lg transition-colors
                ${collapsed ? "gap-0 py-1" : "gap-1 py-1.5"}
                ${isActive ? "text-text-secondary" : "text-text-secondary hover:bg-white/5 hover:text-white"}
              `}
            >
              <span className={`flex shrink-0 items-center justify-center ${iconWrap}`}>
                <Image
                  src={icon}
                  alt=""
                  width={26}
                  height={26}
                  className={`h-fit w-fit shrink-0 ${isActive ? "opacity-100 brightness-0" : "opacity-70 group-hover:opacity-100"}`}
                  unoptimized
                />
              </span>
              {!collapsed ? (
                <span className="text-center text-xs font-medium leading-tight">{label}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
