"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input, Button } from "@/components/ui";
import { authService } from "@/services/auth.service";
import { readApiUserError } from "@/lib/api-error-message";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const formattedPhone = phone || "+7 (XXX) XXX-XX-XX";
  const canSubmit = code.length >= 4 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authService.verifyOtp(phone, code);
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      router.push("/auth/profile");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Неверный код"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold text-text-primary text-center mb-2">
        Введите SMS-код
      </h1>
      <p className="text-sm text-text-secondary text-center mb-8 max-w-xs">
        На WhatsApp {formattedPhone} придет код для подтверждение.{" "}
        <button
          type="button"
          onClick={() => router.back()}
          className="text-text-primary underline underline-offset-2 hover:text-cyan transition-colors"
        >
          Сменить номер
        </button>
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-5 items-center">
        <div className="w-full">
          <Input
            label="SMS-код"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            autoComplete="one-time-code"
            autoFocus
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
          {loading ? "Проверка..." : "Подтвердить номер"}
        </Button>
      </form>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
