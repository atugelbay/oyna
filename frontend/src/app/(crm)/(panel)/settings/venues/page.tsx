"use client";

import { useEffect, useState } from "react";
import { VenueFormModal, type VenueFormValues } from "@/components/crm/VenueFormModal";
import { useConfirmDelete } from "@/components/ui/ConfirmDeleteModal";
import { readApiUserError } from "@/lib/api-error-message";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";
import { venuesService } from "@/services/venues.service";

type VenueRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  timezone?: string;
  status?: "OPEN" | "CLOSED" | "MAINTENANCE";
  _count?: { rooms: number };
};

function statusLabel(status?: string) {
  if (status === "CLOSED") return "Закрыта";
  if (status === "MAINTENANCE") return "Обслуживание";
  return "Открыта";
}

export default function SettingsVenuesPage() {
  const { user } = useAuth();
  const { refreshVenues, setSelectedVenueId } = useCrmVenue();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";

  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VenueFormValues | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirmDelete, dialog: deleteDialog } = useConfirmDelete();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    venuesService
      .list()
      .then((data: VenueRow[]) => {
        if (!cancelled) setVenues(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(readApiUserError(err, "Не удалось загрузить площадки"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  function refresh() {
    setRefreshTick((t) => t + 1);
  }

  async function handleDelete(v: VenueRow) {
    if (!isAdmin || deletingId) return;
    const ok = await confirmDelete({
      title: "Удалить площадку?",
      message: `Площадка «${v.name}» и связанные комнаты будут удалены. Это нельзя отменить.`,
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    setDeletingId(v.id);
    setOperationError(null);
    try {
      await venuesService.remove(v.id);
      await refreshVenues();
      refresh();
    } catch (err) {
      setOperationError(readApiUserError(err, "Не удалось удалить площадку"));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-text-muted">Загрузка…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {operationError ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {operationError}
        </p>
      ) : null}

      <div className="bg-bg-secondary rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-text-secondary">
              <th className="py-3 px-4 font-medium">Название</th>
              <th className="py-3 px-4 font-medium">Город</th>
              <th className="py-3 px-4 font-medium">Адрес</th>
              <th className="py-3 px-4 font-medium">Комнаты</th>
              <th className="py-3 px-4 font-medium">Статус</th>
              <th className="py-3 px-4 w-44 text-right font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {venues.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-text-muted">
                  Нет площадок — создайте первую
                </td>
              </tr>
            ) : (
              venues.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-surface-border/50 last:border-0 hover:bg-bg-card/30"
                >
                  <td className="py-3 px-4 font-medium text-text-primary">{v.name}</td>
                  <td className="py-3 px-4 text-text-primary">{v.city}</td>
                  <td className="py-3 px-4 text-text-primary">{v.address}</td>
                  <td className="py-3 px-4 text-text-primary tabular-nums">{v._count?.rooms ?? "—"}</td>
                  <td className="py-3 px-4 text-text-primary">{statusLabel(v.status)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing({
                            id: v.id,
                            name: v.name,
                            city: v.city,
                            address: v.address,
                            timezone: v.timezone,
                            status: v.status,
                          });
                          setFormOpen(true);
                        }}
                        className="inline-flex items-center rounded-full bg-[#24364A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#2A3E55]"
                      >
                        Изменить
                      </button>
                      {isAdmin ? (
                        <button
                          type="button"
                          disabled={deletingId === v.id}
                          onClick={() => void handleDelete(v)}
                          className="inline-flex items-center rounded-full bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/25 disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAdmin ? (
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="fixed bottom-8 right-8 flex items-center gap-2 rounded-xl bg-cyan px-5 py-3 text-sm font-semibold text-bg-primary shadow-lg transition-opacity hover:brightness-110"
        >
          + Добавить площадку
        </button>
      ) : (
        <p className="text-sm text-text-muted">Создавать и удалять площадки может только администратор.</p>
      )}

      <VenueFormModal
        isOpen={formOpen}
        editVenue={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={async (venue) => {
          await refreshVenues(venue.id);
          setSelectedVenueId(venue.id);
          refresh();
        }}
      />
      {deleteDialog}
    </div>
  );
}
