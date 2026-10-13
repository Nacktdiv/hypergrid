export interface DayOption {
  id: string; // YYYY-MM-DD
  short: string; // "Hari Ini", "Sab", "Jum", dll.
  date: string; // "11", "10", dll.
  monthYear: string; // "Okt 2026"
  longLabel: string; // "Minggu, 11 Okt 2026"
  isToday: boolean;
}

const ENG_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ENG_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];
const ENG_FULL_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];
const ENG_FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Format Date ke string YYYY-MM-DD lokal
 */
export function formatToIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Menghasilkan deret 7 hari terakhir (hari ini sampai 6 hari sebelumnya)
 */
export function getRecent7Days(): DayOption[] {
  const days: DayOption[] = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const iso = formatToIsoDate(d);
    const dayName = ENG_DAYS[d.getDay()];
    const fullDayName = ENG_FULL_DAYS[d.getDay()];
    const dateNum = String(d.getDate()).padStart(2, "0");
    const monthShort = ENG_MONTHS[d.getMonth()];
    const year = d.getFullYear();

    days.push({
      id: iso,
      short: i === 0 ? "Today" : dayName,
      date: dateNum,
      monthYear: `${monthShort} ${year}`,
      longLabel: `${fullDayName}, ${dateNum} ${monthShort} ${year}`,
      isToday: i === 0,
    });
  }

  return days;
}

/**
 * Format tanggal dari string YYYY-MM-DD ke label panjang
 */
export function formatIsoToLongLabel(iso: string): string {
  try {
    const parts = iso.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIndex, day);
      const fullDay = ENG_FULL_DAYS[d.getDay()];
      const fullMonth = ENG_FULL_MONTHS[monthIndex];
      return `${fullDay}, ${String(day).padStart(2, "0")} ${fullMonth} ${year}`;
    }
  } catch {
    // Fallback
  }
  return iso;
}
