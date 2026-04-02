"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { AddRoomModal } from "@/components/crm/AddRoomModal";
import { readApiUserError } from "@/lib/api-error-message";
import { roomsService } from "@/services/rooms.service";
import { useCrmVenue } from "@/lib/venue-context";

type RoomRow = {
  id: string;
  name: string;
  maxPlayers?: number;
  defaultLevelDuration?: number;
  status: "free" | "occupied" | "waiting";
  playerId?: string;
  playerNickname?: string;
};

export default function RoomsPage() {
  const { selectedVenueId, loading: venuesLoading } = useCrmVenue();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (venuesLoading) return;

    let cancelled = false;
    async function fetchRooms() {
      setError(null);
      if (!selectedVenueId) {
        setRooms([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await roomsService.listByVenue(selectedVenueId);
        if (!cancelled) setRooms(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(readApiUserError(err, "Не удалось загрузить комнаты"));
          setRooms([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchRooms();
    return () => {
      cancelled = true;
    };
  }, [selectedVenueId, refreshTick, venuesLoading]);

  function refreshRooms() {
    setRefreshTick((t) => t + 1);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Игровые комнаты</h1>
        <div className="rounded-xl bg-bg-secondary overflow-hidden py-12 text-center text-text-muted">
          Загрузка...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Игровые комнаты</h1>
        <div className="rounded-xl bg-bg-secondary overflow-hidden py-12 text-center text-danger">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Игровые комнаты</h1>
      </div>

      <div className="rounded-xl bg-bg-secondary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-text-secondary">
              <th className="py-3 px-4 font-medium">Товар</th>
              <th className="py-3 px-4 font-medium">Игроков в сессии</th>
              <th className="py-3 px-4 font-medium">Длительность уровня</th>
              <th className="py-3 px-4 font-medium">Статус</th>
              <th className="py-3 px-4 font-medium">Игрок / Команда в комнате</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr
                key={room.id}
                className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/50 transition-colors"
              >
                <td className="py-3 px-4 font-medium text-text-primary">{room.name}</td>
                <td className="py-3 px-4 text-text-primary">{room.maxPlayers ?? "—"}</td>
                <td className="py-3 px-4 text-text-primary">
                  {room.defaultLevelDuration ? `${room.defaultLevelDuration} сек` : "—"}
                </td>
                <td className="py-3 px-4">
                  {room.status === "occupied" || room.status === "waiting" ? (
                    <span className="text-danger font-medium">Занято</span>
                  ) : (
                    <span className="text-success font-medium">Свободно</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {(room.status === "occupied" || room.status === "waiting") && room.playerNickname ? (
                    <div className="flex items-center gap-2">
                      <Avatar letter={room.playerNickname[0]?.toUpperCase()} size={28} />
                      <span className="text-text-primary">{room.playerNickname}</span>
                      <Link
                        href={
                          room.playerId
                            ? `/players?player=${encodeURIComponent(room.playerId)}`
                            : "/players"
                        }
                        className="text-cyan hover:underline text-sm font-medium"
                      >
                        Профиль
                      </Link>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-text-muted">Пусто</span>
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full bg-cyan/20 text-cyan flex items-center justify-center hover:bg-cyan/30 transition-colors"
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        className="text-cyan hover:underline text-sm font-medium"
                      >
                        Запустить
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!selectedVenueId) {
            setError("Нет доступных площадок для создания комнаты");
            return;
          }
          setAddModalOpen(true);
        }}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon />
        Добавить
      </button>

      {selectedVenueId ? (
        <AddRoomModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          venueId={selectedVenueId}
          defaultType="grid"
          onAdded={refreshRooms}
        />
      ) : null}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
