// Datas locais no formato AAAA-MM-DD, sem fuso: o treino acontece no dia do relógio do celular.

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(s: string, n: number): string {
  const d = fromISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  // Usa meio-dia para não sofrer com horário de verão.
  const da = fromISO(a);
  const db = fromISO(b);
  da.setHours(12);
  db.setHours(12);
  return Math.round((db.getTime() - da.getTime()) / 864e5);
}

/** Segunda-feira da semana de `s`. */
export function mondayOf(s: string): string {
  const d = fromISO(s);
  const wd = (d.getDay() + 6) % 7; // 0 = segunda
  d.setDate(d.getDate() - wd);
  return toISO(d);
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function weekdayName(s: string): string {
  return WEEKDAYS[fromISO(s).getDay()];
}
export function weekdayShort(n: number): string {
  return WEEKDAYS_SHORT[n];
}
export function monthName(m: number): string {
  return MONTHS[m];
}

/** "9 out" */
export function shortDate(s: string): string {
  const d = fromISO(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

/** "sexta, 9 de outubro" */
export function longDate(s: string): string {
  const d = fromISO(s);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
