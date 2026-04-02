"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/settings/roles", label: "Роли и доступы" },
  { href: "/settings/prices", label: "Цены" },
  { href: "/settings/loyalty", label: "Лояльность" },
  { href: "/settings/employees", label: "Сотрудники" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Настройки</h1>
      <nav className="flex flex-wrap gap-1 border-b border-surface-border">
        {TABS.map(({ href, label }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                isActive ? "text-cyan border-cyan" : "text-text-secondary hover:text-text-primary border-transparent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
