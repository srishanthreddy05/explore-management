/**
 * Pure calculation engine for Explore Salon Management Monthly Financial Reports & Stylist Settlements.
 *
 * Rules:
 * 1. Stylist Service Split: (Service Revenue - Product Cost) * 50%
 * 2. Owner Service Split:   (Service Revenue - Product Cost) * 50% + Product Cost
 * 3. Owner Direct Revenue:  Owner services, System services, and Membership fees (100% Owner)
 * 4. Retail Products:       100% Owner share
 * 5. Credit Collections:    100% Owner direct collections (not double-counted as new services)
 * 6. Balance Carry-Forward:
 *    Opening Balance (Month M) = Sum(Earnings prior to M) - Sum(Payments prior to M)
 *    Closing Balance (Month M) = Opening Balance + Current Earnings + Adjustments - Current Payments
 *    Closing Balance (M) strictly equals Opening Balance (M + 1).
 */

import { getInvoicePayments, getInvoicePaymentRatio, getServiceCommission } from "./settlements";
import type { StaffDrawing } from "@/services/staffDrawings";
import type { Expense } from "@/types/expense";
import type { Staff } from "@/types/staff";

export interface MonthlyRevenueSummary {
  month: string;                      // "YYYY-MM"
  totalInvoicedSales: number;         // sum of invoice.grandTotal
  subtotal: number;                   // sum of invoice.subtotal
  totalDiscounts: number;             // line discounts + bill discounts
  totalProductSuppliesCost: number;   // sum of usedProductCost across services
  recognizedRevenue: number;          // recognized revenue factoring in payment ratios

  // Product & Service Breakdown
  grossServiceRevenue: number;        // recognized gross service revenue
  netServiceRevenue: number;          // grossServiceRevenue - totalProductSuppliesCost
  retailProductsRevenue: number;      // recognized retail products revenue
  membershipFeesRevenue: number;      // membership fees collected
  creditCollectionsRevenue: number;   // prior credit balances collected this month

  // Actual Payment Collections
  collections: {
    totalCollected: number;
    cash: number;
    upi: number;
    card: number;
    advanceUsed: number;
  };
  totalOutstandingReceivables: number; // unpaid customer balance dues

  // Revenue Allocation (100% Reconciled)
  allocation: {
    totalOwnerShare: number;
    totalStylistShares: number;
    ownerDirectServiceShare: number;
    ownerNetServiceSplit: number;
    ownerProductReimbursement: number;
    ownerRetailShare: number;
    ownerMembershipShare: number;
    ownerCreditCollectionsShare: number;
    reconciledTotal: number;
    discrepancy: number;              // strictly 0
  };

  // Operating Expenses & Net Business Profit
  expenses: {
    totalExpenses: number;
    categoryBreakdown: Record<string, number>;
  };
  salonNetProfit: number;              // totalOwnerShare - totalExpenses
}

export interface StylistServiceItem {
  invoiceId: string;
  invoiceNumber: string;
  date: string;
  customerName: string;
  serviceName: string;
  amount: number;
  productCost: number;
  netAmount: number;
  stylistShare: number;
  ownerShare: number;
}

export interface StylistMonthlySettlement {
  staffId: string;
  staffName: string;
  role: string;
  status: string;
  servicesCount: number;
  visitsCount: number;
  grossServiceRevenue: number;
  productCostDeducted: number;
  netServiceRevenue: number;
  commissionRate: number;             // 0.50 (50%)
  currentEarnings: number;            // stylist share of net service revenue
  ownerShareContribution: number;     // 50% net service + 100% product cost

  // Balance Carry-Forward Ledger
  openingBalance: number;             // prior earnings - prior payments
  totalAvailablePayable: number;      // openingBalance + currentEarnings
  paymentsMadeThisMonth: number;      // regular payouts & advances paid by owner this month
  adjustmentsThisMonth: number;       // bonuses or adjustments this month
  closingBalance: number;             // openingBalance + currentEarnings + adjustments - paymentsMade

  settlementStatus: "settled" | "payable" | "advance";
  payoutsList: StaffDrawing[];
  serviceTransactions: StylistServiceItem[];
}

