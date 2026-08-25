import {
  computeCostPerServing,
  computeConsumedCost,
  computeRemainingInventoryValue,
} from "./servingCost";
import { getServiceCommission } from "./settlements";

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

  console.log("=== ALL TESTS COMPLETED SUCCESSFULLY ===");
}

runTests();
