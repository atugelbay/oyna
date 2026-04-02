'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, ArrowDownLeft, Gift, Wrench } from 'lucide-react';
import { balanceService } from '@/services/balance.service';

const TX_TYPE_LABEL: Record<string, string> = {
  PURCHASE: 'Покупка времени',
  BONUS: 'Бонус',
  PROMO: 'Акция',
  GAME_DEBIT: 'Списание за игру',
  CORRECTION: 'Корректировка',
};

const TX_TYPE_ICON: Record<string, React.ReactNode> = {
  PURCHASE: <TrendingUp size={18} className="text-green-400" />,
  BONUS: <Gift size={18} className="text-yellow-400" />,
  PROMO: <Gift size={18} className="text-purple-400" />,
  GAME_DEBIT: <TrendingDown size={18} className="text-red-400" />,
  CORRECTION: <Wrench size={18} className="text-gray-400" />,
};

export default function BalancePage() {
  const [balance, setBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    Promise.all([
      balanceService.getBalance(),
      balanceService.getTransactions(1, 20),
    ])
      .then(([bal, txs]) => {
        setBalance(bal);
        setTransactions(txs.data);
        setMeta({ page: txs.meta.page, totalPages: txs.meta.totalPages });
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (meta.page >= meta.totalPages) return;
    setLoadingMore(true);
    try {
      const res = await balanceService.getTransactions(meta.page + 1, 20);
      setTransactions((p) => [...p, ...res.data]);
      setMeta({ page: res.meta.page, totalPages: res.meta.totalPages });
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-14 space-y-5">
      <h1 className="text-xl font-bold text-white">Баланс</h1>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-brand to-brand-dark rounded-2xl p-5 shadow-lg shadow-brand/20">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={18} className="text-white/70" />
          <span className="text-white/70 text-sm">Доступное время</span>
        </div>
        <div className="text-4xl font-bold text-white">
          {balance?.display ?? '—'}
        </div>
        <div className="flex gap-4 mt-3">
          <div>
            <p className="text-white/50 text-xs">Минут</p>
            <p className="text-white font-semibold">{balance?.displayMinutes ?? 0}</p>
          </div>
          <div>
            <p className="text-white/50 text-xs">Секунд</p>
            <p className="text-white font-semibold">{balance?.displaySeconds ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="text-white font-semibold mb-3">История транзакций</h2>

        {transactions.length === 0 ? (
          <div className="bg-surface-card rounded-2xl p-8 text-center">
            <ArrowDownLeft size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Транзакций пока нет</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div key={t.id} className="bg-surface-card rounded-xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center shrink-0">
                  {TX_TYPE_ICON[t.type] ?? <ArrowDownLeft size={18} className="text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {TX_TYPE_LABEL[t.type] ?? t.type}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {t.venue?.name ?? 'OYNA'} · {new Date(t.createdAt).toLocaleDateString('ru')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {t.equivalentSeconds !== 0 && (
                    <p className={`text-sm font-semibold ${t.type === 'GAME_DEBIT' ? 'text-red-400' : 'text-green-400'}`}>
                      {t.type === 'GAME_DEBIT' ? '-' : '+'}{Math.floor(t.equivalentSeconds / 60)}м
                    </p>
                  )}
                  {t.amountTenge !== 0 && (
                    <p className="text-gray-500 text-xs">{t.amountTenge} ₸</p>
                  )}
                </div>
              </div>
            ))}

            {meta.page < meta.totalPages && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full py-3 text-brand text-sm font-medium flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Загрузить ещё'
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