export interface MonthlyReportPayload {
  selectedMonth: string;
  overview: MonthlyRevenueSummary;
  stylistSettlements: StylistMonthlySettlement[];
  ownerSummary: {
    totalOwnerShare: number;
    totalStylistEarnings: number;
    totalOperatingExpenses: number;
    netSalonProfit: number;
    totalStaffPaymentsMade: number;
    totalOutstandingStaffPayables: number;
    totalStaffAdvanceCredits: number;
  };
}

/**
 * Extracts normalized YYYY-MM and YYYY-MM-DD from any invoice document.
 */
export function getInvoiceDateInfo(inv: any): { dateKey: string; monthKey: string } {
  let dateKey = "";
  if (inv.billDate) {
    const d = inv.billDate.toDate ? inv.billDate.toDate() : new Date(inv.billDate);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dateKey = `${yy}-${mm}-${dd}`;
  } else if (inv.date) {
    const d = inv.date.toDate ? inv.date.toDate() : new Date(inv.date);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dateKey = `${yy}-${mm}-${dd}`;
  } else if (inv.dateKey) {
    dateKey = inv.dateKey;
  } else if (inv.dateString) {
    dateKey = inv.dateString.slice(0, 10);
  } else {
    dateKey = new Date().toISOString().slice(0, 10);
  }

  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
  };
}

/**
 * Central pure computation function for Monthly Financial Reports.
 */
