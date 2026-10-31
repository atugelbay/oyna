"use client";

import { SectionSwitch } from "@/components/crm/SectionSwitch";

const ITEMS = [
  { href: "/schedule", label: "График" },
  { href: "/operators", label: "Операторы" },
  { href: "/sources", label: "Источники" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionSwitch label="Команда" items={ITEMS} />
      {children}
    </div>
  );
}
