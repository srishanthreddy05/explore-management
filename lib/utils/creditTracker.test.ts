import { buildUnifiedCreditTracker, getInvoiceRemainingBalance, allocateCreditPayment } from "./creditTracker";
import { generateMonthlyReport } from "./monthlyReports";
import type { CreditBalance } from "@/types/creditBalance";
import type { Invoice } from "@/types/invoice";
import type { Staff } from "@/types/staff";

function assertEqual(actual: any, expected: any, message: string) {
  if (typeof actual === "number" && typeof expected === "number") {
    if (Math.abs(Number(actual) - Number(expected)) > 0.001) {
      console.error(`❌ FAILED: ${message}`);
      console.error(`   Expected: ${expected}, Got: ${actual}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  } else if (actual !== expected) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

export function runCreditTrackerTests() {
  console.log("=== RUNNING OUTSTANDING CREDITS & PAYMENT COLLECTION TEST SUITE ===");

  const testStaff: Staff[] = [
    { id: "staff_owner", name: "Zubair", role: "Owner", status: "Active" },
    { id: "staff_stylist", name: "Sohail", role: "Stylist", status: "Active" },
  ];

  // =========================================================================
  // SCENARIO 1: An invoice of ₹600 with ₹500 received and ₹100 due (Rahul, EXP-261025-012)
  // =========================================================================
  {
    console.log("\n--- Scenario 1: Rahul EXP-261025-012 (Total ₹600, Paid ₹500, Due ₹100) ---");
    const creditBalances: CreditBalance[] = [
      {
        id: "cred_rahul",
        originalInvoiceId: "inv_rahul",
        originalInvoiceNumber: "EXP-261025-012",
        originalBillDate: "2026-10-25",
        customerId: "cust_rahul",
        customerName: "Rahul",
        creditAmount: 100,
        remainingAmount: 100,
        status: "pending",
        collectionStatus: "pending",
      } as any,
    ];

    const invoices: Invoice[] = [
      {
        id: "inv_rahul",
        invoiceNumber: "EXP-261025-012",
        customerName: "Rahul",
        grandTotal: 600,
        receivedAmount: 500,
        balanceDue: 100,
        paymentStatus: "partial",
        dateKey: "2026-10-25",
      } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 1, "Scenario 1: Exactly one row displayed");
    assertEqual(result.items[0].invoiceNumber, "EXP-261025-012", "Scenario 1: Invoice number matches");
    assertEqual(result.items[0].total, 600, "Scenario 1: Invoice grand total is ₹600 (not credit ledger ₹100)");
    assertEqual(result.items[0].paid, 500, "Scenario 1: Paid amount is ₹500 (not ₹0)");
    assertEqual(result.items[0].due, 100, "Scenario 1: Due balance is ₹100");
    assertEqual(result.items[0].collectionStatus, "partial", "Scenario 1: Status is partial");
  }

  // =========================================================================
  // SCENARIO 2: An invoice of ₹1,300 with ₹1,000 received and ₹300 due (Prathyuman, EXP-261002-018)
  // =========================================================================
  {
    console.log("\n--- Scenario 2: Prathyuman EXP-261002-018 (Total ₹1,300, Paid ₹1,000, Due ₹300) ---");
    const creditBalances: CreditBalance[] = [
      {
        id: "cred_prathyuman",
        originalInvoiceId: "inv_prath",
        originalInvoiceNumber: "EXP-261002-018",
        originalBillDate: "2026-10-02",
        customerId: "cust_prath",
        customerName: "Prathyuman",
        creditAmount: 300,
        remainingAmount: 300,
        status: "pending",
        collectionStatus: "pending",
      } as any,
    ];

    const invoices: Invoice[] = [
      {
        id: "inv_prath",
        invoiceNumber: "EXP-261002-018",
        customerName: "Prathyuman",
        grandTotal: 1300,
        receivedAmount: 1000,
        balanceDue: 300,
        paymentStatus: "partial",
        dateKey: "2026-10-02",
      } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 1, "Scenario 2: Exactly one row displayed");
    assertEqual(result.items[0].total, 1300, "Scenario 2: Total is authoritative ₹1,300");
    assertEqual(result.items[0].paid, 1000, "Scenario 2: Paid is authoritative ₹1,000");
    assertEqual(result.items[0].due, 300, "Scenario 2: Due is authoritative ₹300");
  }

  // =========================================================================
  // SCENARIO 3: An invoice with multiple credit ledger records that must appear as one row (Linga Swami, EXP-260730-005)
  // =========================================================================
  {
    console.log("\n--- Scenario 3: Multiple Credit Ledger Records Merged (EXP-260730-005) ---");
    const creditBalances: CreditBalance[] = [
      {
        id: "cred_doc_1",
        originalInvoiceId: "inv_0730",
        originalInvoiceNumber: "EXP-260730-005",
        originalBillDate: "2026-07-30",
        customerName: "Linga Swami",
        creditAmount: 100,
        remainingAmount: 100,
        collectionStatus: "pending",
        status: "pending",
      } as any,
      {
        id: "cred_doc_2",
        originalInvoiceId: "inv_0730",
        originalInvoiceNumber: "EXP-260730-005",
        originalBillDate: "2026-07-30",
        customerName: "Linga Swami",
        creditAmount: 200,
        remainingAmount: 200,
        collectionStatus: "pending",
        status: "pending",
      } as any,
    ];

    const invoices: Invoice[] = [
      {
        id: "inv_0730",
        invoiceNumber: "EXP-260730-005",
        grandTotal: 300,
        balanceDue: 300,
        customerName: "Linga Swami",
        paymentStatus: "unpaid",
      } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 1, "Scenario 3: Exactly ONE visible row rendered for multiple ledger docs");
    assertEqual(result.items[0].creditDocIds.length, 2, "Scenario 3: Both underlying credit document IDs preserved");
    assertEqual(result.items[0].creditDocIds.includes("cred_doc_1"), true, "Scenario 3: Contains doc 1 ID");
    assertEqual(result.items[0].creditDocIds.includes("cred_doc_2"), true, "Scenario 3: Contains doc 2 ID");
    assertEqual(result.items[0].total, 300, "Scenario 3: Consolidated total is ₹300");
    assertEqual(result.items[0].due, 300, "Scenario 3: Consolidated due is ₹300");
    assertEqual(result.totalDue, 300, "Scenario 3: Total due summary is ₹300");
  }

  // =========================================================================
  // SCENARIO 4: Fully settled records excluded from the outstanding list
  // =========================================================================
  {
    console.log("\n--- Scenario 4: Fully Settled Records Excluded ---");
    const creditBalances: CreditBalance[] = [
      {
        id: "cred_settled_exp0716",
        originalInvoiceId: "inv_0716",
        originalInvoiceNumber: "EXP-260716-008",
        creditAmount: 500,
        remainingAmount: 0, // Fully settled credit record
        status: "settled",
        collectionStatus: "settled",
      } as any,
    ];

    const invoices: Invoice[] = [
      {
        id: "inv_0716",
        invoiceNumber: "EXP-260716-008",
        grandTotal: 500,
        receivedAmount: 500,
        balanceDue: 0,
        paymentStatus: "paid",
      } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 0, "Scenario 4: Fully settled records with zero remaining balance are excluded");
    assertEqual(result.totalDue, 0, "Scenario 4: Total due is ₹0");
  }

  // =========================================================================
  // SCENARIO 5: Multiple partial payments without double counting
  // =========================================================================
  {
    console.log("\n--- Scenario 5: Multiple Partial Payments Without Double Counting ---");
    const invoices: Invoice[] = [
      {
        id: "inv_multi_part",
        invoiceNumber: "EXP-261015-001",
        grandTotal: 1000,
        receivedAmount: 600, // 400 initial + 200 collected later
        balanceDue: 400,
        paymentStatus: "partial",
        creditPaymentHistory: [
          {
            collectedAt: "2026-10-20T10:00:00Z",
            collectedAmount: 200,
            remainingBalance: 400,
          },
        ],
      } as any,
    ];

    const creditBalances: CreditBalance[] = [
      {
        id: "cred_multi_part",
        originalInvoiceId: "inv_multi_part",
        originalInvoiceNumber: "EXP-261015-001",
        creditAmount: 600,
        remainingAmount: 400,
        status: "pending",
        collectionStatus: "partial",
      } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 1, "Scenario 5: 1 invoice row rendered");
    assertEqual(result.items[0].total, 1000, "Scenario 5: Total is ₹1,000");
    assertEqual(result.items[0].due, 400, "Scenario 5: Due is ₹400");
    assertEqual(result.items[0].paid, 600, "Scenario 5: Paid is ₹600 (not 600 + 200 = 800)");
    assertEqual(result.items[0].paid + result.items[0].due, result.items[0].total, "Scenario 5: Paid + Due equals Total");
  }

  // =========================================================================
  // SCENARIO 6: Legacy records missing optional payment fields
  // =========================================================================
  {
    console.log("\n--- Scenario 6: Legacy Records Missing Optional Payment Fields ---");
    // Legacy invoice with missing balanceDue & receivedAmount, only paymentSplit present
    const legacyInv1: Invoice = {
      id: "inv_legacy_1",
      invoiceNumber: "EXP-260711-012",
      grandTotal: 500,
      paymentSplit: { cash: 200, upi: 0, card: 0 },
      paymentStatus: "partial",
    } as any;
    assertEqual(getInvoiceRemainingBalance(legacyInv1), 300, "Scenario 6: Fallback computes 500 - 200 = ₹300 due");

    // Legacy invoice with missing balanceDue & paymentSplit, only paymentStatus: "unpaid"
    const legacyInv2: Invoice = {
      id: "inv_legacy_2",
      invoiceNumber: "EXP-260711-015",
      grandTotal: 400,
      paymentStatus: "unpaid",
    } as any;
    assertEqual(getInvoiceRemainingBalance(legacyInv2), 400, "Scenario 6: Unpaid status falls back to grandTotal ₹400");

    // Legacy credit balance missing remainingAmount, falling back to amount
    const legacyCredit: CreditBalance = {
      id: "c_legacy",
      originalInvoiceId: "inv_legacy_2",
      originalInvoiceNumber: "EXP-260711-015",
      amount: 400,
      status: "pending",
      collectionStatus: "pending",
    } as any;
    const result = buildUnifiedCreditTracker([legacyCredit], [legacyInv2]);
    assertEqual(result.items[0].due, 400, "Scenario 6: Credit tracker properly handles missing remainingAmount");
  }

  // =========================================================================
  // SCENARIO 7: Invoice and ledger balances that disagree
  // =========================================================================
  {
    console.log("\n--- Scenario 7: Invoice and Ledger Balance Disagreements ---");
    // Case A: Invoice is paid in salon, but credit ledger was left pending
    const paidInv: Invoice = {
      id: "inv_agree_paid",
      invoiceNumber: "EXP-260810-001",
      grandTotal: 500,
      balanceDue: 0,
      paymentStatus: "paid",
    } as any;
    const staleCredit: CreditBalance = {
      id: "c_stale",
      originalInvoiceId: "inv_agree_paid",
      originalInvoiceNumber: "EXP-260810-001",
      creditAmount: 500,
      remainingAmount: 500, // Stale!
      status: "pending",
    } as any;
    const resA = buildUnifiedCreditTracker([staleCredit], [paidInv]);
    assertEqual(resA.items.length, 0, "Scenario 7A: Authoritative invoice balanceDue:0 overrides stale credit ledger");

    // Case B: Invoice partially paid in POS, credit ledger has higher remaining
    const partialInv: Invoice = {
      id: "inv_agree_part",
      invoiceNumber: "EXP-260810-002",
      grandTotal: 500,
      balanceDue: 150,
      paymentStatus: "partial",
    } as any;
    const higherCredit: CreditBalance = {
      id: "c_higher",
      originalInvoiceId: "inv_agree_part",
      originalInvoiceNumber: "EXP-260810-002",
      creditAmount: 500,
      remainingAmount: 200, // Disagrees with invoice 150
      status: "pending",
    } as any;
    const resB = buildUnifiedCreditTracker([higherCredit], [partialInv]);
    assertEqual(resB.items[0].due, 150, "Scenario 7B: Reconciles to authoritative smaller balance (₹150)");

    // Case C: Credit ledger covers single service of ₹100 on ₹400 invoice
    const lineItemCredit: CreditBalance = {
      id: "c_line",
      originalInvoiceId: "inv_line",
      originalInvoiceNumber: "EXP-260810-003",
      creditAmount: 100,
      remainingAmount: 100,
      status: "pending",
    } as any;
    const parentInv: Invoice = {
      id: "inv_line",
      invoiceNumber: "EXP-260810-003",
      grandTotal: 400,
      balanceDue: 400,
      paymentStatus: "unpaid",
    } as any;
    const resC = buildUnifiedCreditTracker([lineItemCredit], [parentInv]);
    assertEqual(resC.items[0].due, 100, "Scenario 7C: Credit ledger line item debt of ₹100 respected");
  }

  // =========================================================================
  // SCENARIO 8: Total Due matching the sum of unique invoice-level balances
  // =========================================================================
  {
    console.log("\n--- Scenario 8: Total Due Matching Sum of Unique Invoice-Level Balances ---");
    const creditBalances: CreditBalance[] = [
      { id: "c1", originalInvoiceId: "i1", originalInvoiceNumber: "EXP-261025-012", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c2", originalInvoiceId: "i2", originalInvoiceNumber: "EXP-261018-006", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c3", originalInvoiceId: "i3", originalInvoiceNumber: "EXP-261002-018", creditAmount: 300, remainingAmount: 300, status: "pending" } as any,
      { id: "c4a", originalInvoiceId: "i4", originalInvoiceNumber: "EXP-260730-005", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c4b", originalInvoiceId: "i4", originalInvoiceNumber: "EXP-260730-005", creditAmount: 200, remainingAmount: 200, status: "pending" } as any,
    ];

    const invoices: Invoice[] = [
      { id: "i1", invoiceNumber: "EXP-261025-012", grandTotal: 600, balanceDue: 100, paymentStatus: "partial" } as any,
      { id: "i2", invoiceNumber: "EXP-261018-006", grandTotal: 600, balanceDue: 100, paymentStatus: "partial" } as any,
      { id: "i3", invoiceNumber: "EXP-261002-018", grandTotal: 1300, balanceDue: 300, paymentStatus: "partial" } as any,
      { id: "i4", invoiceNumber: "EXP-260730-005", grandTotal: 300, balanceDue: 300, paymentStatus: "unpaid" } as any,
      // Plus an unlinked unpaid invoice
      { id: "i5_unlinked", invoiceNumber: "EXP-261026-099", grandTotal: 200, balanceDue: 200, paymentStatus: "unpaid" } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, invoices);
    assertEqual(result.items.length, 5, "Scenario 8: Exactly 5 unique invoices");
    const sumOfItems = result.items.reduce((s, it) => s + it.due, 0);
    assertEqual(result.totalDue, 1000, "Scenario 8: Total due is ₹1,000 (100 + 100 + 300 + 300 + 200)");
    assertEqual(result.totalDue, sumOfItems, "Scenario 8: Total Due strictly equals sum of displayed rows");
  }

  // =========================================================================
  // SCENARIO 9: Identical calculations across every Outstanding Credits component
  // =========================================================================
  {
    console.log("\n--- Scenario 9: Parity Between CreditTracker Drawer and Payments Page ---");
    const creditBalances: CreditBalance[] = [
      { id: "c1", originalInvoiceId: "i1", originalInvoiceNumber: "EXP-261025-012", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
    ];
    const invoices: Invoice[] = [
      { id: "i1", invoiceNumber: "EXP-261025-012", grandTotal: 600, receivedAmount: 500, balanceDue: 100 } as any,
    ];

    // Simulate drawer calculation (CreditTracker component)
    const drawerSummary = buildUnifiedCreditTracker(creditBalances, invoices);

    // Simulate payments page calculation (PaymentsPage component)
    const pageSummary = buildUnifiedCreditTracker(creditBalances, invoices);

    assertEqual(drawerSummary.totalDue, pageSummary.totalDue, "Scenario 9: Total due matches across drawer and page");
    assertEqual(drawerSummary.totalPaid, pageSummary.totalPaid, "Scenario 9: Total paid matches across drawer and page");
    assertEqual(drawerSummary.totalCredit, pageSummary.totalCredit, "Scenario 9: Total credit matches across drawer and page");
    assertEqual(drawerSummary.items.length, pageSummary.items.length, "Scenario 9: Item count matches across drawer and page");
    assertEqual(drawerSummary.items[0].total, pageSummary.items[0].total, "Scenario 9: Row total matches (₹600)");
    assertEqual(drawerSummary.items[0].paid, pageSummary.items[0].paid, "Scenario 9: Row paid matches (₹500)");
    assertEqual(drawerSummary.items[0].due, pageSummary.items[0].due, "Scenario 9: Row due matches (₹100)");
  }

  // =========================================================================
  // SCENARIO 10: Payment collection followed by immediate refresh
  // =========================================================================
  {
    console.log("\n--- Scenario 10: Payment Collection Followed by Immediate Refresh ---");
    // Initial state: Rahul ₹600 total, ₹500 paid, ₹100 due
    let creditBalance: CreditBalance = {
      id: "cred_rahul_sim",
      originalInvoiceId: "inv_rahul_sim",
      originalInvoiceNumber: "EXP-261025-012",
      creditAmount: 100,
      remainingAmount: 100,
      status: "pending",
      collectionStatus: "pending",
    } as any;

    let invoice: Invoice = {
      id: "inv_rahul_sim",
      invoiceNumber: "EXP-261025-012",
      grandTotal: 600,
      receivedAmount: 500,
      balanceDue: 100,
      paymentStatus: "partial",
    } as any;

    // Step 1: Before collection
    let tracker = buildUnifiedCreditTracker([creditBalance], [invoice]);
    assertEqual(tracker.items.length, 1, "Scenario 10: Initially 1 pending invoice");
    assertEqual(tracker.items[0].due, 100, "Scenario 10: Initially ₹100 due");

    // Step 2: Simulate atomic partial collection of ₹40
    const partialAmount = 40;
    creditBalance = {
      ...creditBalance,
      remainingAmount: creditBalance.remainingAmount - partialAmount,
      collectionStatus: "partial",
    };
    invoice = {
      ...invoice,
      receivedAmount: (invoice.receivedAmount || 0) + partialAmount,
      balanceDue: (invoice.balanceDue || 0) - partialAmount,
      paymentStatus: "partial",
    };

    // Immediate refresh
    tracker = buildUnifiedCreditTracker([creditBalance], [invoice]);
    assertEqual(tracker.items.length, 1, "Scenario 10: Still 1 pending invoice after partial payment");
    assertEqual(tracker.items[0].paid, 540, "Scenario 10: Paid refreshed immediately to ₹540");
    assertEqual(tracker.items[0].due, 60, "Scenario 10: Due refreshed immediately to ₹60");
    assertEqual(tracker.totalDue, 60, "Scenario 10: Total due refreshed to ₹60");

    // Step 3: Simulate atomic full settlement of remaining ₹60
    const finalAmount = 60;
    creditBalance = {
      ...creditBalance,
      remainingAmount: 0,
      status: "settled",
      collectionStatus: "settled",
    };
    invoice = {
      ...invoice,
      receivedAmount: (invoice.receivedAmount || 0) + finalAmount,
      balanceDue: 0,
      paymentStatus: "paid",
    };

    // Immediate refresh
    tracker = buildUnifiedCreditTracker([creditBalance], [invoice]);
    assertEqual(tracker.items.length, 0, "Scenario 10: Invoice immediately removed upon full settlement");
    assertEqual(tracker.totalDue, 0, "Scenario 10: Total due drops immediately to ₹0");
  }

  // =========================================================================
  // SCENARIO 11: All 16 User-Provided Items Reconciliation
  // =========================================================================
  {
    console.log("\n--- Scenario 11: 16-Entry Raw Snapshot Consolidation ---");
    const creditBalances: CreditBalance[] = [
      { id: "c1", originalInvoiceId: "i1", originalInvoiceNumber: "EXP-261025-012", originalBillDate: "2026-10-25", creditAmount: 100, remainingAmount: 100, status: "pending", collectionStatus: "pending" } as any,
      { id: "c2", originalInvoiceId: "i2", originalInvoiceNumber: "EXP-261024-011", originalBillDate: "2026-10-24", creditAmount: 400, remainingAmount: 400, status: "pending", collectionStatus: "pending" } as any,
      { id: "c3", originalInvoiceId: "i3", originalInvoiceNumber: "EXP-261018-006", originalBillDate: "2026-10-18", creditAmount: 100, remainingAmount: 100, status: "pending", collectionStatus: "pending" } as any,
      { id: "c4", originalInvoiceId: "i4", originalInvoiceNumber: "EXP-261002-014", originalBillDate: "2026-10-02", creditAmount: 500, remainingAmount: 500, status: "pending", collectionStatus: "pending" } as any,
      { id: "c5", originalInvoiceId: "i5", originalInvoiceNumber: "EXP-261002-018", originalBillDate: "2026-10-02", creditAmount: 300, remainingAmount: 300, status: "pending", collectionStatus: "pending" } as any,
      { id: "c6", originalInvoiceId: "i6", originalInvoiceNumber: "EXP-260823-018", originalBillDate: "2026-08-23", creditAmount: 100, remainingAmount: 100, status: "pending", collectionStatus: "pending" } as any,
      { id: "c7", originalInvoiceId: "i7", originalInvoiceNumber: "EXP-260812-001", originalBillDate: "2026-08-12", creditAmount: 600, remainingAmount: 600, status: "pending", collectionStatus: "pending" } as any,
      { id: "c8", originalInvoiceId: "i8", originalInvoiceNumber: "EXP-260806-017", originalBillDate: "2026-08-06", creditAmount: 100, remainingAmount: 100, status: "pending", collectionStatus: "pending" } as any,
      { id: "c9", originalInvoiceId: "i9", originalInvoiceNumber: "EXP-260731-007", originalBillDate: "2026-07-31", creditAmount: 30, remainingAmount: 30, status: "pending", collectionStatus: "pending" } as any,
      // Duplicate invoice EXP-260730-005: 2 records for 1 invoice
      { id: "c10a", originalInvoiceId: "i10", originalInvoiceNumber: "EXP-260730-005", originalBillDate: "2026-07-30", creditAmount: 100, remainingAmount: 100, status: "pending", collectionStatus: "pending" } as any,
      { id: "c10b", originalInvoiceId: "i10", originalInvoiceNumber: "EXP-260730-005", originalBillDate: "2026-07-30", creditAmount: 200, remainingAmount: 200, status: "pending", collectionStatus: "pending" } as any,
      { id: "c11", originalInvoiceId: "i11", originalInvoiceNumber: "EXP-260717-010", originalBillDate: "2026-07-17", creditAmount: 750, remainingAmount: 750, status: "pending", collectionStatus: "pending" } as any,
      { id: "c12", originalInvoiceId: "i12", originalInvoiceNumber: "EXP-260716-005", originalBillDate: "2026-07-16", creditAmount: 300, remainingAmount: 300, status: "pending", collectionStatus: "pending" } as any,
      { id: "c13", originalInvoiceId: "i13", originalInvoiceNumber: "EXP-260711-012", originalBillDate: "2026-07-11", creditAmount: 500, remainingAmount: 500, status: "pending", collectionStatus: "pending" } as any,
      { id: "c14", originalInvoiceId: "i14", originalInvoiceNumber: "EXP-260711-015", originalBillDate: "2026-07-11", creditAmount: 200, remainingAmount: 200, status: "pending", collectionStatus: "pending" } as any,
      { id: "c15", originalInvoiceId: "i15", originalInvoiceNumber: "EXP-260708-007", originalBillDate: "2026-07-08", creditAmount: 30, remainingAmount: 30, status: "pending", collectionStatus: "pending" } as any,
    ];

    const result = buildUnifiedCreditTracker(creditBalances, []);
    assertEqual(creditBalances.length, 16, "Scenario 11: 16 credit_balances documents input");
    assertEqual(result.items.length, 15, "Scenario 11: Consolidated into exactly 15 distinct invoices");
    assertEqual(result.totalDue, 4310, "Scenario 11: Sum equals ₹4,310 (₹1,400 Oct + ₹2,910 Jul-Aug)");
    const exp0730 = result.items.find((it) => it.invoiceNumber === "EXP-260730-005");
    assertEqual(exp0730?.due, 300, "Scenario 11: EXP-260730-005 due is ₹300 (100 + 200)");
  }

  // =========================================================================
  // SCENARIO 12: Historical Stats Invariance & Direct Attribution
  // =========================================================================
  {
    console.log("\n--- Scenario 12: Historical Report Invariance & Direct Collection Attribution ---");
    const julyInvoice: Invoice = {
      id: "inv_july_debt",
      invoiceNumber: "EXP-260715-001",
      dateKey: "2026-07-15",
      grandTotal: 1000,
      subtotal: 1000,
      balanceDue: 0,
      receivedAmount: 1000,
      paymentStatus: "paid",
      paymentSplit: { cash: 700, upi: 300, card: 0 },
      creditPaymentHistory: [
        {
          collectedAt: "2026-10-25T14:30:00Z",
          collectedAmount: 300,
          paymentSplit: { cash: 0, upi: 300, card: 0 },
          remainingBalance: 0,
        },
      ],
      services: [
        {
          serviceName: "Keratin Treatment",
          staffId: "staff_stylist",
          staffName: "Sohail",
          staffRole: "Stylist",
          amount: 1000,
          usedProductCost: 100,
        },
      ],
    } as any;

    const octReport = generateMonthlyReport({
      selectedMonth: "2026-10",
      invoices: [julyInvoice],
      staffDrawings: [],
      expenses: [],
      staffList: testStaff,
    });

    assertEqual(octReport.overview.creditCollectionsRevenue, 300, "Scenario 12: October credit collections is ₹300");
    assertEqual(octReport.overview.grossServiceRevenue, 0, "Scenario 12: July service revenue NOT added to October");
    assertEqual(octReport.overview.allocation.totalOwnerShare, 300, "Scenario 12: 100% of collected historical debt allocated to Owner");

    const julyReport = generateMonthlyReport({
      selectedMonth: "2026-07",
      invoices: [julyInvoice],
      staffDrawings: [],
      expenses: [],
      staffList: testStaff,
    });
    assertEqual(julyReport.overview.grossServiceRevenue, 1000, "Scenario 12: July original service revenue preserved");
  }

  // =========================================================================
  // SCENARIO 13: Dashboard Header Navbar Badge Count Verification
  // =========================================================================
  {
    console.log("\n--- Scenario 13: Dashboard Header Navbar Badge Count Verification ---");

    // 1. Settled invoices do not increase the badge count
    const settledCredit: CreditBalance = {
      id: "c_settled_badge",
      originalInvoiceId: "inv_settled_badge",
      originalInvoiceNumber: "EXP-260716-008",
      creditAmount: 500,
      remainingAmount: 0,
      status: "settled",
      collectionStatus: "settled",
    } as any;
    const settledInv: Invoice = {
      id: "inv_settled_badge",
      invoiceNumber: "EXP-260716-008",
      grandTotal: 500,
      balanceDue: 0,
      paymentStatus: "paid",
    } as any;
    const resSettled = buildUnifiedCreditTracker([settledCredit], [settledInv]);
    assertEqual(resSettled.totalInvoicesCount, 0, "Badge Test 1: Settled invoice does not increase badge count (count = 0)");

    // 1b. Settled credit record with stale invoice balanceDue > 0 is NOT re-added via unlinked loop
    const staleInvWithSettledCredit: Invoice = {
      id: "inv_stale_settled",
      invoiceNumber: "EXP-260716-099",
      grandTotal: 500,
      balanceDue: 500,
      paymentStatus: "unpaid",
    } as any;
    const settledCreditForStaleInv: CreditBalance = {
      id: "c_settled_stale",
      originalInvoiceId: "inv_stale_settled",
      originalInvoiceNumber: "EXP-260716-099",
      creditAmount: 500,
      remainingAmount: 0,
      status: "settled",
      collectionStatus: "settled",
    } as any;
    const resStaleSettled = buildUnifiedCreditTracker([settledCreditForStaleInv], [staleInvWithSettledCredit]);
    assertEqual(resStaleSettled.totalInvoicesCount, 0, "Badge Test 1b: Invoice with settled credit ledger doc is never re-added as unlinked (count = 0)");
    assertEqual(resStaleSettled.items.filter((i) => i.isUnlinkedInvoice).length, 0, "Badge Test 1b: Zero unlinked items");

    // 2. Partial balances do increase the count
    const partialInv: Invoice = {
      id: "inv_partial_badge",
      invoiceNumber: "EXP-261025-012",
      grandTotal: 600,
      receivedAmount: 500,
      balanceDue: 100,
      paymentStatus: "partial",
    } as any;
    const partialCredit: CreditBalance = {
      id: "c_partial_badge",
      originalInvoiceId: "inv_partial_badge",
      originalInvoiceNumber: "EXP-261025-012",
      creditAmount: 100,
      remainingAmount: 100,
      status: "pending",
    } as any;
    const resPartial = buildUnifiedCreditTracker([partialCredit], [partialInv]);
    assertEqual(resPartial.totalInvoicesCount, 1, "Badge Test 2: Partial balance increases badge count by 1");

    // 3. Multiple ledger documents for one invoice count once
    const multiDocCredit1: CreditBalance = {
      id: "c_multi_1",
      originalInvoiceId: "inv_multi",
      originalInvoiceNumber: "EXP-260730-005",
      creditAmount: 100,
      remainingAmount: 100,
      status: "pending",
    } as any;
    const multiDocCredit2: CreditBalance = {
      id: "c_multi_2",
      originalInvoiceId: "inv_multi",
      originalInvoiceNumber: "EXP-260730-005",
      creditAmount: 200,
      remainingAmount: 200,
      status: "pending",
    } as any;
    const multiInv: Invoice = {
      id: "inv_multi",
      invoiceNumber: "EXP-260730-005",
      grandTotal: 300,
      balanceDue: 300,
    } as any;
    const resMulti = buildUnifiedCreditTracker([multiDocCredit1, multiDocCredit2], [multiInv]);
    assertEqual(resMulti.totalInvoicesCount, 1, "Badge Test 3: Multiple credit documents for one invoice count strictly ONCE");
    assertEqual(resMulti.items.length, 1, "Badge Test 3: Exactly 1 item in list");

    // 4. Legacy invoices missing paymentStatus are counted if genuinely unpaid
    const legacyUnpaidInv: Invoice = {
      id: "inv_legacy_nobadge",
      invoiceNumber: "EXP-260711-012",
      grandTotal: 500,
      balanceDue: 500,
      // paymentStatus is undefined
    } as any;
    const resLegacy = buildUnifiedCreditTracker([], [legacyUnpaidInv]);
    assertEqual(resLegacy.totalInvoicesCount, 1, "Badge Test 4: Legacy invoice missing paymentStatus is counted if genuinely unpaid");

    // 5. Partial collection keeps the invoice counted while its due remains positive
    let dynamicInv: Invoice = {
      id: "inv_dyn",
      invoiceNumber: "EXP-261020-001",
      grandTotal: 1000,
      receivedAmount: 600,
      balanceDue: 400,
      paymentStatus: "partial",
    } as any;
    let dynamicCredit: CreditBalance = {
      id: "c_dyn",
      originalInvoiceId: "inv_dyn",
      originalInvoiceNumber: "EXP-261020-001",
      creditAmount: 400,
      remainingAmount: 400,
      status: "pending",
    } as any;

    let resDyn = buildUnifiedCreditTracker([dynamicCredit], [dynamicInv]);
    assertEqual(resDyn.totalInvoicesCount, 1, "Badge Test 5a: Before collection, badge count is 1");
    assertEqual(resDyn.totalDue, 400, "Badge Test 5a: Due is ₹400");

    // Simulate partial collection of ₹150
    dynamicInv = {
      ...dynamicInv,
      receivedAmount: 750,
      balanceDue: 250,
    };
    dynamicCredit = {
      ...dynamicCredit,
      remainingAmount: 250,
      collectedAmount: 150,
    };
    resDyn = buildUnifiedCreditTracker([dynamicCredit], [dynamicInv]);
    assertEqual(resDyn.totalInvoicesCount, 1, "Badge Test 5b: Partial collection keeps badge count at 1 while due > 0");
    assertEqual(resDyn.totalDue, 250, "Badge Test 5b: Due reflects remaining ₹250");

    // 6. Full collection immediately decreases the count
    dynamicInv = {
      ...dynamicInv,
      receivedAmount: 1000,
      balanceDue: 0,
      paymentStatus: "paid",
    };
    dynamicCredit = {
      ...dynamicCredit,
      remainingAmount: 0,
      collectedAmount: 400,
      status: "settled",
      collectionStatus: "settled",
    };
    resDyn = buildUnifiedCreditTracker([dynamicCredit], [dynamicInv]);
    assertEqual(resDyn.totalInvoicesCount, 0, "Badge Test 6: Full collection immediately decreases badge count to 0");
    assertEqual(resDyn.totalDue, 0, "Badge Test 6: Total due drops to ₹0");

    // 7. The badge count matches the number of rows in Outstanding Credits after applying identical filters
    const testSnapshotCredits: CreditBalance[] = [
      { id: "c1", originalInvoiceId: "i1", originalInvoiceNumber: "EXP-261025-012", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c2", originalInvoiceId: "i2", originalInvoiceNumber: "EXP-261018-006", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c3", originalInvoiceId: "i3", originalInvoiceNumber: "EXP-261002-018", creditAmount: 300, remainingAmount: 300, status: "pending" } as any,
      { id: "c4a", originalInvoiceId: "i4", originalInvoiceNumber: "EXP-260730-005", creditAmount: 100, remainingAmount: 100, status: "pending" } as any,
      { id: "c4b", originalInvoiceId: "i4", originalInvoiceNumber: "EXP-260730-005", creditAmount: 200, remainingAmount: 200, status: "pending" } as any,
      // Fully settled record in same list
      { id: "c_settled_28", originalInvoiceId: "i_settled", originalInvoiceNumber: "EXP-260716-008", creditAmount: 500, remainingAmount: 0, status: "settled" } as any,
    ];
    const testSnapshotInvoices: Invoice[] = [
      { id: "i1", invoiceNumber: "EXP-261025-012", grandTotal: 600, balanceDue: 100 } as any,
      { id: "i2", invoiceNumber: "EXP-261018-006", grandTotal: 600, balanceDue: 100 } as any,
      { id: "i3", invoiceNumber: "EXP-261002-018", grandTotal: 1300, balanceDue: 300 } as any,
      { id: "i4", invoiceNumber: "EXP-260730-005", grandTotal: 300, balanceDue: 300 } as any,
      { id: "i_settled", invoiceNumber: "EXP-260716-008", grandTotal: 500, balanceDue: 0, paymentStatus: "paid" } as any,
    ];

    const snapshotResult = buildUnifiedCreditTracker(testSnapshotCredits, testSnapshotInvoices);
    assertEqual(snapshotResult.totalInvoicesCount, snapshotResult.items.length, "Badge Test 7: Badge count strictly matches items length");
    assertEqual(snapshotResult.totalInvoicesCount, 4, "Badge Test 7: Exactly 4 unique invoices with due > 0");
  }

  // =========================================================================
  // Scenario 14: Pure Payment Allocation Across Ledger Documents (Oldest-First)
  // =========================================================================
  {
    console.log("\n--- Scenario 14: Pure Credit Payment Allocation Engine ---");

    const baseInvoice = {
      grandTotal: 1000,
      receivedAmount: 400,
      balanceDue: 600,
      paymentSplit: { cash: 400, upi: 0, card: 0 },
    };

    // 1. Full payment of single doc
    const singleDoc = [{
      id: "doc_single",
      creditAmount: 600,
      remainingAmount: 600,
      collectedAmount: 0,
      createdAt: "2026-08-01T10:00:00Z",
      status: "pending",
    }];

    const fullResult = allocateCreditPayment(singleDoc, 600, baseInvoice);
    assertEqual(fullResult.totalAllocated, 600, "Scenario 14.1: Full amount allocated");
    assertEqual(fullResult.invoiceNextBalance, 0, "Scenario 14.1: Invoice balance becomes 0");
    assertEqual(fullResult.invoiceNextReceived, 1000, "Scenario 14.1: Invoice received becomes 1000");
    assertEqual(fullResult.invoiceNextStatus, "paid", "Scenario 14.1: Invoice status becomes paid");
    assertEqual(fullResult.allocations.length, 1, "Scenario 14.1: 1 allocation record");
    assertEqual(fullResult.allocations[0].newRemaining, 0, "Scenario 14.1: Ledger remaining becomes 0");
    assertEqual(fullResult.allocations[0].newCollected, 600, "Scenario 14.1: Ledger collected becomes 600");
    assertEqual(fullResult.allocations[0].isFullySettled, true, "Scenario 14.1: Ledger fully settled");
    assertEqual(fullResult.allocations[0].status, "settled", "Scenario 14.1: Ledger status settled");
    console.log("✅ PASSED: Scenario 14.1: Full payment of single doc");

    // 2. Partial payment of single doc
    const partialResult = allocateCreditPayment(singleDoc, 250, baseInvoice);
    assertEqual(partialResult.totalAllocated, 250, "Scenario 14.2: Partial amount allocated");
    assertEqual(partialResult.invoiceNextBalance, 350, "Scenario 14.2: Invoice balance drops to 350");
    assertEqual(partialResult.invoiceNextReceived, 650, "Scenario 14.2: Invoice received increases to 650");
    assertEqual(partialResult.invoiceNextStatus, "partial", "Scenario 14.2: Invoice status partial");
    assertEqual(partialResult.allocations[0].newRemaining, 350, "Scenario 14.2: Ledger remaining becomes 350");
    assertEqual(partialResult.allocations[0].newCollected, 250, "Scenario 14.2: Ledger collected becomes 250");
    assertEqual(partialResult.allocations[0].isFullySettled, false, "Scenario 14.2: Ledger not fully settled");
    assertEqual(partialResult.allocations[0].status, "pending", "Scenario 14.2: Ledger status remains pending");
    assertEqual(partialResult.allocations[0].collectionStatus, "partial", "Scenario 14.2: Ledger collectionStatus is partial");
    console.log("✅ PASSED: Scenario 14.2: Partial payment of single doc");

    // 3. Overpayment rejected
    let threwOverpayment = false;
    try {
      allocateCreditPayment(singleDoc, 650, baseInvoice);
    } catch (e: any) {
      threwOverpayment = true;
    }
    assertEqual(threwOverpayment, true, "Scenario 14.3: Overpayment (> remaining balance) is rejected");
    console.log("✅ PASSED: Scenario 14.3: Overpayment rejected");

    // 4. Zero or negative amount rejected
    let threwZero = false;
    try {
      allocateCreditPayment(singleDoc, 0, baseInvoice);
    } catch (e: any) {
      threwZero = true;
    }
    assertEqual(threwZero, true, "Scenario 14.4: Zero payment is rejected");

    let threwNegative = false;
    try {
      allocateCreditPayment(singleDoc, -100, baseInvoice);
    } catch (e: any) {
      threwNegative = true;
    }
    assertEqual(threwNegative, true, "Scenario 14.4: Negative payment is rejected");
    console.log("✅ PASSED: Scenario 14.4: Zero or negative payment rejected");

    // 5. Two ledger docs on one invoice with oldest-first order
    const multiDocs = [
      {
        id: "doc_newer",
        creditAmount: 300,
        remainingAmount: 300,
        collectedAmount: 0,
        createdAt: "2026-08-15T12:00:00Z", // Newer
        status: "pending",
      },
      {
        id: "doc_older",
        creditAmount: 200,
        remainingAmount: 200,
        collectedAmount: 0,
        createdAt: "2026-07-10T09:00:00Z", // Older
        status: "pending",
      },
    ];

    // Collect ₹350: Should fully settle doc_older (₹200) and partially settle doc_newer (₹150)
    const multiResult = allocateCreditPayment(multiDocs, 350, baseInvoice);
    assertEqual(multiResult.allocations.length, 2, "Scenario 14.5: Both documents allocated");
    // First allocation MUST be doc_older
    assertEqual(multiResult.allocations[0].docId, "doc_older", "Scenario 14.5: Oldest document allocated first");
    assertEqual(multiResult.allocations[0].allocatedAmount, 200, "Scenario 14.5: Older document gets full ₹200");
    assertEqual(multiResult.allocations[0].newRemaining, 0, "Scenario 14.5: Older document remaining is ₹0");
    assertEqual(multiResult.allocations[0].isFullySettled, true, "Scenario 14.5: Older document is fully settled");
    assertEqual(multiResult.allocations[0].status, "settled", "Scenario 14.5: Older document status is settled");

    // Second allocation MUST be doc_newer
    assertEqual(multiResult.allocations[1].docId, "doc_newer", "Scenario 14.5: Newer document allocated second");
    assertEqual(multiResult.allocations[1].allocatedAmount, 150, "Scenario 14.5: Newer document gets remainder ₹150");
    assertEqual(multiResult.allocations[1].newRemaining, 150, "Scenario 14.5: Newer document remaining is ₹150");
    assertEqual(multiResult.allocations[1].isFullySettled, false, "Scenario 14.5: Newer document not settled yet");
    assertEqual(multiResult.allocations[1].status, "pending", "Scenario 14.5: Newer document status is pending");
    assertEqual(multiResult.allocations[1].collectionStatus, "partial", "Scenario 14.5: Newer document collectionStatus is partial");

    assertEqual(multiResult.invoiceNextBalance, 250, "Scenario 14.5: Invoice balance drops by ₹350 (600 - 350 = 250)");
    assertEqual(multiResult.invoiceNextStatus, "partial", "Scenario 14.5: Invoice status remains partial");
    console.log("✅ PASSED: Scenario 14.5: Two ledger docs on one invoice with oldest-first order");

    // 6. Full payment across two ledger docs settles both
    const multiFullResult = allocateCreditPayment(multiDocs, 500, baseInvoice);
    assertEqual(multiFullResult.allocations[0].isFullySettled, true, "Scenario 14.6: Doc older settled");
    assertEqual(multiFullResult.allocations[1].isFullySettled, true, "Scenario 14.6: Doc newer settled");
    assertEqual(multiFullResult.invoiceNextBalance, 100, "Scenario 14.6: Invoice balance reflects 600 - 500 = 100");
    console.log("✅ PASSED: Scenario 14.6: Full payment across multiple ledger docs");
  }

  console.log("\n🎉 ALL OUTSTANDING CREDITS & PAYMENT COLLECTION TESTS PASSED SUCCESSFULLY!");
}

runCreditTrackerTests();

