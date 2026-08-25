import {
  computeCostPerServing,
  computeConsumedCost,
  computeRemainingInventoryValue,
} from "./servingCost";
import { getServiceCommission } from "./settlements";
import { computeStaffPerformance } from "./staffPerformance";

function assertEqual(actual: number, expected: number, message: string) {
  if (Math.abs(Number(actual) - Number(expected)) > 0.001) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expected}, Got: ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function runTests() {
  console.log("=== RUNNING PRODUCT & SETTLEMENT CALCULATION TESTS ===");

  // Product Test 1: Cost ₹500, 10 original servings, Use 1
  {
    const purchaseCost = 500;
    const originalServings = 10;
    const quantityUsed = 1;

    const costPerServing = computeCostPerServing(purchaseCost, originalServings);
    const remainingServings = originalServings - quantityUsed;
    const consumedCost = computeConsumedCost(quantityUsed, costPerServing);
    const remainingValue = computeRemainingInventoryValue(remainingServings, costPerServing);

    assertEqual(costPerServing, 50, "Product 1: Cost/serving should be ₹50");
    assertEqual(remainingServings, 9, "Product 1: Remaining servings should be 9");
    assertEqual(consumedCost, 50, "Product 1: Consumed cost should be ₹50");
    assertEqual(remainingValue, 450, "Product 1: Remaining value should be ₹450");
  }

  // Product Test 2: Cost ₹500, 10 original servings, Use 5
  {
    const purchaseCost = 500;
    const originalServings = 10;
    const quantityUsed = 5;

    const costPerServing = computeCostPerServing(purchaseCost, originalServings);
    const remainingServings = originalServings - quantityUsed;
    const consumedCost = computeConsumedCost(quantityUsed, costPerServing);
    const remainingValue = computeRemainingInventoryValue(remainingServings, costPerServing);

    assertEqual(costPerServing, 50, "Product 2: Cost/serving should remain ₹50");
    assertEqual(remainingServings, 5, "Product 2: Remaining servings should be 5");
    assertEqual(consumedCost, 250, "Product 2: Consumed cost should be ₹250");
    assertEqual(remainingValue, 250, "Product 2: Remaining value should be ₹250");
  }

  // Product Test 3: Cost ₹1000, 10 original servings, Use 1
  {
    const purchaseCost = 1000;
    const originalServings = 10;
    const quantityUsed = 1;

    const costPerServing = computeCostPerServing(purchaseCost, originalServings);
    const remainingServings = originalServings - quantityUsed;
    const consumedCost = computeConsumedCost(quantityUsed, costPerServing);

    assertEqual(costPerServing, 100, "Product 3: Cost/serving should be ₹100");
    assertEqual(remainingServings, 9, "Product 3: Remaining servings should be 9");
    assertEqual(consumedCost, 100, "Product 3: Consumed cost should be ₹100");
  }

  // Product Test 4: Cost ₹300, 10 original servings, Use 3
  {
    const purchaseCost = 300;
    const originalServings = 10;
    const quantityUsed = 3;

    const costPerServing = computeCostPerServing(purchaseCost, originalServings);
    const remainingServings = originalServings - quantityUsed;
    const consumedCost = computeConsumedCost(quantityUsed, costPerServing);

    assertEqual(costPerServing, 30, "Product 4: Cost/serving should be ₹30");
    assertEqual(remainingServings, 7, "Product 4: Remaining servings should be 7");
    assertEqual(consumedCost, 90, "Product 4: Consumed cost should be ₹90");
  }

  // Settlement Test: Service revenue = ₹2000, Product cost used = ₹100
  {
    const serviceItem = {
      amount: 2000,
      usedProductCost: 100,
      staffRole: "Stylist",
    };
    const inv = { subtotal: 2000, grandTotal: 2000 };

    const comm = getServiceCommission(serviceItem, inv);

    assertEqual(comm.serviceRevenue, 2000, "Settlement: Service revenue should be ₹2000");
    assertEqual(comm.productCost, 100, "Settlement: Product cost used should be ₹100");
    assertEqual(comm.serviceRevenue - comm.productCost, 1900, "Settlement: Net service revenue should be ₹1900");
    assertEqual(comm.stylistShare, 950, "Settlement: Staff 50% share should be ₹950");
    assertEqual(comm.ownerShare, 1050, "Settlement: Owner share should be ₹1050 (₹950 + ₹100 reimbursement)");
    assertEqual(comm.stylistShare + comm.ownerShare, 2000, "Settlement: Total shares should reconcile to ₹2000");
  }

  // Staff Performance Test 1: Daily and Monthly counts with quantities, staff matching & month boundary
    {
      const staffRehan = { id: "staff_1", name: "Rehan" };
      const staffSohail = { id: "staff_2", name: "Sohail" };
      const todayStr = "2026-08-25";

      const testInvoices = [
        // Today Invoice 1 (Rehan: Haircut x2, Facial x1; Sohail: Shave x1)
        {
          id: "inv_1",
          dateKey: "2026-08-25",
          services: [
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Haircut", quantity: 2 },
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Facial", quantity: 1 },
            { staffId: "staff_2", staffName: "Sohail", serviceName: "Shave", quantity: 1 },
          ],
        },
        // Today Invoice 2 (Rehan: Haircut x1)
        {
          id: "inv_2",
          dateKey: "2026-08-25",
          services: [
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Haircut", quantity: 1 },
            { serviceId: "membership_fee", staffId: "staff_1", staffName: "Rehan", serviceName: "Membership Fee", quantity: 1 },
          ],
        },
        // Earlier this month Invoice (Rehan: Haircut x12, Facial x7; Sohail: Haircut x5)
        {
          id: "inv_3",
          dateKey: "2026-08-10",
          services: [
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Haircut", quantity: 12 },
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Facial", quantity: 7 },
            { staffId: "staff_2", staffName: "Sohail", serviceName: "Haircut", quantity: 5 },
          ],
        },
        // Previous month Invoice (July 2026 - should not count for this month)
        {
          id: "inv_4",
          dateKey: "2026-07-20",
          services: [
            { staffId: "staff_1", staffName: "Rehan", serviceName: "Haircut", quantity: 10 },
          ],
        },
      ];

      const rehanPerf = computeStaffPerformance(testInvoices, staffRehan, todayStr);
      const sohailPerf = computeStaffPerformance(testInvoices, staffSohail, todayStr);

      assertEqual(rehanPerf.todayTotal, 4, "Rehan: Today's total services should be 4 (Haircut x3 + Facial x1)");
      assertEqual(rehanPerf.todayBreakdown.find((s) => s.name === "Haircut")?.count || 0, 3, "Rehan: Today Haircut count should be 3");
      assertEqual(rehanPerf.todayBreakdown.find((s) => s.name === "Facial")?.count || 0, 1, "Rehan: Today Facial count should be 1");

      assertEqual(rehanPerf.monthlyTotal, 23, "Rehan: Monthly total services should be 23 (3+12 Haircuts + 1+7 Facials)");
      assertEqual(rehanPerf.monthlyBreakdown.find((s) => s.name === "Haircut")?.count || 0, 15, "Rehan: Monthly Haircut count should be 15");
      assertEqual(rehanPerf.monthlyBreakdown.find((s) => s.name === "Facial")?.count || 0, 8, "Rehan: Monthly Facial count should be 8");

      assertEqual(sohailPerf.todayTotal, 1, "Sohail: Today's total services should be 1 (Shave x1)");
      assertEqual(sohailPerf.monthlyTotal, 6, "Sohail: Monthly total services should be 6 (Shave x1 + Haircut x5)");
    }

    console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
  }

  runTests();
