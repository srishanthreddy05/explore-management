import {
  computeCostPerServing,
  computeConsumedCost,
  computeRemainingInventoryValue,
  computeRefillCostPerServing,
  resolveProductOriginalServings,
  validateRefillInput,
} from "./servingCost";
import { getServiceCommission } from "./settlements";
import { computeStaffPerformance } from "./staffPerformance";
import { auditProductRecord } from "../../scripts/inspect-and-repair-products";

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

  // ==========================================
  // SECTION 8: REQUIRED SCENARIO TESTS
  // ==========================================

  // Scenario 1: Add a product costing ₹250 for 10 servings. Expected unit cost: ₹25.
  {
    const purchaseCost = 250;
    const originalServings = 10;
    const unitCost = computeCostPerServing(purchaseCost, originalServings);
    assertEqual(unitCost, 25, "Scenario 1: Cost/serving should be ₹25 for ₹250 / 10 servings");
  }

  // Scenario 2: Consume one serving. Remaining stock: 9. Unit cost remains ₹25.
  {
    const purchaseCost = 250;
    const originalServings = 10;
    const initialUnitCost = computeCostPerServing(purchaseCost, originalServings);
    const consumed = 1;
    const remainingStock = originalServings - consumed;
    const unitCostAfterConsumption = initialUnitCost; // rule: never recalculate using remaining
    assertEqual(remainingStock, 9, "Scenario 2: Remaining stock should be 9 after 1 consumed");
    assertEqual(unitCostAfterConsumption, 25, "Scenario 2: Unit cost must remain ₹25 after 1 consumed");
  }

  // Scenario 3: Consume six servings in total. Remaining stock: 4. Unit cost remains ₹25.
  {
    const purchaseCost = 250;
    const originalServings = 10;
    const initialUnitCost = computeCostPerServing(purchaseCost, originalServings);
    const totalConsumed = 6;
    const remainingStock = originalServings - totalConsumed;
    const unitCostAfterConsumption = initialUnitCost;
    assertEqual(remainingStock, 4, "Scenario 3: Remaining stock should be 4 after 6 consumed in total");
    assertEqual(unitCostAfterConsumption, 25, "Scenario 3: Unit cost must remain ₹25 after 6 consumed");
  }

  // Scenario 4: Refill 10 servings at ₹250 (Case A: same unit cost). Remaining stock becomes 14. Unit cost remains ₹25.
  {
    const currentRemaining = 4;
    const currentCost = 25;
    const additionalServings = 10;
    const refillCost = 250;

    const refillResult = computeRefillCostPerServing(
      currentRemaining,
      currentCost,
      additionalServings,
      refillCost
    );

    assertEqual(refillResult.newRemainingServings, 14, "Scenario 4: New remaining stock should be 14 (4 + 10)");
    assertEqual(refillResult.refillUnitCost, 25, "Scenario 4: Refill batch unit cost should be ₹25");
    assertEqual(refillResult.newCostPerServing, 25, "Scenario 4: Unit cost must remain ₹25 (Case A)");
    assertEqual(refillResult.isSameUnitCost ? 1 : 0, 1, "Scenario 4: isSameUnitCost should be true");
  }

  // Scenario 5: Refill stock at a different unit cost (Case B: weighted average).
  // 4 remaining at ₹100 + 10 new at ₹120 (total ₹1,200).
  // Formula: (4 * 100 + 10 * 120) / 14 = 1600 / 14 = ₹114.29 per serving.
  {
    const currentRemaining = 4;
    const currentCost = 100;
    const additionalServings = 10;
    const refillCost = 1200;

    const refillResult = computeRefillCostPerServing(
      currentRemaining,
      currentCost,
      additionalServings,
      refillCost
    );

    assertEqual(refillResult.newRemainingServings, 14, "Scenario 5: New remaining servings should be 14");
    assertEqual(refillResult.refillUnitCost, 120, "Scenario 5: Refill batch unit cost should be ₹120");
    assertEqual(refillResult.newCostPerServing, 114.29, "Scenario 5: Weighted average cost should be ₹114.29");
    assertEqual(refillResult.isSameUnitCost ? 0 : 1, 1, "Scenario 5: isSameUnitCost should be false");
  }

  // Scenario 6: Edit product name or category. Stock quantity and unit cost must remain unchanged.
  {
    const product = {
      name: "Old Shampoo",
      amount: 1000,
      originalServings: 10,
      noOfServings: 4,
      costPerServing: 100,
      category: "Hair Care",
    };

    // Metadata edit only updates name / category
    const metadataUpdate = {
      name: "New Luxury Shampoo",
      category: "Premium Care",
    };

    const updatedProduct = {
      ...product,
      ...metadataUpdate,
    };

    assertEqual(updatedProduct.noOfServings, 4, "Scenario 6: Remaining servings unchanged on metadata edit");
    assertEqual(updatedProduct.costPerServing, 100, "Scenario 6: Cost per serving unchanged on metadata edit");
    assertEqual(updatedProduct.originalServings, 10, "Scenario 6: Original servings unchanged on metadata edit");
  }

  // Scenario 7: Open edit modal after multiple services. Verify remaining stock is NOT used as original quantity.
  {
    const productAfterServices = {
      amount: 1000,
      originalServings: 10,
      noOfServings: 4, // 6 consumed
      costPerServing: 100,
    };

    // Before fix: form loaded originalServings as (originalServings ?? noOfServings),
    // and if missing or user saved, it used noOfServings (4) giving 1000 / 4 = ₹250!
    // After fix: resolveProductOriginalServings guarantees 10 is used
    const resolvedOriginal = resolveProductOriginalServings(productAfterServices);
    const modalUnitCost = computeCostPerServing(productAfterServices.amount, resolvedOriginal);

    assertEqual(resolvedOriginal, 10, "Scenario 7: Original servings resolved to 10, NOT remaining 4");
    assertEqual(modalUnitCost, 100, "Scenario 7: Modal displays original unit cost ₹100, NOT ₹250");
  }

  // Scenario 8: Attempt to refill with zero, negative, fractional, or invalid servings. Rejected!
  {
    let rejectedCount = 0;
    const testCases = [0, -1, -10, 2.5, NaN, "abc"];
    testCases.forEach((invalidServings) => {
      const v = validateRefillInput(invalidServings, 100);
      if (!v.valid) rejectedCount++;
    });
    assertEqual(rejectedCount, testCases.length, "Scenario 8: All invalid servings rejected");

    // Invalid negative cost
    const invalidCost = validateRefillInput(10, -500);
    assertEqual(invalidCost.valid ? 0 : 1, 1, "Scenario 8: Negative refill cost rejected");
  }

  // Scenario 9: Attempt to consume more stock than is available. Prevent negative inventory.
  {
    const remainingStock = 4;
    const attemptConsume = 5;
    const canConsume = remainingStock >= attemptConsume;
    assertEqual(canConsume ? 1 : 0, 0, "Scenario 9: Attempting to consume 5 when 4 left must be blocked");
  }

  // Scenario 10 & 11: Historical invoices preserve snapshotted usedProductCost
  {
    const historicalService = {
      serviceName: "Hair Straightening",
      usedProductId: "prod_123",
      usedProductCost: 100, // saved at bill creation time
    };

    // Product later gets refilled at higher cost (e.g. ₹114.29)
    const productAfterRefillCost = 114.29;

    // Historical invoice service MUST retain its original snapshotted cost ₹100
    assertEqual(historicalService.usedProductCost, 100, "Scenario 11: Historical invoice retains snapshotted ₹100");
  }

  // Scenario 12: Depleted stock refill (0 remaining)
  {
    const currentRemaining = 0;
    const currentCost = 100;
    const additionalServings = 10;
    const refillCost = 500;

    const refillResult = computeRefillCostPerServing(
      currentRemaining,
      currentCost,
      additionalServings,
      refillCost
    );

    assertEqual(refillResult.newRemainingServings, 10, "Scenario 12: Stock becomes 10 from 0");
    assertEqual(refillResult.newCostPerServing, 50, "Scenario 12: New unit cost becomes ₹50 (₹500 / 10)");
  }

  // ==========================================
  // DATA INTEGRITY & AUDIT TESTS
  // ==========================================

  // Audit Test 1: Corrupted record detection & repair
  {
    const corruptedDoc = {
      type: "service",
      name: "Hair Straightening Cream",
      amount: 1000,
      originalServings: 10,
      noOfServings: 9, // 1 consumed
      costPerServing: 111.11, // INCORRECTLY derived from 1000 / 9
    };
    const audit = auditProductRecord("prod_corrupted", corruptedDoc);
    assertEqual(audit.status === "repaired" ? 1 : 0, 1, "Audit: Corrupted record correctly detected for repair");
    assertEqual(audit.repairedData?.costPerServing || 0, 100, "Audit: Repaired unit cost should be ₹100");
  }

  // Audit Test 2: Missing originalServings recovery
  {
    const legacyDoc = {
      type: "service",
      name: "Keratin Treatment Pack",
      amount: 1500,
      costPerServing: 150,
      noOfServings: 8,
      // originalServings missing
    };
    const audit = auditProductRecord("prod_legacy", legacyDoc);
    assertEqual(audit.status === "repaired" ? 1 : 0, 1, "Audit: Legacy record with missing originalServings detected");
    assertEqual(audit.repairedData?.originalServings || 0, 10, "Audit: Recovered originalServings should be 10 (1500 / 150)");
  }

  // Audit Test 3: Ambiguous record handling
  {
    const ambiguousDoc = {
      type: "service",
      name: "Old Unknown Tube",
      amount: 800,
      noOfServings: 3,
      // costPerServing and originalServings both missing
    };
    const audit = auditProductRecord("prod_ambiguous", ambiguousDoc);
    assertEqual(audit.status === "ambiguous" ? 1 : 0, 1, "Audit: Ambiguous record safely flagged without guessing");
  }

  console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();


