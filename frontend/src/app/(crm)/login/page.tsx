"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { readApiUserError } from "@/lib/api-error-message";
import { OynaLogo, Input, Button, Tabs, PhoneInput } from "@/components/ui";

const LOGIN_TABS = [
  { id: "owner", label: "Владелец" },
  { id: "employee", label: "Сотрудник" },
];

export default function LoginPage() {
  const router = useRouter();
  const { crmLogin, crmEmployeeLogin } = useAuth();
  const [activeTab, setActiveTab] = useState("owner");
  const [phone, setPhone] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isOwner = activeTab === "owner";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isOwner) {
        await crmLogin(phone, secret);
      } else {
        await crmEmployeeLogin(phone, secret);
      }
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(readApiUserError(err, "Ошибка входа"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — Logo */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-primary">
        <OynaLogo />
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-6 bg-bg-secondary">
        <div className="w-full max-w-sm flex flex-col gap-8">
          {/* Header */}
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-3xl font-black tracking-wider text-text-primary">
              OYNA
            </h1>
            <p className="text-text-secondary text-base">
              Вход в админ-систему
            </p>
          </div>

          {/* Tabs */}
          <Tabs
            tabs={LOGIN_TABS}
            activeTab={activeTab}
            onChange={(id) => {
              setActiveTab(id);
              setSecret("");
            }}
          />

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <PhoneInput
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
            />
            <Input
              label={isOwner ? "Пароль" : "Код системы"}
              isPassword
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete={isOwner ? "current-password" : "off"}
            />
            {error && (
              <p className="text-danger text-sm text-center">{error}</p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Вход..." : "Войти в систему"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