export function generateMonthlyReport(params: {
  selectedMonth: string; // "YYYY-MM"
  invoices: any[];
  staffDrawings: StaffDrawing[];
  expenses: Expense[];
  staffList: Staff[];
}): MonthlyReportPayload {
  const { selectedMonth, invoices, staffDrawings, expenses, staffList } = params;

  // 1. Initialize overview containers
  const overview: MonthlyRevenueSummary = {
    month: selectedMonth,
    totalInvoicedSales: 0,
    subtotal: 0,
    totalDiscounts: 0,
    totalProductSuppliesCost: 0,
    recognizedRevenue: 0,

    grossServiceRevenue: 0,
    netServiceRevenue: 0,
    retailProductsRevenue: 0,
    membershipFeesRevenue: 0,
    creditCollectionsRevenue: 0,

    collections: {
      totalCollected: 0,
      cash: 0,
      upi: 0,
      card: 0,
      advanceUsed: 0,
    },
    totalOutstandingReceivables: 0,

    allocation: {
      totalOwnerShare: 0,
      totalStylistShares: 0,
      ownerDirectServiceShare: 0,
      ownerNetServiceSplit: 0,
      ownerProductReimbursement: 0,
      ownerRetailShare: 0,
      ownerMembershipShare: 0,
      ownerCreditCollectionsShare: 0,
      reconciledTotal: 0,
      discrepancy: 0,
    },

    expenses: {
      totalExpenses: 0,
      categoryBreakdown: {},
    },
    salonNetProfit: 0,
  };

  // 2. Track stylist historical ledger across all time
  // staffId -> { priorEarnings, priorPayments, currentEarnings, currentPayments, currentAdjustments, currentServices, currentProductCost, serviceTransactions }
  interface StaffAccumulator {
    staffId: string;
    staffName: string;
    role: string;
    status: string;
    priorEarnings: number;
    priorPayments: number;
    currentEarnings: number;
    currentServicesRevenue: number;
    currentProductCost: number;
    currentServicesCount: number;
    currentVisitsCount: number;
    currentPayments: number;
    currentAdjustments: number;
    payoutsList: StaffDrawing[];
    serviceTransactions: StylistServiceItem[];
  }

  const staffMap: Record<string, StaffAccumulator> = {};

  // Register all known staff from staffList
  staffList.forEach((st) => {
    if (!st.id) return;
    staffMap[st.id] = {
      staffId: st.id,
      staffName: st.name,
      role: st.role || "Stylist",
      status: st.status || "Active",
      priorEarnings: 0,
      priorPayments: 0,
      currentEarnings: 0,
      currentServicesRevenue: 0,
      currentProductCost: 0,
      currentServicesCount: 0,
      currentVisitsCount: 0,
      currentPayments: 0,
      currentAdjustments: 0,
      payoutsList: [],
      serviceTransactions: [],
    };
  });

  const getOrCreateStaff = (staffId: string, staffName: string, role?: string): StaffAccumulator => {
    const id = staffId || staffName || "unassigned";
    if (!staffMap[id]) {
      staffMap[id] = {
        staffId: id,
        staffName: staffName || "Unassigned",
        role: role || (staffName === "System" ? "Owner" : "Stylist"),
        status: "Active",
        priorEarnings: 0,
        priorPayments: 0,
        currentEarnings: 0,
        currentServicesRevenue: 0,
        currentProductCost: 0,
        currentServicesCount: 0,
        currentVisitsCount: 0,
        currentPayments: 0,
        currentAdjustments: 0,
        payoutsList: [],
        serviceTransactions: [],
      };
    }
    return staffMap[id];
  };

  // 3. Process all invoices (partitioning prior vs current month)
  invoices.forEach((inv) => {
    const { dateKey, monthKey } = getInvoiceDateInfo(inv);
    const isCurrentMonth = monthKey === selectedMonth;
    const isPriorMonth = monthKey < selectedMonth;

    if (!isCurrentMonth && !isPriorMonth) {
      // Future month invoices (relative to selectedMonth) are ignored
      return;
    }

    const ratio = getInvoicePaymentRatio(inv);
    const payments = getInvoicePayments(inv);
    const advanceUsed = Number(inv.advanceUsed) || 0;
    const grandTotal = Number(inv.grandTotal) || 0;
    const subtotal = Number(inv.subtotal) || grandTotal;
    const discount = Number(inv.totalDiscount ?? inv.discount) || 0;
    const billDiscount = Number(inv.billDiscount) || 0;
    const discountFactor = subtotal > 0 ? grandTotal / subtotal : 1;

    // A. If Current Month, aggregate salon-level totals
    if (isCurrentMonth) {
      overview.totalInvoicedSales += grandTotal;
      overview.subtotal += subtotal;
      overview.totalDiscounts += discount + billDiscount;
      overview.totalOutstandingReceivables += Number(inv.balanceDue) || Math.max(0, grandTotal - ((payments.cash || 0) + (payments.upi || 0) + (payments.card || 0) + advanceUsed));

      overview.collections.cash += (payments.cash || 0);
      overview.collections.upi += (payments.upi || 0);
      overview.collections.card += (payments.card || 0);
      overview.collections.advanceUsed += advanceUsed;
      overview.collections.totalCollected += (payments.cash || 0) + (payments.upi || 0) + (payments.card || 0) + advanceUsed;

      // Credit collections (old customer debt settled this month)
      const invCollectedCredits: any[] = inv.collectedCredits || [];
      invCollectedCredits.forEach((cc: any) => {
        const amt = Number(cc.collectedAmount) || 0;
        overview.creditCollectionsRevenue += amt;
        overview.allocation.ownerCreditCollectionsShare += amt;
        overview.allocation.totalOwnerShare += amt;
      });

      // Retail products
      (inv.products || []).forEach((p: any) => {
        let amount: number;
        if (p.amount !== undefined && p.amount !== null) {
          amount = Number(p.amount);
        } else {
          const productBaseAmount = Math.max((Number(p.price) || 0) * (Number(p.quantity) || 1) - (Number(p.discount) || 0), 0);
          amount = productBaseAmount * discountFactor;
        }
        const recognizedRetail = amount * ratio;
        overview.retailProductsRevenue += recognizedRetail;
        overview.allocation.ownerRetailShare += recognizedRetail;
        overview.allocation.totalOwnerShare += recognizedRetail;
      });
    }

    // B. Process Services across prior and current months
    const visitedStaffOnThisInv = new Set<string>();

    (inv.services || []).forEach((s: any) => {
      const comm = getServiceCommission(s, inv);
      const staffId = s.staffId || "unassigned";
      const staffName = s.staffName || "Unassigned";
      const staffAcc = getOrCreateStaff(staffId, staffName, s.staffRole);
      const role = s.staffRole || staffAcc.role;

      // Membership fee service check
      if (s.serviceId === "membership_fee") {
        if (isCurrentMonth) {
          const memRevenue = comm.serviceRevenue * ratio;
          overview.membershipFeesRevenue += memRevenue;
          overview.allocation.ownerMembershipShare += memRevenue;
          overview.allocation.totalOwnerShare += memRevenue;
        }
        return;
      }

      const effectiveServiceRevenue = comm.serviceRevenue * ratio;
      const effectiveProductCost = comm.productCost * ratio;
      const effectiveStylistShare = comm.stylistShare * ratio;
      const effectiveOwnerShare = comm.ownerShare * ratio;

      if (isCurrentMonth) {
        overview.grossServiceRevenue += effectiveServiceRevenue;
        overview.totalProductSuppliesCost += effectiveProductCost;

        if (role === "Owner") {
          overview.allocation.ownerDirectServiceShare += effectiveOwnerShare;
          overview.allocation.totalOwnerShare += effectiveOwnerShare;
        } else {
          const netRemaining = effectiveServiceRevenue - effectiveProductCost;
          overview.allocation.ownerNetServiceSplit += 0.5 * netRemaining;
          overview.allocation.ownerProductReimbursement += effectiveProductCost;
          overview.allocation.totalOwnerShare += effectiveOwnerShare;
          overview.allocation.totalStylistShares += effectiveStylistShare;

          staffAcc.currentEarnings += effectiveStylistShare;
          staffAcc.currentServicesRevenue += effectiveServiceRevenue;
          staffAcc.currentProductCost += effectiveProductCost;
          staffAcc.currentServicesCount += 1;

          if (!visitedStaffOnThisInv.has(staffAcc.staffId)) {
            staffAcc.currentVisitsCount += 1;
            visitedStaffOnThisInv.add(staffAcc.staffId);
          }

          staffAcc.serviceTransactions.push({
            invoiceId: inv.id || "",
            invoiceNumber: inv.invoiceNumber || "—",
            date: dateKey,
            customerName: inv.customerName || "Walk-in Guest",
            serviceName: s.serviceName || "Service",
            amount: Math.round(effectiveServiceRevenue * 100) / 100,
            productCost: Math.round(effectiveProductCost * 100) / 100,
            netAmount: Math.round((effectiveServiceRevenue - effectiveProductCost) * 100) / 100,
            stylistShare: Math.round(effectiveStylistShare * 100) / 100,
            ownerShare: Math.round(effectiveOwnerShare * 100) / 100,
          });
        }
      } else if (isPriorMonth) {
        // Accumulate prior period earnings for opening balance
        if (role !== "Owner") {
          staffAcc.priorEarnings += effectiveStylistShare;
        }
      }
    });
  });

  // 4. Process all Staff Drawings / Payouts
  staffDrawings.forEach((drawing) => {
    const drawingMonth = drawing.month || (drawing.date ? drawing.date.slice(0, 7) : "");
    const isCurrentMonth = drawingMonth === selectedMonth;
    const isPriorMonth = drawingMonth < selectedMonth;

    const amt = Number(drawing.amount) || 0;
    const staffAcc = getOrCreateStaff(drawing.staffId, drawing.staffName);

    if (isCurrentMonth) {
      if (drawing.type === "adjustment") {
        staffAcc.currentAdjustments += amt;
      } else {
        staffAcc.currentPayments += amt;
      }
      staffAcc.payoutsList.push(drawing);
    } else if (isPriorMonth) {
      if (drawing.type === "adjustment") {
        staffAcc.priorEarnings += amt; // Positive adjustments add to prior balance
      } else {
        staffAcc.priorPayments += amt;
      }
    }
  });

  // 5. Process Operating Expenses for the Selected Month
  expenses.forEach((exp) => {
    const expDate = exp.date ? exp.date.slice(0, 7) : "";
    if (expDate === selectedMonth) {
      const amt = Number(exp.amount) || 0;
      overview.expenses.totalExpenses += amt;
      const cat = exp.category || "General";
      overview.expenses.categoryBreakdown[cat] = (overview.expenses.categoryBreakdown[cat] || 0) + amt;
    }
  });

  // 6. Finalize Overview metrics
  overview.netServiceRevenue = overview.grossServiceRevenue - overview.totalProductSuppliesCost;
  overview.recognizedRevenue =
    overview.grossServiceRevenue +
    overview.retailProductsRevenue +
    overview.membershipFeesRevenue +
    overview.creditCollectionsRevenue;

  overview.allocation.reconciledTotal =
    overview.allocation.totalOwnerShare + overview.allocation.totalStylistShares;
  overview.allocation.discrepancy =
    Math.round(Math.abs(overview.recognizedRevenue - overview.allocation.reconciledTotal) * 100) / 100;

  // Salon Net Profit = Owner Share - Operating Expenses
  overview.salonNetProfit = overview.allocation.totalOwnerShare - overview.expenses.totalExpenses;

  // Round summary figures to 2 decimal places
  overview.totalInvoicedSales = Math.round(overview.totalInvoicedSales * 100) / 100;
  overview.subtotal = Math.round(overview.subtotal * 100) / 100;
  overview.totalDiscounts = Math.round(overview.totalDiscounts * 100) / 100;
  overview.totalProductSuppliesCost = Math.round(overview.totalProductSuppliesCost * 100) / 100;
  overview.grossServiceRevenue = Math.round(overview.grossServiceRevenue * 100) / 100;
  overview.netServiceRevenue = Math.round(overview.netServiceRevenue * 100) / 100;
  overview.retailProductsRevenue = Math.round(overview.retailProductsRevenue * 100) / 100;
  overview.membershipFeesRevenue = Math.round(overview.membershipFeesRevenue * 100) / 100;
  overview.creditCollectionsRevenue = Math.round(overview.creditCollectionsRevenue * 100) / 100;
  overview.recognizedRevenue = Math.round(overview.recognizedRevenue * 100) / 100;

  overview.collections.totalCollected = Math.round(overview.collections.totalCollected * 100) / 100;
  overview.collections.cash = Math.round(overview.collections.cash * 100) / 100;
  overview.collections.upi = Math.round(overview.collections.upi * 100) / 100;
  overview.collections.card = Math.round(overview.collections.card * 100) / 100;
  overview.collections.advanceUsed = Math.round(overview.collections.advanceUsed * 100) / 100;
  overview.totalOutstandingReceivables = Math.round(overview.totalOutstandingReceivables * 100) / 100;

  overview.allocation.totalOwnerShare = Math.round(overview.allocation.totalOwnerShare * 100) / 100;
  overview.allocation.totalStylistShares = Math.round(overview.allocation.totalStylistShares * 100) / 100;
  overview.allocation.ownerDirectServiceShare = Math.round(overview.allocation.ownerDirectServiceShare * 100) / 100;
  overview.allocation.ownerNetServiceSplit = Math.round(overview.allocation.ownerNetServiceSplit * 100) / 100;
  overview.allocation.ownerProductReimbursement = Math.round(overview.allocation.ownerProductReimbursement * 100) / 100;
  overview.allocation.ownerRetailShare = Math.round(overview.allocation.ownerRetailShare * 100) / 100;
  overview.allocation.ownerMembershipShare = Math.round(overview.allocation.ownerMembershipShare * 100) / 100;
  overview.allocation.ownerCreditCollectionsShare = Math.round(overview.allocation.ownerCreditCollectionsShare * 100) / 100;
  overview.allocation.reconciledTotal = Math.round(overview.allocation.reconciledTotal * 100) / 100;

  overview.expenses.totalExpenses = Math.round(overview.expenses.totalExpenses * 100) / 100;
  overview.salonNetProfit = Math.round(overview.salonNetProfit * 100) / 100;

  // 7. Build Stylist Settlements with Opening & Closing Balances
  const stylistSettlements: StylistMonthlySettlement[] = [];

  let totalStaffPaymentsMade = 0;
  let totalOutstandingStaffPayables = 0;
  let totalStaffAdvanceCredits = 0;

  Object.values(staffMap).forEach((st) => {
    // Only report non-owner staff in the stylist settlement ledger
    if (st.role === "Owner") return;

    // Filter out inactive staff with zero activity and zero balances
    const hasActivity =
      st.currentServicesCount > 0 ||
      st.currentEarnings > 0 ||
      st.currentPayments > 0 ||
      st.currentAdjustments > 0 ||
      Math.abs(st.priorEarnings - st.priorPayments) > 0.01;

    if (!hasActivity && st.status === "Inactive") {
      return;
    }

    const openingBalance = Math.round((st.priorEarnings - st.priorPayments) * 100) / 100;
    const currentEarnings = Math.round(st.currentEarnings * 100) / 100;
    const totalAvailablePayable = Math.round((openingBalance + currentEarnings) * 100) / 100;
    const paymentsMadeThisMonth = Math.round(st.currentPayments * 100) / 100;
    const adjustmentsThisMonth = Math.round(st.currentAdjustments * 100) / 100;
    const closingBalance = Math.round((totalAvailablePayable + adjustmentsThisMonth - paymentsMadeThisMonth) * 100) / 100;

    let settlementStatus: "settled" | "payable" | "advance" = "settled";
    if (closingBalance > 0.5) {
      settlementStatus = "payable";
      totalOutstandingStaffPayables += closingBalance;
    } else if (closingBalance < -0.5) {
      settlementStatus = "advance";
      totalStaffAdvanceCredits += Math.abs(closingBalance);
    } else {
      settlementStatus = "settled";
    }

    totalStaffPaymentsMade += paymentsMadeThisMonth;

    stylistSettlements.push({
      staffId: st.staffId,
      staffName: st.staffName,
      role: st.role,
      status: st.status,
      servicesCount: st.currentServicesCount,
      visitsCount: st.currentVisitsCount,
      grossServiceRevenue: Math.round(st.currentServicesRevenue * 100) / 100,
      productCostDeducted: Math.round(st.currentProductCost * 100) / 100,
      netServiceRevenue: Math.round((st.currentServicesRevenue - st.currentProductCost) * 100) / 100,
      commissionRate: 0.5,
      currentEarnings,
      ownerShareContribution: Math.round(((st.currentServicesRevenue - st.currentProductCost) * 0.5 + st.currentProductCost) * 100) / 100,

      openingBalance,
      totalAvailablePayable,
      paymentsMadeThisMonth,
      adjustmentsThisMonth,
      closingBalance,
      settlementStatus,

      payoutsList: st.payoutsList,
      serviceTransactions: st.serviceTransactions,
    });
  });

  // Sort stylist settlements by gross earnings descending
  stylistSettlements.sort((a, b) => b.currentEarnings - a.currentEarnings);

  return {
    selectedMonth,
    overview,
    stylistSettlements,
    ownerSummary: {
      totalOwnerShare: overview.allocation.totalOwnerShare,
      totalStylistEarnings: overview.allocation.totalStylistShares,
      totalOperatingExpenses: overview.expenses.totalExpenses,
      netSalonProfit: overview.salonNetProfit,
      totalStaffPaymentsMade: Math.round(totalStaffPaymentsMade * 100) / 100,
      totalOutstandingStaffPayables: Math.round(totalOutstandingStaffPayables * 100) / 100,
      totalStaffAdvanceCredits: Math.round(totalStaffAdvanceCredits * 100) / 100,
    },
  };
}

