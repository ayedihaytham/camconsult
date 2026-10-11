/** Dates civiles locales : aucune conversion UTC pour les échéances AAAA-MM-JJ. */
export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Six semaines, du lundi au dimanche, pour une grille stable entre les mois. */
export function deadlineCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index);
    return { key: calendarDateKey(date), date, inMonth: date.getMonth() === first.getMonth() };
  });
}

/** Conserve le jour choisi, limité au dernier jour du mois de destination. */
export function shiftCalendarMonth(date: Date, amount: number): Date {
  const last = new Date(date.getFullYear(), date.getMonth() + amount + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + amount, Math.min(date.getDate(), last));
}
