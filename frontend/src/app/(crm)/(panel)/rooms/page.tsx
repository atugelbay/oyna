"use client";

import { useState, useEffect, useRef } from "react";
import { AddRoomModal } from "@/components/crm/AddRoomModal";
import { readApiUserError } from "@/lib/api-error-message";
import { roomsService } from "@/services/rooms.service";
import { useCrmVenue } from "@/lib/venue-context";
import { uniqueSessionsFromModes, formatSessionsOneLine } from "@/lib/room-sessions";
import { useConfirmDelete } from "@/components/ui/ConfirmDeleteModal";

type GameModeRow = {
  id: string;
  name: string;
  type?: string;
  config?: unknown | null;
};

type RoomRow = {
  id: string;
  name: string;
  maxPlayers?: number;
  defaultLevelDuration?: number;
  modes?: GameModeRow[];
  status?: "free" | "occupied" | "waiting";
};

export default function RoomsPage() {
  const { selectedVenueId, loading: venuesLoading } = useCrmVenue();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();

  useEffect(() => {
    if (!menuOpenId) return;
    function handleDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [menuOpenId]);

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

  function openAdd() {
    setEditingRoom(null);
    setFormOpen(true);
  }

  function openEdit(room: RoomRow) {
    setEditingRoom(room);
    setFormOpen(true);
    setMenuOpenId(null);
  }

  async function requestDeleteRoom(room: RoomRow) {
    const ok = await confirmDelete({
      title: "Удалить комнату?",
      message: `Комната «${room.name}» и связанные режимы будут удалены. Это действие нельзя отменить.`,
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    setError(null);
    try {
      await roomsService.remove(room.id);
      setMenuOpenId(null);
      refreshRooms();
    } catch (err: unknown) {
      setError(readApiUserError(err, "Не удалось удалить комнату"));
    }
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Игровые комнаты</h1>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!selectedVenueId ? (
        <div className="rounded-xl bg-bg-secondary py-12 text-center text-text-muted">
          Выберите площадку в шапке CRM
        </div>
      ) : (
        <div className="rounded-xl border border-surface-border bg-[#19232E] overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-text-secondary">
                <th className="py-3 px-4 font-medium w-[22%]">Название комнаты</th>
                <th className="py-3 px-4 font-medium min-w-0">Сессии</th>
                <th className="py-3 px-4 font-medium whitespace-nowrap w-[7rem]">Статус</th>
                <th className="py-3 px-4 w-14 font-medium text-right" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {rooms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-text-muted">
                    Нет комнат — нажмите «Добавить»
                  </td>
                </tr>
              ) : (
                rooms.map((room) => {
                  const lines = uniqueSessionsFromModes(room.modes);
                  const sessionsText = formatSessionsOneLine(lines);
                  const busy = room.status === "occupied" || room.status === "waiting";
                  return (
                    <tr
                      key={room.id}
                      className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-text-primary align-middle">{room.name}</td>
                      <td className="py-3 px-4 text-text-primary align-middle">
                        {!sessionsText ? (
                          <span className="text-text-muted">—</span>
                        ) : (
                          <p
                            className="text-sm text-text-primary whitespace-nowrap"
                            title={sessionsText}
                          >
                            {sessionsText}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle whitespace-nowrap">
                        {busy ? (
                          <span className="text-danger font-medium">Занято</span>
                        ) : (
                          <span className="text-success font-medium">Свободно</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle text-right">
                        <div className="relative inline-flex justify-end" ref={menuOpenId === room.id ? menuRef : undefined}>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted hover:bg-white/5 hover:text-text-primary"
                            aria-expanded={menuOpenId === room.id}
                            aria-label="Действия"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId((id) => (id === room.id ? null : room.id));
                            }}
                          >
                            <MoreVerticalIcon />
                          </button>
                          {menuOpenId === room.id ? (
                            <div
                              className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] rounded-xl border border-surface-border bg-[#1F2B38] py-1 shadow-xl"
                              role="menu"
                            >
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-4 py-2.5 text-left text-sm text-text-primary hover:bg-white/5"
                                onClick={() => openEdit(room)}
                              >
                                Редактировать
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-white/5"
                                onClick={() => void requestDeleteRoom(room)}
                              >
                                Удалить
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (!selectedVenueId) {
            setError("Нет доступных площадок для создания комнаты");
            return;
          }
          openAdd();
        }}
        className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan text-bg-primary font-semibold text-sm shadow-lg hover:brightness-110 transition-opacity"
      >
        <PlusIcon />
        Добавить
      </button>

      {selectedVenueId ? (
        <AddRoomModal
          isOpen={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingRoom(null);
          }}
          venueId={selectedVenueId}
          defaultType="grid"
          editRoom={
            editingRoom
              ? {
                  id: editingRoom.id,
                  name: editingRoom.name,
                  modes: editingRoom.modes ?? [],
                }
              : null
          }
          onAdded={refreshRooms}
        />
      ) : null}
      {deleteDialog}
    </div>
  );
}

function MoreVerticalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
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
