"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";
import { useCrmVenue } from "@/lib/venue-context";
import { bookingStatusLabel } from "@/lib/crm-labels";

const BIRTHDAY_PACKAGES = [
  { name: "START", minutes: 40, price: 50000 },
  { name: "STANDARD", minutes: 60, price: 80000 },
  { name: "LEVEL UP", minutes: 90, price: 100000 },
  { name: "BOSS MODE", minutes: 120, price: 120000 },
] as const;

const TEAM_PACKAGES = [
  { name: "40 мин", minutes: 40, priceWeekday: 6000, priceWeekend: 7000 },
  { name: "60 мин", minutes: 60, priceWeekday: 8000, priceWeekend: 9000 },
  { name: "90 мин", minutes: 90, priceWeekday: 11000, priceWeekend: 12000 },
] as const;

const STATUSES = ["NEW", "CONFIRMED", "ARRIVED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

function isWeekend(isoLocal: string) {
  if (!isoLocal) return false;
  const d = new Date(isoLocal);
  const day = d.getDay();
  return day === 0 || day === 6;
}

function birthdayAmount(packagePrice: number, people: number) {
  return Math.round((packagePrice / 10) * people);
}

function teambuildingAmount(pricePerPerson: number, people: number) {
  return pricePerPerson * people;
}

export default function BookingsPage() {
  const { selectedVenueId } = useCrmVenue();
  const [rows, setRows] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    type: "BIRTHDAY" as "BIRTHDAY" | "TEAMBUILDING",
    startsAt: "",
    contactName: "",
    contactPhone: "",
    packageName: "STANDARD",
    packageMinutes: 60,
    packagePrice: 80000,
    pricePerPerson: 8000,
    people: 10,
    prepayTenge: 10000,
    sourceCode: "",
    broughtByName: "",
  });

  const amount = useMemo(() => {
    if (form.type === "BIRTHDAY") {
      let price = form.packagePrice;
      // Будни LEVEL UP по цене STANDARD
      if (form.packageName === "LEVEL UP" && !isWeekend(form.startsAt)) {
        price = BIRTHDAY_PACKAGES.find((p) => p.name === "STANDARD")?.price ?? price;
      }
      return birthdayAmount(price, form.people);
    }
    return teambuildingAmount(form.pricePerPerson, form.people);
  }, [form]);

  const remainder = Math.max(0, amount - Number(form.prepayTenge || 0));

  async function load() {
    const [{ data }, sourcesRes] = await Promise.all([
      api.get("/bookings", { params: { venueId: selectedVenueId || undefined } }),
      api.get("/sources").catch(() => ({ data: [] })),
    ]);
    setRows(data);
    setSources(sourcesRes.data ?? []);
    if (!form.sourceCode && (sourcesRes.data?.[0]?.code || sourcesRes.data?.[0]?.id)) {
      setForm((f) => ({ ...f, sourceCode: sourcesRes.data[0].code || sourcesRes.data[0].id }));
    }
  }

  useEffect(() => {
    load().catch((e) => setError(e?.response?.data?.message || "Не загрузилось"));
  }, [selectedVenueId]);

  function pickBirthdayPackage(name: string) {
    const pkg = BIRTHDAY_PACKAGES.find((p) => p.name === name);
    if (!pkg) return;
    setForm((f) => ({
      ...f,
      packageName: pkg.name,
      packageMinutes: pkg.minutes,
      packagePrice: pkg.price,
    }));
  }

  function pickTeamPackage(name: string) {
    const pkg = TEAM_PACKAGES.find((p) => p.name === name);
    if (!pkg) return;
    const weekend = isWeekend(form.startsAt);
    setForm((f) => ({
      ...f,
      packageName: pkg.name,
      packageMinutes: pkg.minutes,
      pricePerPerson: weekend ? pkg.priceWeekend : pkg.priceWeekday,
      packagePrice: weekend ? pkg.priceWeekend : pkg.priceWeekday,
    }));
  }

  async function createBooking() {
    setError("");
    try {
      await api.post("/bookings", {
        venueId: selectedVenueId,
        type: form.type,
        startsAt: form.startsAt,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        packageName: form.packageName,
        packageMinutes: form.packageMinutes,
        packagePrice: form.type === "BIRTHDAY" ? form.packagePrice : form.pricePerPerson,
        pricePerPerson: form.type === "TEAMBUILDING" ? form.pricePerPerson : undefined,
        people: form.people,
        prepayTenge: Number(form.prepayTenge) || 0,
        sourceCode: form.sourceCode,
        comment: form.broughtByName ? `Кто привёл: ${form.broughtByName}` : undefined,
      });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Не создано");
    }
  }

  async function setStatus(id: string, status: string) {
    setError("");
    try {
      await api.post(`/bookings/${id}/status`, { status });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Статус не обновлён");
    }
  }

  return (
    <div className="space-y-4 text-text-primary">
      <h1 className="text-2xl font-bold">Бронирования</h1>
      {error ? <p className="text-sm text-red-400">{String(error)}</p> : null}

      <div className="grid gap-3 rounded-xl bg-bg-secondary p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm({ ...form, type: "BIRTHDAY", packageName: "STANDARD", packageMinutes: 60, packagePrice: 80000 })}
            className={`min-h-11 rounded-xl px-3 ${form.type === "BIRTHDAY" ? "bg-cyan text-black" : "bg-bg-card"}`}
          >
            День рождения
          </button>
          <button
            type="button"
            onClick={() => {
              setForm({
                ...form,
                type: "TEAMBUILDING",
                packageName: "60 мин",
                packageMinutes: 60,
                pricePerPerson: 8000,
                packagePrice: 8000,
              });
            }}
            className={`min-h-11 rounded-xl px-3 ${form.type === "TEAMBUILDING" ? "bg-cyan text-black" : "bg-bg-card"}`}
          >
            Тимбилдинг
          </button>
        </div>

        <p className="text-xs uppercase tracking-wide text-text-muted">Пакет</p>
        <div className="flex flex-wrap gap-2">
          {form.type === "BIRTHDAY"
            ? BIRTHDAY_PACKAGES.map((pkg) => (
                <button
                  key={pkg.name}
                  type="button"
                  onClick={() => pickBirthdayPackage(pkg.name)}
                  className={`min-h-11 rounded-xl px-3 text-sm ${form.packageName === pkg.name ? "bg-cyan text-black" : "bg-bg-card"}`}
                >
                  {pkg.name} {pkg.minutes} · {pkg.price.toLocaleString("ru-KZ")} ₸
                </button>
              ))
            : TEAM_PACKAGES.map((pkg) => (
                <button
                  key={pkg.name}
                  type="button"
                  onClick={() => pickTeamPackage(pkg.name)}
                  className={`min-h-11 rounded-xl px-3 text-sm ${form.packageName === pkg.name ? "bg-cyan text-black" : "bg-bg-card"}`}
                >
                  {pkg.name}
                </button>
              ))}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-sm">
            День и время
            <input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            />
          </label>
          <label className="text-sm">
            Контакт
            <input
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            />
          </label>
          <label className="text-sm">
            Телефон
            <input
              inputMode="tel"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            />
          </label>
          <label className="text-sm">
            Откуда узнали
            <select
              value={form.sourceCode}
              onChange={(e) => setForm({ ...form, sourceCode: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            >
              <option value="">Выберите</option>
              {sources.map((s) => (
                <option key={s.id || s.code} value={s.code || s.id}>
                  {s.label || s.name || s.code}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Кто привёл
            <input
              value={form.broughtByName}
              onChange={(e) => setForm({ ...form, broughtByName: e.target.value })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            />
          </label>
          <div className="text-sm">
            Сколько человек
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-card"
                onClick={() => setForm({ ...form, people: Math.max(6, form.people - 1) })}
              >
                −
              </button>
              <span className="min-w-10 text-center text-lg font-semibold tabular-nums">{form.people}</span>
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-card"
                onClick={() =>
                  setForm({
                    ...form,
                    people: Math.min(form.type === "TEAMBUILDING" ? 20 : 40, form.people + 1),
                  })
                }
              >
                +
              </button>
            </div>
          </div>
          <label className="text-sm">
            Предоплата (по умолчанию 10 000 ₸)
            <input
              inputMode="numeric"
              value={form.prepayTenge}
              onChange={(e) => setForm({ ...form, prepayTenge: Number(e.target.value) })}
              className="mt-1 min-h-12 w-full rounded-xl bg-bg-card px-3 text-base"
            />
          </label>
        </div>

        <div className="rounded-xl bg-bg-card p-3 text-sm">
          <p className="text-lg font-bold tabular-nums">{amount.toLocaleString("ru-KZ")} ₸</p>
          <p className="text-text-secondary">
            Предоплата {Number(form.prepayTenge || 0).toLocaleString("ru-KZ")} ₸ · остаток {remainder.toLocaleString("ru-KZ")} ₸
          </p>
          <p className="mt-1 text-xs text-text-muted">Цена фиксируется при создании брони</p>
        </div>

        <button type="button" onClick={createBooking} className="min-h-12 rounded-xl bg-cyan font-semibold text-black">
          Создать бронь
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl bg-bg-secondary p-3 text-sm">
            <p className="font-semibold">
              {row.type === "BIRTHDAY" ? "ДР" : "Тимбилдинг"} · {row.contactName} · {bookingStatusLabel(row.status)}
            </p>
            <p>
              {new Date(row.startsAt).toLocaleString("ru-RU", { timeZone: "Asia/Almaty" })} · {row.people} чел · пакет {row.packageName} ·{" "}
              {row.amountTenge?.toLocaleString("ru-KZ")} ₸
            </p>
            <p>
              Предоплата {row.prepayTenge?.toLocaleString("ru-KZ")} ₸ · остаток {(row.amountTenge - row.prepayTenge).toLocaleString("ru-KZ")} ₸
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatus(row.id, status)}
                  className={`min-h-10 rounded-lg px-2 text-xs ${row.status === status ? "bg-cyan text-black" : "bg-bg-card"}`}
                >
                  {bookingStatusLabel(status)}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
