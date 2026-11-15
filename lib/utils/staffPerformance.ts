import { toLocalDateString } from "./date";

export interface ServiceBreakdownItem { name: string; count: number; totalCost?: number; }
export interface StaffPerformanceSummary {
  servicesTotal: number;
  servicesBreakdown: ServiceBreakdownItem[];
  productsUsedTotal: number;
  productsUsedBreakdown: ServiceBreakdownItem[];
  serviceRevenue: number;
  // Backwards-compatible daily/monthly fields used by the dashboard.
  todayTotal: number;
  todayBreakdown: ServiceBreakdownItem[];
  monthlyTotal: number;
  monthlyBreakdown: ServiceBreakdownItem[];
  todayDistinctTypes: number;
  monthlyDistinctTypes: number;
}
function invoiceDateKey(invoice: any): string {
  if (typeof invoice.dateKey === "string" && invoice.dateKey) return invoice.dateKey;
  if (invoice.date) return toLocalDateString(invoice.date);
  if (invoice.billDate) return toLocalDateString(invoice.billDate);
  return "";
}
function matchesStaff(line: any, staff: { id?: string; name: string }): boolean {
  const name = staff.name.trim().toLowerCase();
  return Boolean((staff.id && line.staffId === staff.id) ||
    (line.staffName && String(line.staffName).trim().toLowerCase() === name) ||
    (line.staff && String(line.staff).trim().toLowerCase() === name));
}
function sortedBreakdown(counts: Record<string, number>): ServiceBreakdownItem[] {
  return Object.entries(counts).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Uses service line consumables only; retail invoice products are excluded.
 * With a single date argument, retains the dashboard's legacy today/month view.
 * With start and end arguments, returns performance for that inclusive range.
 */
export function computeStaffPerformance(
  invoices: any[],
  staffMember: { id?: string; name: string },
  startDate: string,
  endDate?: string
): StaffPerformanceSummary {
  const legacyMode = endDate === undefined;
  const rangeStart = legacyMode ? `${startDate.slice(0, 7)}-01` : startDate;
  const rangeEnd = endDate ?? startDate;
  const todayCounts: Record<string, number> = {};
  const monthlyCounts: Record<string, number> = {};
  const serviceCounts: Record<string, number> = {};
  const productCounts: Record<string, { count: number; totalCost: number }> = {};
  let todayTotal = 0;
  let monthlyTotal = 0;
  let servicesTotal = 0;
  let serviceRevenue = 0;

  invoices.forEach((invoice) => {
    const dateKey = invoiceDateKey(invoice);
    if (!dateKey || dateKey < rangeStart || dateKey > rangeEnd) return;
    const isSelectedDay = dateKey === startDate;
    const isSelectedMonth = dateKey.slice(0, 7) === startDate.slice(0, 7);
    (invoice.services || []).forEach((line: any) => {
      if (line.serviceId === "membership_fee" || !matchesStaff(line, staffMember)) return;
      const quantity = Math.max(1, Number(line.quantity) || 1);
      const serviceName = String(line.serviceName || line.service || line.name || "Service").trim();
      servicesTotal += quantity;
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + quantity;
      serviceRevenue += Math.max(0, Number(line.amount) || 0);
      if (isSelectedDay) {
        todayTotal += quantity;
        todayCounts[serviceName] = (todayCounts[serviceName] || 0) + quantity;
      }
      if (isSelectedMonth) {
        monthlyTotal += quantity;
        monthlyCounts[serviceName] = (monthlyCounts[serviceName] || 0) + quantity;
      }
      const productName = String(line.usedProductName || "").trim();
      if (!productName) return;
      if (!productCounts[productName]) productCounts[productName] = { count: 0, totalCost: 0 };
      productCounts[productName].count += quantity;
      productCounts[productName].totalCost += Math.max(0, Number(line.usedProductCost) || 0);
    });
  });

  const servicesBreakdown = sortedBreakdown(serviceCounts);
  const productsUsedBreakdown = Object.entries(productCounts)
    .map(([name, value]) => ({ name, count: value.count, totalCost: value.totalCost }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const todayBreakdown = sortedBreakdown(todayCounts);
  const monthlyBreakdown = sortedBreakdown(monthlyCounts);

  return {
    servicesTotal, servicesBreakdown,
    productsUsedTotal: productsUsedBreakdown.reduce((sum, item) => sum + item.count, 0),
    productsUsedBreakdown, serviceRevenue,
    todayTotal, todayBreakdown, monthlyTotal, monthlyBreakdown,
    todayDistinctTypes: todayBreakdown.length, monthlyDistinctTypes: monthlyBreakdown.length,
  };
}
