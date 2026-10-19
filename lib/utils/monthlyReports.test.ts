import { generateMonthlyReport } from "./monthlyReports";
import type { StaffDrawing } from "@/services/staffDrawings";
import type { Expense } from "@/types/expense";
import type { Staff } from "@/types/staff";

function assertEqual(actual: number, expected: number, message: string) {
  if (Math.abs(Number(actual) - Number(expected)) > 0.01) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function runMonthlyReportTests() {
  console.log("=== RUNNING MONTHLY REPORTS & FINANCIAL SETTLEMENT TESTS ===");

  const testStaff: Staff[] = [
    { id: "staff_rehan", name: "Rehan", role: "Stylist", status: "Active" },
    { id: "staff_sohail", name: "Sohail", role: "Stylist", status: "Active" },
    { id: "staff_owner", name: "Zubair", role: "Owner", status: "Active" },
  ];

  // Test 1: Standard Revenue Sharing & Product Cost Reimbursement
  {
    const invoices = [
      {
        id: "inv_1",
        invoiceNumber: "EXP-261001-001",
        dateKey: "2026-10-05",
        subtotal: 10000,
        grandTotal: 10000,
        paymentSplit: { cash: 10000, upi: 0, card: 0 },
        services: [
          {
            serviceName: "Hair Treatment",
            staffId: "staff_rehan",
            staffName: "Rehan",
            amount: 10000,
            usedProductCost: 1000,
          },
        ],
      },
    ];

    const report = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices,
      staffDrawings: [],
      expenses: [],
      staffList: testStaff,
    });

    assertEqual(report.overview.totalInvoicedSales, 10000, "Test 1: Invoiced sales ₹10000");
    assertEqual(report.overview.grossServiceRevenue, 10000, "Test 1: Gross service revenue ₹10000");
    assertEqual(report.overview.totalProductSuppliesCost, 1000, "Test 1: Supply cost ₹1000");
    assertEqual(report.overview.netServiceRevenue, 9000, "Test 1: Net service revenue ₹9000");

    // Stylist gets 50% of ₹9,000 = ₹4,500
    assertEqual(report.overview.allocation.totalStylistShares, 4500, "Test 1: Total Stylist Share ₹4500");
    // Owner gets 50% of ₹9,000 (₹4,500) + ₹1,000 product supply reimbursement = ₹5,500
    assertEqual(report.overview.allocation.totalOwnerShare, 5500, "Test 1: Total Owner Share ₹5500");
    assertEqual(report.overview.allocation.discrepancy, 0, "Test 1: Allocation discrepancy is ₹0");
  }

  // Test 2: Owner Services, Retail Products, and Membership Fees
  {
    const invoices = [
      {
        id: "inv_owner_service",
        dateKey: "2026-10-10",
        subtotal: 5000,
        grandTotal: 5000,
        paymentSplit: { upi: 5000, cash: 0, card: 0 },
        services: [
          {
            serviceName: "VIP Styling by Owner",
            staffId: "staff_owner",
            staffName: "Zubair",
            staffRole: "Owner",
            amount: 5000,
            usedProductCost: 500,
          },
        ],
      },
      {
        id: "inv_retail_and_mem",
        dateKey: "2026-10-12",
        subtotal: 3500,
        grandTotal: 3500,
        paymentSplit: { card: 3500, cash: 0, upi: 0 },
        services: [
          {
            serviceId: "membership_fee",
            serviceName: "Annual Membership Fee",
            amount: 1500,
          },
        ],
        products: [
          {
            productName: "Serum",
            amount: 2000,
          },
        ],
      },
    ];

    const report = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices,
      staffDrawings: [],
      expenses: [],
      staffList: testStaff,
    });

    assertEqual(report.overview.allocation.ownerDirectServiceShare, 5000, "Test 2: Owner direct service 100% = ₹5000");
    assertEqual(report.overview.retailProductsRevenue, 2000, "Test 2: Retail revenue = ₹2000");
    assertEqual(report.overview.membershipFeesRevenue, 1500, "Test 2: Membership revenue = ₹1500");
    assertEqual(report.overview.allocation.totalStylistShares, 0, "Test 2: Stylist share from Owner/Retail/Membership is ₹0");
    assertEqual(report.overview.allocation.totalOwnerShare, 8500, "Test 2: Total owner allocation = ₹8500");
  }

  // Test 3: Month-to-Month Opening and Closing Balance Carry Forward
  // Month 1 (October): Rehan earns ₹30,000, owner pays ₹22,000 -> Closing balance = ₹8,000 payable.
  // Month 2 (November): Opening balance = ₹8,000. Rehan earns ₹25,000 (total payable ₹33,000). Owner pays ₹35,000 -> Closing balance = -₹2,000 (advance).
  // Month 3 (December): Opening balance = -₹2,000 (advance). Rehan earns ₹20,000 (net payable ₹18,000). Owner pays ₹18,000 -> Closing balance = ₹0 (settled).
  {
    const invoicesAllMonths = [
      // October 2026
      {
        id: "inv_oct",
        dateKey: "2026-10-15",
        grandTotal: 60000,
        subtotal: 60000,
        paymentSplit: { upi: 60000, cash: 0, card: 0 },
        services: [
          {
            serviceName: "Keratin Treatment",
            staffId: "staff_rehan",
            staffName: "Rehan",
            amount: 60000,
            usedProductCost: 0, // Net 60,000 -> Rehan gets 50% = 30,000
          },
        ],
      },
      // November 2026
      {
        id: "inv_nov",
        dateKey: "2026-11-15",
        grandTotal: 50000,
        subtotal: 50000,
        paymentSplit: { upi: 50000, cash: 0, card: 0 },
        services: [
          {
            serviceName: "Coloring",
            staffId: "staff_rehan",
            staffName: "Rehan",
            amount: 50000,
            usedProductCost: 0, // Net 50,000 -> Rehan gets 50% = 25,000
          },
        ],
      },
      // December 2026
      {
        id: "inv_dec",
        dateKey: "2026-12-15",
        grandTotal: 40000,
        subtotal: 40000,
        paymentSplit: { cash: 40000, upi: 0, card: 0 },
        services: [
          {
            serviceName: "Spa",
            staffId: "staff_rehan",
            staffName: "Rehan",
            amount: 40000,
            usedProductCost: 0, // Net 40,000 -> Rehan gets 50% = 20,000
          },
        ],
      },
    ];

    const drawingsAllMonths: StaffDrawing[] = [
      // October: 2 payouts (₹10,000 + ₹12,000 = ₹22,000)
      {
        id: "draw_1",
        staffId: "staff_rehan",
        staffName: "Rehan",
        amount: 10000,
        date: "2026-10-10",
        month: "2026-10",
        paymentMethod: "Bank Transfer",
        type: "payout",
      },
      {
        id: "draw_2",
        staffId: "staff_rehan",
        staffName: "Rehan",
        amount: 12000,
        date: "2026-10-25",
        month: "2026-10",
        paymentMethod: "UPI",
        type: "payout",
      },
      // November: Payout of ₹35,000 (resulting in ₹2,000 advance)
      {
        id: "draw_3",
        staffId: "staff_rehan",
        staffName: "Rehan",
        amount: 35000,
        date: "2026-11-28",
        month: "2026-11",
        paymentMethod: "Bank Transfer",
        type: "payout",
      },
      // December: Payout of ₹18,000 (settling remaining balance to 0)
      {
        id: "draw_4",
        staffId: "staff_rehan",
        staffName: "Rehan",
        amount: 18000,
        date: "2026-12-30",
        month: "2026-12",
        paymentMethod: "Cash",
        type: "payout",
      },
    ];

    // Check October
    const octReport = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices: invoicesAllMonths,
      staffDrawings: drawingsAllMonths,
      expenses: [],
      staffList: testStaff,
    });

    const rehanOct = octReport.stylistSettlements.find((s) => s.staffId === "staff_rehan")!;
    assertEqual(rehanOct.openingBalance, 0, "Test 3a (Oct): Opening balance should be ₹0");
    assertEqual(rehanOct.currentEarnings, 30000, "Test 3a (Oct): Earnings should be ₹30000");
    assertEqual(rehanOct.paymentsMadeThisMonth, 22000, "Test 3a (Oct): Payments should be ₹22000");
    assertEqual(rehanOct.closingBalance, 8000, "Test 3a (Oct): Closing balance should be ₹8000 (payable)");
    assertEqual(rehanOct.settlementStatus === "payable" ? 1 : 0, 1, "Test 3a (Oct): Status should be 'payable'");

    // Check November
    const novReport = generateMonthlyReport({
      selectedMonth: "2026-11",
      invoices: invoicesAllMonths,
      staffDrawings: drawingsAllMonths,
      expenses: [],
      staffList: testStaff,
    });

    const rehanNov = novReport.stylistSettlements.find((s) => s.staffId === "staff_rehan")!;
    assertEqual(rehanNov.openingBalance, 8000, "Test 3b (Nov): Opening balance strictly matches Oct closing (₹8000)");
    assertEqual(rehanNov.currentEarnings, 25000, "Test 3b (Nov): Earnings should be ₹25000");
    assertEqual(rehanNov.totalAvailablePayable, 33000, "Test 3b (Nov): Total available payable ₹33000");
    assertEqual(rehanNov.paymentsMadeThisMonth, 35000, "Test 3b (Nov): Payments should be ₹35000");
    assertEqual(rehanNov.closingBalance, -2000, "Test 3b (Nov): Closing balance should be -₹2000 (advance/overpaid)");
    assertEqual(rehanNov.settlementStatus === "advance" ? 1 : 0, 1, "Test 3b (Nov): Status should be 'advance'");

    // Check December
    const decReport = generateMonthlyReport({
      selectedMonth: "2026-12",
      invoices: invoicesAllMonths,
      staffDrawings: drawingsAllMonths,
      expenses: [],
      staffList: testStaff,
    });

    const rehanDec = decReport.stylistSettlements.find((s) => s.staffId === "staff_rehan")!;
    assertEqual(rehanDec.openingBalance, -2000, "Test 3c (Dec): Opening balance strictly carries forward advance (-₹2000)");
    assertEqual(rehanDec.currentEarnings, 20000, "Test 3c (Dec): Earnings should be ₹20000");
    assertEqual(rehanDec.totalAvailablePayable, 18000, "Test 3c (Dec): Available payable after advance offset = ₹18000");
    assertEqual(rehanDec.paymentsMadeThisMonth, 18000, "Test 3c (Dec): Payments should be ₹18000");
    assertEqual(rehanDec.closingBalance, 0, "Test 3c (Dec): Closing balance should be ₹0 (fully settled)");
    assertEqual(rehanDec.settlementStatus === "settled" ? 1 : 0, 1, "Test 3c (Dec): Status should be 'settled'");
  }

  // Test 4: Partial Payment Ratio
  // Invoice for ₹10,000, but customer only paid ₹5,000 cash. Payment ratio = 0.5.
  // Service amount ₹10,000, supply cost ₹1,000.
  // Recognized service revenue = 10,000 * 0.5 = 5,000.
  // Recognized product cost = 1,000 * 0.5 = 500.
  // Stylist share = (5,000 - 500) * 0.5 = ₹2,250.
  // Owner share = (5,000 - 500) * 0.5 + 500 = ₹2,750.
  // Total recognized = 2,250 + 2,750 = ₹5,000.
  {
    const invoices = [
      {
        id: "inv_partial",
        dateKey: "2026-10-20",
        subtotal: 10000,
        grandTotal: 10000,
        paymentSplit: { cash: 5000, upi: 0, card: 0 },
        balanceDue: 5000,
        services: [
          {
            serviceName: "Hair Straightening",
            staffId: "staff_sohail",
            staffName: "Sohail",
            amount: 10000,
            usedProductCost: 1000,
          },
        ],
      },
    ];

    const report = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices,
      staffDrawings: [],
      expenses: [],
      staffList: testStaff,
    });

    assertEqual(report.overview.collections.totalCollected, 5000, "Test 4: Total collected is ₹5000");
    assertEqual(report.overview.totalOutstandingReceivables, 5000, "Test 4: Outstanding receivables is ₹5000");
    assertEqual(report.overview.grossServiceRevenue, 5000, "Test 4: Recognized service revenue is ₹5000");
    assertEqual(report.overview.allocation.totalStylistShares, 2250, "Test 4: Stylist share scaled by ratio is ₹2250");
    assertEqual(report.overview.allocation.totalOwnerShare, 2750, "Test 4: Owner share scaled by ratio is ₹2750");
    assertEqual(report.overview.allocation.discrepancy, 0, "Test 4: Partial payment reconciles with ₹0 discrepancy");
  }

  // Test 5: Operating Expenses & Salon Net Profit
  {
    const invoices = [
      {
        id: "inv_exp_test",
        dateKey: "2026-10-01",
        grandTotal: 20000,
        subtotal: 20000,
        paymentSplit: { upi: 20000, cash: 0, card: 0 },
        services: [
          {
            serviceName: "Full Makeover",
            staffId: "staff_rehan",
            staffName: "Rehan",
            amount: 20000,
            usedProductCost: 2000, // Net 18,000 -> Rehan gets 9,000, Owner gets 11,000
          },
        ],
      },
    ];

    const expenses: Expense[] = [
      {
        id: "exp_1",
        description: "Electricity Bill",
        amount: 3000,
        date: "2026-10-05",
        category: "Utilities",
        type: "monthly",
      },
      {
        id: "exp_2",
        description: "Salon Rent",
        amount: 5000,
        date: "2026-10-01",
        category: "Rent",
        type: "monthly",
      },
    ];

    const report = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices,
      staffDrawings: [],
      expenses,
      staffList: testStaff,
    });

    assertEqual(report.overview.allocation.totalOwnerShare, 11000, "Test 5: Owner share is ₹11000");
    assertEqual(report.overview.expenses.totalExpenses, 8000, "Test 5: Total expenses ₹8000");
    // Salon Net Profit = Owner Share (₹11,000) - Expenses (₹8,000) = ₹3,000
    assertEqual(report.overview.salonNetProfit, 3000, "Test 5: Salon Net Profit is ₹3000 (Owner Share ₹11000 - Expenses ₹8000)");
  }

  console.log("=== ALL MONTHLY REPORT TESTS COMPLETED SUCCESSFULLY ===");
}

runMonthlyReportTests();
