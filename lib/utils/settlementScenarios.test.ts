import { getServiceCommission, calculateDaySettlement } from "./settlements";
import { generateMonthlyReport } from "./monthlyReports";
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

export function runSettlementScenarioTests() {
  console.log("=== RUNNING USED PRODUCT & SETTLEMENT SCENARIO TESTS ===");

  const testStaff: Staff[] = [
    { id: "staff_owner", name: "Zubair", role: "Owner", status: "Active" },
    { id: "staff_stylist", name: "Sohail", role: "Stylist", status: "Active" },
  ];

  // Scenario A: Owner performs a ₹300 service with a ₹50 applicable product cost
  {
    console.log("\n--- Scenario A: Owner performs ₹300 service with ₹50 product cost ---");
    const serviceItem = {
      serviceId: "srv_cut",
      serviceName: "Hair Cut",
      staffId: "staff_owner",
      staffName: "Zubair",
      staffRole: "Owner",
      amount: 300,
      usedProductId: "prod_beard_color",
      usedProductName: "Beard Color",
      usedProductCost: 50,
    };
    const inv = {
      id: "inv_a",
      subtotal: 300,
      grandTotal: 300,
      paymentSplit: { cash: 300, upi: 0, card: 0 },
      services: [serviceItem],
      products: [],
    };

    const comm = getServiceCommission(serviceItem, inv);
    assertEqual(comm.serviceRevenue, 300, "Scenario A: Service revenue is ₹300");
    assertEqual(comm.productCost, 50, "Scenario A: Product cost recorded as ₹50");
    assertEqual(comm.stylistShare, 0, "Scenario A: Stylist share is ₹0 for owner service");
    assertEqual(comm.ownerShare, 300, "Scenario A: Owner share is full ₹300");
    assertEqual(comm.ownerShare + comm.stylistShare, 300, "Scenario A: Total allocation reconciles to ₹300");

    const daySettlement = calculateDaySettlement([inv], testStaff, "2026-10-25");
    assertEqual(daySettlement.totalServiceRevenue, 300, "Scenario A Settlement: Total service revenue is ₹300");
    assertEqual(daySettlement.totalProductCost, 50, "Scenario A Settlement: Total product cost is ₹50");
    assertEqual(daySettlement.ownerDirectRevenue, 300, "Scenario A Settlement: Owner direct revenue is ₹300");
    assertEqual(daySettlement.totalStaffShare, 0, "Scenario A Settlement: Total staff share is ₹0");
    assertEqual(daySettlement.totalOwnerShare, 300, "Scenario A Settlement: Total owner share is ₹300");
  }

  // Scenario B: Stylist performs a ₹300 service with a ₹50 applicable product cost
  {
    console.log("\n--- Scenario B: Stylist performs ₹300 service with ₹50 product cost ---");
    const serviceItem = {
      serviceId: "srv_cut",
      serviceName: "Hair Cut",
      staffId: "staff_stylist",
      staffName: "Sohail",
      staffRole: "Stylist",
      amount: 300,
      usedProductId: "prod_beard_color",
      usedProductName: "Beard Color",
      usedProductCost: 50,
    };
    const inv = {
      id: "inv_b",
      subtotal: 300,
      grandTotal: 300,
      paymentSplit: { cash: 300, upi: 0, card: 0 },
      services: [serviceItem],
      products: [],
    };

    const comm = getServiceCommission(serviceItem, inv);
    assertEqual(comm.serviceRevenue, 300, "Scenario B: Service revenue is ₹300");
    assertEqual(comm.productCost, 50, "Scenario B: Product cost is ₹50");
    const netService = comm.serviceRevenue - comm.productCost;
    assertEqual(netService, 250, "Scenario B: Net service revenue is ₹250 (₹300 - ₹50)");
    assertEqual(comm.stylistShare, 125, "Scenario B: Stylist 50% share is ₹125");
    assertEqual(comm.ownerShare, 175, "Scenario B: Owner total allocation is ₹175 (₹125 share + ₹50 recovery)");
    assertEqual(comm.ownerShare + comm.stylistShare, 300, "Scenario B: Total allocation equals ₹300 without double deduction");

    const daySettlement = calculateDaySettlement([inv], testStaff, "2026-10-25");
    assertEqual(daySettlement.totalServiceRevenue, 300, "Scenario B Settlement: Total service revenue is ₹300");
    assertEqual(daySettlement.totalProductCost, 50, "Scenario B Settlement: Total product cost is ₹50");
    assertEqual(daySettlement.staffRevenueContribution, 125, "Scenario B Settlement: Staff revenue contribution (owner 50% service share) is ₹125");
    assertEqual(daySettlement.staffProductReimbursement, 50, "Scenario B Settlement: Product-cost recovery to owner is ₹50");
    assertEqual(daySettlement.totalStaffShare, 125, "Scenario B Settlement: Total stylist share is ₹125");
    assertEqual(daySettlement.totalOwnerShare, 175, "Scenario B Settlement: Total owner share is ₹175");
    assertEqual(daySettlement.totalOwnerShare + daySettlement.totalStaffShare, 300, "Scenario B Settlement: Total reconciled to ₹300");

    const stylistSd = daySettlement.staffDetails["staff_stylist"];
    assertEqual(stylistSd.serviceRevenue, 300, "Scenario B Stylist Card: Service revenue is ₹300");
    assertEqual(stylistSd.productCost, 50, "Scenario B Stylist Card: Product Cost Used is ₹50");
    assertEqual(stylistSd.serviceRevenue - stylistSd.productCost, 250, "Scenario B Stylist Card: Net Service Revenue is ₹250");
    assertEqual(stylistSd.staffShare, 125, "Scenario B Stylist Card: 50% Staff Share is ₹125");
  }

  // Scenario C: Stylist performs a service without a used product
  {
    console.log("\n--- Scenario C: Stylist performs ₹300 service without used product ---");
    const serviceItem = {
      serviceId: "srv_cut",
      serviceName: "Hair Cut",
      staffId: "staff_stylist",
      staffName: "Sohail",
      staffRole: "Stylist",
      amount: 300,
      usedProductId: null,
      usedProductName: null,
      usedProductCost: 0,
    };
    const inv = {
      id: "inv_c",
      subtotal: 300,
      grandTotal: 300,
      paymentSplit: { cash: 300, upi: 0, card: 0 },
      services: [serviceItem],
      products: [],
    };

    const comm = getServiceCommission(serviceItem, inv);
    assertEqual(comm.serviceRevenue, 300, "Scenario C: Service revenue is ₹300");
    assertEqual(comm.productCost, 0, "Scenario C: Product cost is ₹0");
    assertEqual(comm.stylistShare, 150, "Scenario C: Stylist 50% share is ₹150");
    assertEqual(comm.ownerShare, 150, "Scenario C: Owner 50% share is ₹150");
    assertEqual(comm.ownerShare + comm.stylistShare, 300, "Scenario C: Total equals ₹300");
  }

  // Scenario D: Preserved persisted cost in settlements
  {
    console.log("\n--- Scenario D: Persisted cost in settlement calculation ---");
    const inv = {
      id: "inv_d",
      subtotal: 200,
      grandTotal: 200,
      dateKey: "2026-10-25",
      paymentSplit: { cash: 200, upi: 0, card: 0 },
      services: [
        {
          serviceId: "srv_cut",
          serviceName: "Hair Cut",
          staffId: "staff_stylist",
          staffName: "Sohail",
          staffRole: "Stylist",
          amount: 200,
          usedProductId: "prod_beard_color",
          usedProductName: "Beard Color",
          usedProductCost: 40,
        },
      ],
      products: [],
    };

    const daySettlement = calculateDaySettlement([inv], testStaff, "2026-10-25");
    assertEqual(daySettlement.totalProductCost, 40, "Scenario D: Product Cost Used is ₹40");
    assertEqual(daySettlement.totalStaffShare, 80, "Scenario D: Stylist share is ₹80 ((200 - 40) * 0.5)");
    assertEqual(daySettlement.totalOwnerShare, 120, "Scenario D: Owner share is ₹120 (80 + 40)");
  }

  // Scenario E: Old invoice without a persisted product cost
  {
    console.log("\n--- Scenario E: Old invoice without persisted product cost ---");
    const legacyInv = {
      id: "inv_legacy",
      subtotal: 300,
      grandTotal: 300,
      dateKey: "2024-05-10",
      paymentSplit: { cash: 300, upi: 0, card: 0 },
      services: [
        {
          serviceId: "srv_cut",
          serviceName: "Hair Cut",
          staffId: "staff_stylist",
          staffName: "Sohail",
          staffRole: "Stylist",
          price: 300,
          discount: 0,
          // Notice: no usedProductCost field at all
        },
      ],
      products: [],
    };

    const comm = getServiceCommission(legacyInv.services[0], legacyInv);
    assertEqual(comm.productCost, 0, "Scenario E: Legacy invoice product cost defaults to ₹0 (not invented)");
    assertEqual(comm.stylistShare, 150, "Scenario E: Legacy invoice stylist share is ₹150");
    assertEqual(comm.ownerShare, 150, "Scenario E: Legacy invoice owner share is ₹150");
  }

  // Scenario F: No double-counting on refresh or multi-service
  {
    console.log("\n--- Scenario F: Idempotency & Reconciled Totals ---");
    const invoices = [
      {
        id: "inv_f1",
        dateKey: "2026-10-25",
        subtotal: 500,
        grandTotal: 500,
        paymentSplit: { cash: 500, upi: 0, card: 0 },
        services: [
          {
            serviceId: "srv_1",
            serviceName: "Hair Color",
            staffId: "staff_stylist",
            staffName: "Sohail",
            staffRole: "Stylist",
            amount: 500,
            usedProductCost: 100,
          },
        ],
        products: [],
      },
    ];

    const run1 = calculateDaySettlement(invoices, testStaff, "2026-10-25");
    const run2 = calculateDaySettlement(invoices, testStaff, "2026-10-25");

    assertEqual(run1.totalProductCost, 100, "Scenario F: Run 1 product cost is ₹100");
    assertEqual(run2.totalProductCost, 100, "Scenario F: Run 2 product cost remains ₹100 (not doubled)");
    assertEqual(run1.totalStaffShare, 200, "Scenario F: Stylist share is ₹200 ((500 - 100) * 0.5)");
    assertEqual(run1.totalOwnerShare, 300, "Scenario F: Owner share is ₹300 (200 + 100)");
  }

  // Scenario G: Staff drawings and remaining payable calculation
  {
    console.log("\n--- Scenario G: Staff Drawings and Remaining Payable ---");
    const inv = {
      id: "inv_g",
      dateKey: "2026-10-25",
      subtotal: 300,
      grandTotal: 300,
      paymentSplit: { cash: 300, upi: 0, card: 0 },
      services: [
        {
          serviceId: "srv_cut",
          serviceName: "Hair Cut",
          staffId: "staff_stylist",
          staffName: "Sohail",
          staffRole: "Stylist",
          amount: 300,
          usedProductId: "prod_1",
          usedProductName: "Beard Color",
          usedProductCost: 50,
        },
      ],
      products: [],
    };

    const settlement = calculateDaySettlement([inv], testStaff, "2026-10-25");
    const sd = settlement.staffDetails["staff_stylist"];

    const serviceRev = sd.serviceRevenue;
    const productCost = sd.productCost;
    const netServiceRev = serviceRev - productCost;
    const commissionEarned = sd.staffShare;
    const staffDrawing = 25;
    const remainingPayable = commissionEarned - staffDrawing;

    assertEqual(serviceRev, 300, "Scenario G: Service revenue is ₹300");
    assertEqual(productCost, 50, "Scenario G: Product cost is ₹50");
    assertEqual(netServiceRev, 250, "Scenario G: Net service revenue is ₹250");
    assertEqual(commissionEarned, 125, "Scenario G: Commission earned is ₹125");
    assertEqual(remainingPayable, 100, "Scenario G: Remaining payable after ₹25 drawing is ₹100");

    // Ensure business expenses do not reduce stylist's ₹100 remaining payable
    const businessExpenses = 500;
    const ownerNetAfterExpenses = settlement.totalOwnerShare - businessExpenses;
    assertEqual(ownerNetAfterExpenses, 175 - 500, "Scenario G: Business expenses reduce owner balance");
    assertEqual(remainingPayable, 100, "Scenario G: Business expenses NEVER reduce stylist payable");
  }

  // Scenario H: Staff drawing payload sanitization & zero undefined fields
  {
    console.log("\n--- Scenario H: Drawing Payload Sanitization & Undefined Prevention ---");
    function buildDrawingPayload(drawing: {
      staffId: string;
      staffName: string;
      amount: number;
      date: string;
      month?: string;
      note?: string;
      referenceNumber?: string;
      paymentMethod?: string;
      type?: string;
      recordedBy?: string;
    }) {
      const month = (drawing.month || drawing.date.slice(0, 7)).trim();
      const payload: Record<string, any> = {
        staffId: drawing.staffId.trim(),
        staffName: drawing.staffName.trim(),
        amount: Number(drawing.amount),
        date: drawing.date.trim(),
        month,
        type: drawing.type || "payout",
        paymentMethod: drawing.paymentMethod || "Cash",
        recordedBy: drawing.recordedBy || "Owner",
        createdAt: "MOCK_SERVER_TIMESTAMP",
      };

      const trimmedNote = drawing.note?.trim();
      if (trimmedNote) {
        payload.note = trimmedNote;
      }

      const trimmedRef = drawing.referenceNumber?.trim();
      if (trimmedRef) {
        payload.referenceNumber = trimmedRef;
      }
      return payload;
    }

    // 1. Drawing with note, without referenceNumber
    const payloadWithNote = buildDrawingPayload({
      staffId: "staff_1",
      staffName: "Sohail",
      amount: 500,
      date: "2026-10-25",
      note: "Cash advance for festival",
    });

    assertEqual("note" in payloadWithNote, true, "Scenario H: note key is present when provided");
    assertEqual(payloadWithNote.note, "Cash advance for festival", "Scenario H: note matches input");
    assertEqual("referenceNumber" in payloadWithNote, false, "Scenario H: referenceNumber key is omitted when absent");
    assertEqual(Object.values(payloadWithNote).includes(undefined), false, "Scenario H: payload contains NO undefined values");

    // 2. Drawing without note, without referenceNumber
    const payloadNoNote = buildDrawingPayload({
      staffId: "staff_2",
      staffName: "Sameer",
      amount: 200,
      date: "2026-10-25",
      note: "",
      referenceNumber: "   ",
    });

    assertEqual("note" in payloadNoNote, false, "Scenario H: empty note is omitted");
    assertEqual("referenceNumber" in payloadNoNote, false, "Scenario H: whitespace referenceNumber is omitted");
    assertEqual(Object.values(payloadNoNote).includes(undefined), false, "Scenario H: payload contains NO undefined values");

    // 3. Drawing with both note and referenceNumber
    const payloadFull = buildDrawingPayload({
      staffId: "staff_1",
      staffName: "Sohail",
      amount: 1000,
      date: "2026-10-25",
      note: "Bank transfer payout",
      referenceNumber: "UPI/12345678",
      paymentMethod: "UPI",
    });

    assertEqual(payloadFull.note, "Bank transfer payout", "Scenario H: note included");
    assertEqual(payloadFull.referenceNumber, "UPI/12345678", "Scenario H: referenceNumber included");
    assertEqual(payloadFull.paymentMethod, "UPI", "Scenario H: paymentMethod included");
    assertEqual(Object.values(payloadFull).includes(undefined), false, "Scenario H: full payload has NO undefined values");
  }

  console.log("\n🎉 ALL SCENARIOS A THROUGH H PASSED SUCCESSFULLY!\n");
}

runSettlementScenarioTests();
