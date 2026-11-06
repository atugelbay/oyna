import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EXPENSE_CATEGORIES,
  REVENUE_GROUP_LABEL,
  type Period,
  type Range,
  type RevenueGroup,
  almatyYmd,
  avgMinutePrice,
  changePercent,
  lineGroup,
  monthDays,
  planProgress,
  repeatExpenseDate,
  resolvePeriod,
} from './finance-rules';
import { almatyDate } from '../domain/rules';

const BENCHMARKS_KEY = 'pnl_benchmarks';

const METHOD_LABEL: Record<string, string> = { CASH: 'Наличные', KASPI: 'Kaspi', HALYK: 'Halyk', FREEDOM: 'Freedom' };

/**
 * Данные для Финансов (п. 7 ТЗ 04.11). Выручка — только проведённые продажи без бартера,
 * за вычетом возвратов. «Внести» / «Изъять» в выручку не входят.
 */
@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  async overview(venueId: string, period: Period, custom?: { from?: string; to?: string }) {
    const { current, previous } = resolvePeriod(period, new Date(), custom);
    const [cur, prev] = await Promise.all([this.slice(venueId, current), this.slice(venueId, previous)]);
    return {
      period: { from: current.from, to: current.to, label: current.label, days: current.days },
      previousPeriod: { from: previous.from, to: previous.to, label: previous.label },
      revenue: cur.revenue,
      previousRevenue: prev.revenue,
      revenueChange: changePercent(cur.revenue, prev.revenue),
      expenses: cur.expensesTotal,
      previousExpenses: prev.expensesTotal,
      expensesChange: changePercent(cur.expensesTotal, prev.expensesTotal),
      profit: cur.revenue - cur.expensesTotal,
      previousProfit: prev.revenue - prev.expensesTotal,
      margin: cur.revenue ? Math.round(((cur.revenue - cur.expensesTotal) / cur.revenue) * 100) : 0,
      sales: cur.salesCount,
      averageCheck: cur.salesCount ? Math.round(cur.revenue / cur.salesCount) : 0,
      refunds: cur.refunds,
      barter: cur.barter,
      byMethod: cur.byMethod,
      byGroup: cur.byGroup,
      byOperator: cur.byOperator,
      byDay: cur.byDay,
      expensesByCategory: cur.expensesByCategory,
    };
  }

  /** Выручка комнат по сыгранным минутам: оплаченные минуты сеанса × средняя цена минуты игрока. */
  async roomsByPlayedMinutes(venueId: string, period: Period, custom?: { from?: string; to?: string }) {
    const { current } = resolvePeriod(period, new Date(), custom);
    const sessions = await this.prisma.gameSession.findMany({
      where: { venueId, isTournament: false, startTime: { gte: current.from, lt: current.to } },
      select: { id: true, roomId: true, room: { select: { name: true } } },
    });
    if (!sessions.length) return { period: current, rooms: [], totalRevenue: 0, totalMinutes: 0 };
    const debits = await this.prisma.minuteEntry.findMany({
      where: { type: 'DEBIT', sessionId: { in: sessions.map((s) => s.id) }, grant: { kind: { in: ['PAID', 'LEGACY_UNKNOWN'] } } },
      select: { userId: true, sessionId: true, seconds: true },
    });
    const players = [...new Set(debits.map((d) => d.userId))];
    // Цена минуты — по покупкам игрока за 90 дней до конца периода
    const since = new Date(current.to.getTime() - 90 * 86400000);
    const sales = await this.prisma.sale.findMany({
      where: {
        venueId,
        status: 'COMPLETED',
        isBarter: false,
        minutesCredited: { gt: 0 },
        createdAt: { gte: since, lt: current.to },
        OR: [{ userId: { in: players } }, { userIds: { hasSome: players } }],
      },
      select: { userId: true, userIds: true, totalTenge: true, refundTenge: true, minutesCredited: true },
    });
    const paid = new Map<string, { tenge: number; minutes: number }>();
    let venueTenge = 0;
    let venueMinutes = 0;
    for (const sale of sales) {
      const ids = sale.userIds.length ? sale.userIds : sale.userId ? [sale.userId] : [];
      if (!ids.length) continue;
      const share = (sale.totalTenge - sale.refundTenge) / ids.length;
      const minutes = sale.minutesCredited / ids.length;
      venueTenge += sale.totalTenge - sale.refundTenge;
      venueMinutes += sale.minutesCredited;
      for (const id of ids) {
        const row = paid.get(id) ?? { tenge: 0, minutes: 0 };
        row.tenge += share;
        row.minutes += minutes;
        paid.set(id, row);
      }
    }
    const fallback = avgMinutePrice(venueTenge, venueMinutes);
    const price = (userId: string) => {
      const p = paid.get(userId);
      return p && p.minutes > 0 ? avgMinutePrice(p.tenge, p.minutes) : fallback;
    };
    const roomOf = new Map(sessions.map((s) => [s.id, { id: s.roomId, name: s.room.name }]));
    const rooms = new Map<string, { roomId: string; name: string; minutes: number; revenue: number; sessions: Set<string> }>();
    for (const d of debits) {
      const room = roomOf.get(d.sessionId ?? '');
      if (!room) continue;
      const row = rooms.get(room.id) ?? { roomId: room.id, name: room.name, minutes: 0, revenue: 0, sessions: new Set<string>() };
      const minutes = d.seconds / 60;
      row.minutes += minutes;
      row.revenue += minutes * price(d.userId);
      row.sessions.add(d.sessionId ?? '');
      rooms.set(room.id, row);
    }
    const list = [...rooms.values()].map((r) => ({
      roomId: r.roomId,
      name: r.name,
      minutes: Math.round(r.minutes),
      sessions: r.sessions.size,
      revenue: Math.round(r.revenue),
    }));
    const totalRevenue = list.reduce((s, r) => s + r.revenue, 0);
    return {
      period: current,
      rooms: list
        .map((r) => ({ ...r, share: totalRevenue ? Math.round((r.revenue / totalRevenue) * 100) : 0 }))
        .sort((a, b) => b.revenue - a.revenue),
      totalRevenue,
      totalMinutes: list.reduce((s, r) => s + r.minutes, 0),
    };
  }

  /** План месяца: сумма, факт, прогноз на конец месяца по темпу, процент выполнения. */
  async planProgress(venueId: string, month: string) {
    const [y, m] = month.split('-').map(Number);
    const plan = await this.prisma.monthlyPlan.findUnique({ where: { venueId_year_month: { venueId, year: y, month: m } } });
    const range: Range = { from: almatyDate(y, m, 1), to: almatyDate(y, m + 1, 1), label: month, days: 0 };
    const { revenue } = await this.slice(venueId, range);
    return { month, ...planProgress({ plan: plan?.planTenge ?? 0, fact: revenue, ...monthDays(month, new Date()) }) };
  }

  /** P&L по статьям: доля от выручки и ориентир по статье (выше ориентира — красным). */
  async pnlByArticles(venueId: string, month: string) {
    const [y, m] = month.split('-').map(Number);
    const range: Range = { from: almatyDate(y, m, 1), to: almatyDate(y, m + 1, 1), label: month, days: 0 };
    const [slice, benchmarks] = await Promise.all([this.slice(venueId, range), this.getBenchmarks()]);
    const categories = new Set<string>([...EXPENSE_CATEGORIES, ...slice.expensesByCategory.map((c) => c.category)]);
    const rows = [...categories].map((category) => {
      const amount = slice.expensesByCategory.find((c) => c.category === category)?.amount ?? 0;
      const percent = slice.revenue ? Math.round((amount / slice.revenue) * 1000) / 10 : null;
      const benchmark = benchmarks[category] ?? null;
      return { category, amount, percent, benchmark, over: benchmark != null && percent != null && percent > benchmark };
    });
    const profit = slice.revenue - slice.expensesTotal;
    return {
      month,
      revenue: slice.revenue,
      expenses: slice.expensesTotal,
      profit,
      margin: slice.revenue ? Math.round((profit / slice.revenue) * 100) : 0,
      rows: rows.filter((r) => r.amount > 0 || r.benchmark != null),
    };
  }

  async getBenchmarks(): Promise<Record<string, number>> {
    const row = await this.prisma.appSetting.findUnique({ where: { key: BENCHMARKS_KEY } });
    try {
      const parsed = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
      return Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === 'number' && v >= 0 && v <= 100),
      ) as Record<string, number>;
    } catch {
      return {};
    }
  }

  async setBenchmarks(input: Record<string, unknown>) {
    const clean: Record<string, number> = {};
    for (const [k, v] of Object.entries(input ?? {})) {
      const n = Number(v);
      if (k.trim() && Number.isFinite(n) && n >= 0 && n <= 100) clean[k.trim()] = n;
    }
    const value = JSON.stringify(clean);
    await this.prisma.appSetting.upsert({ where: { key: BENCHMARKS_KEY }, create: { key: BENCHMARKS_KEY, value }, update: { value } });
    return clean;
  }

  async updateExpense(id: string, input: { amountTenge?: number; category?: string; article?: string; comment?: string; occurredOn?: string }, actorId: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row || row.cancelledAt) throw new NotFoundException('Расход не найден');
    if (row.payMethod === 'CASH_REGISTER') throw new BadRequestException('Расход из кассы правится через кассу');
    const amount = input.amountTenge != null ? Math.round(Number(input.amountTenge)) : row.amountTenge;
    if (!Number.isFinite(amount) || amount < 1) throw new BadRequestException('Сумма больше нуля');
    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        amountTenge: amount,
        category: input.category?.trim() || row.category,
        article: input.article?.trim() || row.article,
        comment: input.comment ?? row.comment,
        occurredOn: input.occurredOn ? new Date(input.occurredOn) : row.occurredOn,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'expense_update',
        entity: 'expense',
        entityId: id,
        detail: `${row.category}/${row.article} ${row.amountTenge} → ${updated.category}/${updated.article} ${updated.amountTenge}`,
      },
    });
    return updated;
  }

  async cancelExpense(id: string, actorId: string) {
    const row = await this.prisma.expense.findUnique({ where: { id } });
    if (!row || row.cancelledAt) throw new NotFoundException('Расход не найден');
    if (row.payMethod === 'CASH_REGISTER') throw new BadRequestException('Расход из кассы отменяется через кассу');
    await this.prisma.expense.update({ where: { id }, data: { cancelledAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { actorId, action: 'expense_cancel', entity: 'expense', entityId: id, detail: `${row.article} ${row.amountTenge} ₸` },
    });
    return { ok: true };
  }

  /** «Повторить прошлый месяц»: копирует расходы владельца (не из кассы) на тот же день этого месяца. */
  async repeatLastMonth(venueId: string, month: string, actorId: string) {
    const [y, m] = month.split('-').map(Number);
    const prevFrom = almatyDate(y, m - 1, 1);
    const prevTo = almatyDate(y, m, 1);
    const thisTo = almatyDate(y, m + 1, 1);
    const [prev, existing] = await Promise.all([
      this.prisma.expense.findMany({
        where: { venueId, cancelledAt: null, payMethod: { not: 'CASH_REGISTER' }, occurredOn: { gte: prevFrom, lt: prevTo } },
      }),
      this.prisma.expense.findMany({
        where: { venueId, cancelledAt: null, occurredOn: { gte: prevTo, lt: thisTo } },
        select: { category: true, article: true, amountTenge: true },
      }),
    ]);
    const taken = new Set(existing.map((e) => `${e.category}|${e.article}|${e.amountTenge}`));
    const toCreate = prev.filter((e) => !taken.has(`${e.category}|${e.article}|${e.amountTenge}`));
    if (toCreate.length) {
      await this.prisma.expense.createMany({
        data: toCreate.map((e) => ({
          venueId,
          occurredOn: repeatExpenseDate(e.occurredOn, month),
          amountTenge: e.amountTenge,
          category: e.category,
          article: e.article,
          comment: e.comment,
          payMethod: e.payMethod,
          createdById: actorId,
        })),
      });
    }
    return { copied: toCreate.length, skipped: prev.length - toCreate.length };
  }

  /** Все цифры периода одним проходом. */
  private async slice(venueId: string, range: Range) {
    const [sales, expenses] = await Promise.all([
      this.prisma.sale.findMany({
        where: { venueId, status: 'COMPLETED', createdAt: { gte: range.from, lt: range.to } },
        include: { lines: true, payments: true },
      }),
      this.prisma.expense.findMany({
        where: { venueId, cancelledAt: null, occurredOn: { gte: range.from, lt: range.to } },
      }),
    ]);
    const bookingIds = [...new Set(sales.map((s) => s.bookingId).filter((id): id is string => !!id))];
    const bookingTypes = bookingIds.length
      ? new Map(
          (await this.prisma.booking.findMany({ where: { id: { in: bookingIds } }, select: { id: true, type: true } })).map(
            (b) => [b.id, b.type],
          ),
        )
      : new Map<string, string>();
    const operators = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(sales.map((s) => s.operatorId))] } },
      select: { id: true, name: true, nickname: true },
    });
    const opName = new Map(operators.map((o) => [o.id, o.name || o.nickname]));

    const paidSales = sales.filter((s) => !s.isBarter);
    const barter = sales.filter((s) => s.isBarter);
    const byMethod = new Map<string, number>();
    const byGroup = new Map<RevenueGroup, number>();
    const byOperator = new Map<string, { amount: number; sales: number }>();
    const byDay = new Map<string, { revenue: number; expenses: number }>();
    let revenue = 0;
    let refunds = 0;
    for (const sale of paidSales) {
      const net = sale.totalTenge - sale.refundTenge;
      revenue += net;
      refunds += sale.refundTenge;
      for (const pay of sale.payments) byMethod.set(pay.method, (byMethod.get(pay.method) ?? 0) + pay.amountTenge);
      // возврат распределяем по строкам пропорционально, чтобы группы сходились с выручкой
      const k = sale.totalTenge ? net / sale.totalTenge : 0;
      for (const line of sale.lines) {
        const group = lineGroup({ ...line, bookingType: sale.bookingId ? bookingTypes.get(sale.bookingId) : null });
        byGroup.set(group, (byGroup.get(group) ?? 0) + line.priceTenge * line.qty * k);
      }
      const op = byOperator.get(sale.operatorId) ?? { amount: 0, sales: 0 };
      op.amount += net;
      op.sales += 1;
      byOperator.set(sale.operatorId, op);
      const day = almatyYmd(sale.createdAt);
      const d = byDay.get(day) ?? { revenue: 0, expenses: 0 };
      d.revenue += net;
      byDay.set(day, d);
    }
    if (refunds) byMethod.set('REFUND', -refunds);
    const expensesByCategory = new Map<string, number>();
    let expensesTotal = 0;
    for (const e of expenses) {
      expensesTotal += e.amountTenge;
      expensesByCategory.set(e.category, (expensesByCategory.get(e.category) ?? 0) + e.amountTenge);
      const day = almatyYmd(e.occurredOn);
      const d = byDay.get(day) ?? { revenue: 0, expenses: 0 };
      d.expenses += e.amountTenge;
      byDay.set(day, d);
    }
    return {
      revenue,
      refunds,
      salesCount: paidSales.length,
      barter: { sales: barter.length, minutes: barter.reduce((s, b) => s + b.minutesCredited, 0) },
      byMethod: [...byMethod.entries()].map(([method, amount]) => ({
        method,
        label: method === 'REFUND' ? 'Возвраты' : METHOD_LABEL[method] ?? method,
        amount,
      })),
      byGroup: [...byGroup.entries()]
        .map(([group, amount]) => ({ group, label: REVENUE_GROUP_LABEL[group], amount: Math.round(amount) }))
        .sort((a, b) => b.amount - a.amount),
      byOperator: [...byOperator.entries()]
        .map(([operatorId, v]) => ({ operatorId, name: opName.get(operatorId) ?? '—', amount: v.amount, sales: v.sales }))
        .sort((a, b) => b.amount - a.amount),
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day, ...v, profit: v.revenue - v.expenses })),
      expensesTotal,
      expensesByCategory: [...expensesByCategory.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    };
  }
}
