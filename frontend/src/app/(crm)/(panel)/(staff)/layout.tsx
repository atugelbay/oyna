"use client";

import { SectionSwitch } from "@/components/crm/SectionSwitch";

const ITEMS = [
  { href: "/team", label: "Смена сегодня" },
  { href: "/schedule", label: "График" },
  { href: "/operators", label: "Операторы" },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionSwitch label="Команда" items={ITEMS} />
      {children}
    </div>
  );
}
