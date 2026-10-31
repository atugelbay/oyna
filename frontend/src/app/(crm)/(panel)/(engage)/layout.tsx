"use client";

import { SectionSwitch } from "@/components/crm/SectionSwitch";

const ITEMS = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/promos", label: "Акции" },
  { href: "/results", label: "Рейтинг" },
];

export default function EngageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionSwitch label="События" items={ITEMS} />
      {children}
    </div>
  );
}
