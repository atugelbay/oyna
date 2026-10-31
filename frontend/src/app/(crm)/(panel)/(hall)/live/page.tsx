"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";

export default function LivePage() {
  const { selectedVenueId } = useCrmVenue();
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    let stop = false;
    async function tick() {
      const { data } = await api.get("/live", { params: { venueId: selectedVenueId || undefined } });
      if (!stop) setRooms(data);
    }
    tick().catch(() => {});
    const id = setInterval(() => tick().catch(() => {}), 12000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [selectedVenueId]);

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Сейчас в зале</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {rooms.map((room) => (
          <article key={room.roomId} className={`rounded-xl p-4 ${room.offline ? "bg-red-950" : "bg-bg-secondary"}`}>
            <h2 className="text-lg font-bold">{room.name}</h2>
            <p className="text-sm">{room.offline ? "Нет связи" : room.busy ? `Идёт игра · ${room.mode}` : "Свободна"}</p>
            <p className="text-sm text-text-secondary">{room.players?.join(", ")}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
