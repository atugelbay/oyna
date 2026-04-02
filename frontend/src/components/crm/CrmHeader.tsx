"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Avatar } from "@mui/material";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { useAuth } from "@/lib/auth-context";
import { useCrmVenue } from "@/lib/venue-context";

/** Верхняя панель справа от логотипа — на общем градиентном фоне с сайдбаром */
export function CrmHeader() {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [venueMenuOpen, setVenueMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const venueMenuRef = useRef<HTMLDivElement>(null);
  const { user, logout } = useAuth();
  const { venues, selectedVenueId, selectedVenue, setSelectedVenueId, loading: venuesLoading } =
    useCrmVenue();

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!venueMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (venueMenuRef.current && !venueMenuRef.current.contains(e.target as Node)) {
        setVenueMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVenueMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [venueMenuOpen]);

  const profileName = user?.name?.trim() || user?.nickname?.trim() || user?.phone || "Пользователь";
  const roleLabel = getRoleLabel(user?.role);
  const avatarLetter = profileName.trim().charAt(0).toUpperCase() || "U";

  const venueLabel = venuesLoading
    ? "Загрузка..."
    : selectedVenue?.name ?? venues[0]?.name ?? "Площадка";

  return (
    <header className="flex min-w-0 flex-1 items-center justify-end gap-4 py-2 overflow-visible">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative" ref={venueMenuRef}>
            <button
              type="button"
              onClick={() => venues.length > 0 && setVenueMenuOpen((o) => !o)}
              disabled={venuesLoading || venues.length === 0}
              aria-expanded={venueMenuOpen}
              aria-haspopup="listbox"
              className={`flex flex-col items-start text-left ${
                venues.length > 0 && !venuesLoading ? "cursor-pointer" : "cursor-default opacity-80"
              } ${venueMenuOpen ? "rounded-t-lg bg-white/[0.06] px-1 -mx-1" : ""}`}
            >
              <span className="text-xs leading-tight text-text-secondary">Игровая точка</span>
              <span className="flex items-center gap-1 text-sm font-medium leading-tight text-white">
                {venueLabel}
                {venues.length > 0 ? (
                  <KeyboardArrowDownRoundedIcon
                    sx={{
                      fontSize: 18,
                      color: "#9FB4C6",
                      transform: venueMenuOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                  />
                ) : null}
              </span>
            </button>
            {venueMenuOpen && venues.length > 0 ? (
              <ul
                className="absolute left-0 top-full z-[200] mt-1 min-w-[220px] max-w-[min(100vw-2rem,320px)] rounded-xl border border-surface-border bg-[#19232E] py-1 shadow-lg shadow-black/40"
                role="listbox"
                aria-label="Выбор площадки"
              >
                {venues.map((v) => {
                  const active = v.id === selectedVenueId;
                  return (
                    <li key={v.id} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVenueId(v.id);
                          setVenueMenuOpen(false);
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors ${
                          active ? "bg-white/[0.08] text-white" : "text-text-primary hover:bg-white/5"
                        }`}
                      >
                        <span className="text-sm font-medium leading-tight">{v.name}</span>
                        {v.city ? (
                          <span className="text-xs text-text-muted leading-tight">{v.city}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center justify-center rounded-xl border border-surface-border/50 p-2 text-text-secondary transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan/50"
            aria-label="Настройки"
          >
            <SettingsOutlinedIcon sx={{ fontSize: 22 }} />
          </Link>
        </div>
        <div className="relative" ref={profileMenuRef}>
          <button
            type="button"
            onClick={() => setProfileMenuOpen((o) => !o)}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            className={`flex items-center gap-2 rounded-tl-2xl rounded-br-2xl rounded-tr-none rounded-bl-none border border-surface-border/50 px-2 py-1.5 transition-colors hover:bg-white/5 ${
              profileMenuOpen ? "bg-white/[0.06]" : ""
            }`}
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: "#122A3D", color: "#00E5FF", fontSize: 13, fontWeight: 700 }}>
              {avatarLetter}
            </Avatar>
            <div className="hidden flex-col items-start text-left sm:flex">
              <span className="text-xs leading-tight text-text-secondary">{roleLabel}</span>
              <span className="flex items-center gap-1 text-sm font-medium leading-tight text-white">
                {profileName}
                <KeyboardArrowDownRoundedIcon
                  sx={{
                    fontSize: 18,
                    color: "#9FB4C6",
                    transform: profileMenuOpen ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s ease",
                  }}
                />
              </span>
            </div>
          </button>
          {profileMenuOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-xl border border-surface-border bg-[#19232E] py-1 shadow-lg shadow-black/40"
              role="menu"
              aria-label="Меню профиля"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  logout();
                }}
                className="w-full px-4 py-2.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-white/5 focus:bg-white/5 focus:outline-none"
              >
                Выйти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function getRoleLabel(role?: string) {
  if (!role) return "Сотрудник";

  const normalizedRole = role.toUpperCase();
  if (normalizedRole === "ADMIN" || normalizedRole === "OWNER") return "Администратор";
  if (normalizedRole === "MANAGER") return "Менеджер";
  if (normalizedRole === "CASHIER") return "Кассир";
  if (normalizedRole === "OPERATOR") return "Оператор";

  return role;
}
