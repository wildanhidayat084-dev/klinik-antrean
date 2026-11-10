// Tanggal "hari ini" menurut WIB (format YYYY-MM-DD).
// Jangan pakai new Date().toISOString() karena itu UTC:
// jam 00.00-07.00 WIB hasilnya masih tanggal kemarin.
export function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
  }).format(new Date());
}