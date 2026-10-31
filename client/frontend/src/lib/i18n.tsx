'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'kk' | 'ru';

const dict = {
  kk: {
    home: 'Басты',
    balance: 'Баланс',
    games: 'Ойындар',
    rating: 'Рейтинг',
    profile: 'Профиль',
    ratingTitle: 'Ойыншылар рейтингі',
    day: 'Күн',
    month: 'Ай',
    year: 'Жыл',
    all: 'Барлық уақыт',
    allRooms: 'Барлық бөлме',
    yourPlace: 'Сенің орның',
    empty: 'Әзірге ойын жоқ. Бірінші бол.',
    paid: 'Төленген',
    bonus: 'Бонус',
    expire: 'жанады',
    until: 'дейін',
    offer: 'Жария офертамен келісемін',
    privacy: 'Дербес деректерді жинауға және өңдеуге келісемін',
    guardian: 'Өзімді (18+) немесе баламды ата-ана ретінде тіркеймін',
    lang: 'ҚАЗ',
  },
  ru: {
    home: 'Главная',
    balance: 'Баланс',
    games: 'Игры',
    rating: 'Рейтинг',
    profile: 'Профиль',
    ratingTitle: 'Рейтинг игроков',
    day: 'День',
    month: 'Месяц',
    year: 'Год',
    all: 'Всё время',
    allRooms: 'Все комнаты',
    yourPlace: 'Твоё место',
    empty: 'Пока никто не играл — будь первым.',
    paid: 'Оплаченные',
    bonus: 'Бонусные',
    expire: 'сгорят',
    until: 'до',
    offer: 'Согласен с публичной офертой',
    privacy: 'Согласен на сбор и обработку персональных данных',
    guardian: 'Регистрирую себя (18+) или своего ребёнка как родитель',
    lang: 'РУС',
  },
} as const;

type Key = keyof (typeof dict)['kk'];

const Ctx = createContext<{ lang: Lang; t: (k: Key) => string; toggle: () => void }>({
  lang: 'kk',
  t: (k) => dict.kk[k],
  toggle: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('kk');
  useEffect(() => {
    const saved = localStorage.getItem('oyna-lang');
    if (saved === 'ru' || saved === 'kk') setLang(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang === 'kk' ? 'kk' : 'ru';
    localStorage.setItem('oyna-lang', lang);
  }, [lang]);
  return (
    <Ctx.Provider
      value={{
        lang,
        t: (k) => dict[lang][k],
        toggle: () => setLang((v) => (v === 'kk' ? 'ru' : 'kk')),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useI18n() {
  return useContext(Ctx);
}
