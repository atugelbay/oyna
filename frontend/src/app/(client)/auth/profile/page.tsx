"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Input, Button, Avatar } from "@/components/ui";
import { authService } from "@/services/auth.service";
import { readApiUserError } from "@/lib/api-error-message";

export default function CreateProfilePage() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [birthday, setBirthday] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const avatarLetter = nickname.trim() ? nickname.trim()[0].toUpperCase() : undefined;
  const canSubmit = nickname.trim().length >= 2 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authService.register({
        phone: "", // phone comes from the OTP flow / token
        nickname: nickname.trim(),
        name: nickname.trim(),
        birthDate: birthday || undefined,
      });
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      router.push("/");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Ошибка создания профиля"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <h1 className="text-2xl font-bold text-text-primary text-center mb-6">
        Создайте профиль игрока
      </h1>

      <div className="mb-8">
        <Avatar letter={avatarLetter} size={72} />
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4 items-center">
        <div className="w-full">
          <Input
            label="Ваш никнейм"
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="w-full relative">
          <Input
            label="День рождения"
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
          />
        </div>

        <div className="bg-bg-card/60 border border-surface-border/50 rounded-xl px-4 py-2.5 text-center">
          <p className="text-xs text-text-secondary">
            Получайте скидки или бонусы<br />в честь этого дня
          </p>
        </div>

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <Button
          type="submit"
          disabled={!canSubmit}
          className={`${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? "Создание..." : "Создать профиль"}
        </Button>
      </form>
    </div>
  );
}
