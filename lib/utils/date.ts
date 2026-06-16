/**
 * Formats a Date object (or date string / Timestamp) into a YYYY-MM-DD string
 * in the local timezone of the browser/system.
 */
export function toLocalDateString(date: Date | string | any): string {
  if (!date) return "";
  
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date?.toDate === "function") {
    d = date.toDate();
  } else {
    d = new Date(date);
  }

  // Fallback if date is invalid
  if (isNaN(d.getTime())) return "";

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