/**
 * Generates formatted CSV string for the monthly report.
 */
export function generateMonthlyReportCSV(report: MonthlyReportPayload): string {
  const { overview, stylistSettlements, selectedMonth } = report;
  const lines: string[] = [];

  const esc = (val: any) => {
    const s = String(val ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  // Header Section
  lines.push(`"EXPLORE SALON MANAGEMENT - MONTHLY FINANCIAL & SETTLEMENT REPORT"`);
  lines.push(`"Report Month",${esc(selectedMonth)}`);
  lines.push(`"Generated At",${esc(new Date().toLocaleString())}`);
  lines.push("");

  // Section 1: Executive Overview
  lines.push(`"--- EXECUTIVE FINANCIAL SUMMARY ---"`);
  lines.push(`"Metric","Amount (INR)"`);
  lines.push(`"Total Invoiced Sales",${overview.totalInvoicedSales}`);
  lines.push(`"Recognized Service Revenue",${overview.grossServiceRevenue}`);
  lines.push(`"Service Supplies Cost Deducted",${overview.totalProductSuppliesCost}`);
  lines.push(`"Net Service Revenue",${overview.netServiceRevenue}`);
  lines.push(`"Retail Products Revenue",${overview.retailProductsRevenue}`);
  lines.push(`"Membership Fees Revenue",${overview.membershipFeesRevenue}`);
  lines.push(`"Past Credit Collections",${overview.creditCollectionsRevenue}`);
  lines.push(`"Total Actual Collections",${overview.collections.totalCollected}`);
  lines.push(`"  - Cash Collections",${overview.collections.cash}`);
  lines.push(`"  - UPI Collections",${overview.collections.upi}`);
  lines.push(`"  - Card Collections",${overview.collections.card}`);
  lines.push(`"  - Advance Balance Used",${overview.collections.advanceUsed}`);
  lines.push(`"Outstanding Customer Receivables",${overview.totalOutstandingReceivables}`);
  lines.push("");

  // Section 2: Revenue Allocation & Profit
  lines.push(`"--- REVENUE SHARING & PROFIT ALLOCATION ---"`);
  lines.push(`"Total Stylist Commissions (50% Net)",${overview.allocation.totalStylistShares}`);
  lines.push(`"Total Owner Net Revenue Allocation",${overview.allocation.totalOwnerShare}`);
  lines.push(`"  - Owner 50% Net Service Split",${overview.allocation.ownerNetServiceSplit}`);
  lines.push(`"  - Owner 100% Supply Reimbursement",${overview.allocation.ownerProductReimbursement}`);
  lines.push(`"  - Owner Direct Services (100%)",${overview.allocation.ownerDirectServiceShare}`);
  lines.push(`"  - Retail Sales Allocation (100%)",${overview.allocation.ownerRetailShare}`);
  lines.push(`"  - Membership Fees Allocation (100%)",${overview.allocation.ownerMembershipShare}`);
  lines.push(`"  - Credit Collections Allocation (100%)",${overview.allocation.ownerCreditCollectionsShare}`);
  lines.push(`"Total Operating Expenses",${overview.expenses.totalExpenses}`);
  lines.push(`"Salon Net Business Profit (Owner Share - Expenses)",${overview.salonNetProfit}`);
  lines.push(`"Allocation Discrepancy",${overview.allocation.discrepancy}`);
  lines.push("");

  // Section 3: Stylist Performance & Commissions
  lines.push(`"--- STYLIST COMMISSION BREAKDOWN ---"`);
  lines.push(`"Stylist Name","Role","Services Count","Gross Revenue","Supplies Cost","Net Revenue","Stylist 50% Share","Owner Share Contribution"`);
  stylistSettlements.forEach((st) => {
    lines.push([
      esc(st.staffName),
      esc(st.role),
      st.servicesCount,
      st.grossServiceRevenue,
      st.productCostDeducted,
      st.netServiceRevenue,
      st.currentEarnings,
      st.ownerShareContribution,
    ].join(","));
  });
  lines.push("");

  // Section 4: Stylist Financial Settlement Ledger
  lines.push(`"--- STYLIST FINANCIAL SETTLEMENT LEDGER ---"`);
  lines.push(`"Stylist Name","Opening Balance (B/F)","Month Earnings","Adjustments","Total Available Payable","Payments Made (Drawings)","Closing Balance","Settlement Status"`);
  stylistSettlements.forEach((st) => {
    lines.push([
      esc(st.staffName),
      st.openingBalance,
      st.currentEarnings,
      st.adjustmentsThisMonth,
      st.totalAvailablePayable,
      st.paymentsMadeThisMonth,
      st.closingBalance,
      esc(st.settlementStatus.toUpperCase()),
    ].join(","));
  });
  lines.push("");

  // Section 5: Payouts List
  lines.push(`"--- PAYOUTS & STAFF DRAWINGS THIS MONTH ---"`);
  lines.push(`"Date","Stylist Name","Amount","Type","Payment Method","Reference Number","Notes"`);
  let hasPayouts = false;
  stylistSettlements.forEach((st) => {
    st.payoutsList.forEach((p) => {
      hasPayouts = true;
      lines.push([
        esc(p.date),
        esc(p.staffName),
        p.amount,
        esc(p.type || "payout"),
        esc(p.paymentMethod || "Cash"),
        esc(p.referenceNumber || ""),
        esc(p.note || ""),
      ].join(","));
    });
  });
  if (!hasPayouts) {
    lines.push(`"No payouts recorded this month"`);
  }

  return lines.join("\n");
}

export function downloadMonthlyReportCSV(report: MonthlyReportPayload): void {
  const csvContent = generateMonthlyReportCSV(report);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Explore_Monthly_Report_${report.selectedMonth}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
