import { getServiceCommission, calculateDaySettlement } from "./settlements";
import { generateMonthlyReport } from "./monthlyReports";
import type { Staff } from "@/types/staff";

function assertEqual(actual: number, expected: number, message: string) {
  if (Math.abs(Number(actual) - Number(expected)) > 0.001) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
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

  console.log("\n🎉 ALL SCENARIOS A THROUGH F PASSED SUCCESSFULLY!\n");
}

runSettlementScenarioTests();
