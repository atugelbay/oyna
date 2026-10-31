"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export function UpcomingBookings() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api.get("/bookings/upcoming", { params: { venueId: selectedVenueId || undefined } })
      .then(({ data }) => setRows(Array.isArray(data) ? data.slice(0, 3) : []))
      .catch(() => setRows([]));
  }, [selectedVenueId]);

  if (!rows.length) return null;

  return (
    <section className="rounded-2xl bg-[#19232E] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary">Ближайшие брони</h2>
        <Link href="/bookings" className="text-xs text-cyan">Все</Link>
      </div>
      {rows.map((row) => (
        <p key={row.id} className="text-sm text-white">
          {new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          {" · "}{row.contactName} · {row.type === "BIRTHDAY" ? "день рождения" : "тимбилдинг"} · {row.people} чел.
        </p>
      ))}
    </section>
  );
}
