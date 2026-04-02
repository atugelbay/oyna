"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, VenueSelect, PhoneInput } from "@/components/ui";
import { venuesService } from "@/services/venues.service";
import { authService } from "@/services/auth.service";
import { readApiUserError } from "@/lib/api-error-message";

export default function ClientLoginPage() {
  const router = useRouter();
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [venue, setVenue] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    venuesService.list().then((data) => {
      setVenues(data);
      if (data.length > 0) setVenue(data[0].id);
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.requestOtp(phone);
      router.push("/auth/verify?phone=" + encodeURIComponent(phone));
    } catch (err: unknown) {
      setError(readApiUserError(err, "Ошибка отправки SMS"));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = phone.length >= 9 && !loading;

  return (
    <>
      <div className="pt-12 pb-4">
        <VenueSelect
          value={venue}
          onChange={setVenue}
          venues={venues}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-2xl font-bold text-cyan text-center mb-2">
          Начните новый уровень!
        </h1>
        <p className="text-5xl font-black tracking-wider text-cyan mb-8">
          OYNA
        </p>

        <div className="w-full max-w-sm bg-bg-card/80 backdrop-blur-sm rounded-2xl p-6 border border-surface-border/50">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 items-center">
            <div className="w-full">
              <PhoneInput
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
            </div>
            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}
            <Button
              type="submit"
              disabled={!canSubmit}
              className={`${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="flex items-center gap-2">
                <ArrowRightIcon />
                {loading ? "Отправка..." : "Войти в систему"}
              </span>
            </Button>
          </form>
        </div>
      </div>

      <div className="pb-8" />
    </>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
