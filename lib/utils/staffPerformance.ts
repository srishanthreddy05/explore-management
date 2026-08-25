import { toLocalDateString } from "./date";

export interface ServiceBreakdownItem {
  name: string;
  count: number;
}

export interface StaffPerformanceSummary {
  todayTotal: number;
  todayBreakdown: ServiceBreakdownItem[];
  monthlyTotal: number;
  monthlyBreakdown: ServiceBreakdownItem[];
  todayDistinctTypes: number;
  monthlyDistinctTypes: number;
}

/**
 * Computes exact daily and monthly service performance for a given staff member
 * from authoritative invoice records.
 *
 * Rules:
 * - Count every valid service line assigned to the staff member.
 * - Respect line item quantity (defaults to 1).
 * - Filter by today's date (`YYYY-MM-DD`) and current month (`YYYY-MM`).
 * - Exclude membership fee line items (`serviceId === "membership_fee"`).
 */
export function computeStaffPerformance(
  invoices: any[],
  staffMember: { id?: string; name: string },
  todayStr: string = toLocalDateString(new Date())
): StaffPerformanceSummary {
  const currentMonthStr = todayStr.slice(0, 7); // e.g. "2026-08"

  const todayCounts: Record<string, number> = {};
  const monthlyCounts: Record<string, number> = {};

  let todayTotal = 0;
  let monthlyTotal = 0;

  invoices.forEach((inv) => {
    const invDateStr =
      inv.dateKey ||
      (inv.date ? toLocalDateString(inv.date) : "") ||
      (inv.billDate ? toLocalDateString(inv.billDate) : "");
    if (!invDateStr) return;

    const isToday = invDateStr === todayStr;
    const isThisMonth = invDateStr.slice(0, 7) === currentMonthStr;

    if (!isToday && !isThisMonth) return;

    (inv.services || []).forEach((s: any) => {
      // Exclude membership fee line items
      if (s.serviceId === "membership_fee") return;

      const isMatch =
        (staffMember.id && s.staffId === staffMember.id) ||
        (s.staffName && s.staffName.toLowerCase() === staffMember.name.toLowerCase()) ||
        (s.staff && s.staff.toLowerCase() === staffMember.name.toLowerCase());

      if (!isMatch) return;

      const qty = Math.max(1, Number(s.quantity) || 1);
      const rawName = s.serviceName || s.service || s.name || "Service";
      const serviceName = rawName.trim();

      if (isToday) {
        todayTotal += qty;
        todayCounts[serviceName] = (todayCounts[serviceName] || 0) + qty;
      }

      if (isThisMonth) {
        monthlyTotal += qty;
        monthlyCounts[serviceName] = (monthlyCounts[serviceName] || 0) + qty;
      }
    });
  });

  const todayBreakdown: ServiceBreakdownItem[] = Object.entries(todayCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const monthlyBreakdown: ServiceBreakdownItem[] = Object.entries(monthlyCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    todayTotal,
    todayBreakdown,
    monthlyTotal,
    monthlyBreakdown,
    todayDistinctTypes: todayBreakdown.length,
    monthlyDistinctTypes: monthlyBreakdown.length,
  };
}
