"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SectionSwitch({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label={label}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active ? "bg-cyan/20 text-cyan" : "bg-bg-card text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
