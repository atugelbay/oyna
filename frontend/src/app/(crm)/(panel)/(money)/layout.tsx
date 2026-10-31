"use client";

import { SectionSwitch } from "@/components/crm/SectionSwitch";

const ITEMS = [
  { href: "/cash", label: "Касса" },
  { href: "/payments", label: "Оплаты" },
  { href: "/finance", label: "Финансы" },
  { href: "/stats", label: "Статистика" },
  { href: "/certificates", label: "Сертификаты" },
];

export default function MoneyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionSwitch label="Касса" items={ITEMS} />
      {children}
    </div>
  );
}
