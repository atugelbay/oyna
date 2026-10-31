"use client";

import { SectionSwitch } from "@/components/crm/SectionSwitch";

const ITEMS = [
  { href: "/live", label: "Сейчас в зале" },
  { href: "/rooms", label: "Комнаты" },
  { href: "/sessions-log", label: "Сеансы" },
  { href: "/bookings", label: "Брони" },
];

export default function HallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <SectionSwitch label="Зал" items={ITEMS} />
      {children}
    </div>
  );
}
