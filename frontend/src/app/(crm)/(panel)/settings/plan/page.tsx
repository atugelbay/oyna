"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { readApiUserError } from "@/lib/api-error-message";

export default function SettingsPlanPage() {
  const { selectedVenueId } = useCrmVenue();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [planTenge, setPlanTenge] = useState("0");
  const [overplanTenge, setOverplanTenge] = useState("0");
  const [rateBelow, setRateBelow] = useState("5");
  const [rateAt, setRateAt] = useState("7");
  const [rateOver, setRateOver] = useState("10");
  const [bookingRate, setBookingRate] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedVenueId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get("/finance/plan", { params: { venueId: selectedVenueId, year, month } })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setPlanTenge(String(data.planTenge ?? 0));
        setOverplanTenge(String(data.overplanTenge ?? 0));
        setRateBelow(String(data.rateBelow ?? 5));
        setRateAt(String(data.rateAt ?? 7));
        setRateOver(String(data.rateOver ?? 10));
        setBookingRate(String(data.bookingRate ?? 10));
      })
      .catch(() => {
        /* план ещё не задан — оставляем дефолты */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedVenueId, year, month]);

  async function save() {
    if (!selectedVenueId) {
      setError("Выберите площадку");
      return;
    }
    setSaving(true);
    setError(null);
    setOk("");
    try {
      await api.post("/finance/plan", {
        venueId: selectedVenueId,
        year,
        month,
        planTenge: Number(planTenge) || 0,
        overplanTenge: Number(overplanTenge) || 0,
        rateBelow: Number(rateBelow) || 0,
        rateAt: Number(rateAt) || 0,
        rateOver: Number(rateOver) || 0,
        bookingRate: Number(bookingRate) || 10,
      });
      setOk("План сохранён");
    } catch (err) {
      setError(readApiUserError(err, "Не удалось сохранить план"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-sm text-text-secondary">
        План выручки, сверхплан и проценты сотрудников. % с броней по умолчанию 10%.
      </p>
      {loading ? <p className="text-text-muted">Загрузка…</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {ok ? <p className="text-sm text-success">{ok}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-text-secondary">
          Год
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || year)}
            className="mt-1 h-12 w-full rounded-lg border border-surface-border bg-bg-card px-3 text-text-primary"
          />
        </label>
        <label className="text-sm text-text-secondary">
          Месяц
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 h-12 w-full rounded-lg border border-surface-border bg-bg-card px-3 text-text-primary"
          />
        </label>
      </div>

      {(
        [
          ["План, ₸", planTenge, setPlanTenge],
          ["Сверхплан, ₸", overplanTenge, setOverplanTenge],
          ["% ниже плана", rateBelow, setRateBelow],
          ["% на плане", rateAt, setRateAt],
          ["% сверх плана", rateOver, setRateOver],
          ["% с броней", bookingRate, setBookingRate],
        ] as const
      ).map(([label, value, setter]) => (
        <label key={label} className="block text-sm text-text-secondary">
          {label}
          <input
            inputMode="numeric"
            value={value}
            onChange={(e) => setter(e.target.value)}
            className="mt-1 h-12 w-full rounded-lg border border-surface-border bg-bg-card px-3 text-text-primary"
          />
        </label>
      ))}

      <button
        type="button"
        disabled={saving || !selectedVenueId}
        onClick={() => void save()}
        className="h-12 rounded-xl bg-cyan px-5 font-semibold text-bg-primary disabled:opacity-50"
      >
        {saving ? "Сохранение…" : "Сохранить план"}
      </button>
    </div>
  );
}
