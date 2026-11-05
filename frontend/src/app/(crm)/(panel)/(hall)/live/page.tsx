"use client";

import { useCallback, useEffect, useState } from "react";
import { useCrmVenue } from "@/lib/venue-context";
import { RoomControlList } from "@/components/crm/RoomControlList";

export default function LivePage() {
  const { selectedVenueId } = useCrmVenue();
  const [launchRoomId, setLaunchRoomId] = useState<string | null>(null);

  // Переход с главной: /live?launch=<roomId> сразу открывает запуск комнаты
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("launch");
    if (id) setLaunchRoomId(id);
  }, []);

  const onLaunchHandled = useCallback(() => {
    setLaunchRoomId(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has("launch")) {
      url.searchParams.delete("launch");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <div className="space-y-3 text-text-primary">
      <h1 className="text-2xl font-bold">Сейчас в зале</h1>
      <RoomControlList venueId={selectedVenueId} launchRoomId={launchRoomId} onLaunchHandled={onLaunchHandled} />
    </div>
  );
}
