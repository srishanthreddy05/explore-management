import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  runTransaction,
  arrayUnion,
} from "firebase/firestore";
import type { Product, ProductRefill } from "@/types/product";
import { toTitleCase } from "@/lib/utils/text";
import {
  computeRefillCostPerServing,
  getEffectiveCostPerServing,
  validateRefillInput,
} from "@/lib/utils/servingCost";

const COLLECTION = "products";

export async function create(product: Omit<Product, "id">): Promise<string> {
  try {
    const isService = product.type === "service";

    if (!product.name || typeof product.name !== "string" || !product.name.trim()) {
      throw new Error("Product name is required.");
    }

    if (isService) {
      if (!product.amount || typeof product.amount !== "number" || product.amount <= 0) {
        throw new Error("Amount must be greater than 0.");
      }
    }

    const payload: Record<string, unknown> = {
      ...product,
      name: toTitleCase(product.name.trim()),
      isActive: true,
      price: isService ? 0 : (product.price ?? 0),
      amount: product.amount ?? null,
      createdAt: serverTimestamp(),
    };

    // Remove undefined values to prevent Firestore errors
    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    const docRef = await addDoc(collection(db, COLLECTION), payload);
    return docRef.id;
  } catch (error) {
    console.error("Error creating product:", error);
    throw error;
  }
}

/**
 * Returns only active (non-deleted) products, ordered by name.
 */
export async function getAll(): Promise<Product[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where("isActive", "==", true),
      orderBy("name", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
  } catch (error) {
    console.error("Error fetching products:", error);
    throw error;
  }
}

export async function getById(id: string): Promise<Product | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Product;
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    throw error;
  }
}

/**
 * Updates product details (name, brand, category, retail price/quantity, service supply amount).
 */
export async function update(
  id: string,
  data: Partial<Omit<Product, "id">>
): Promise<void> {
  try {
    const normalizedData: Record<string, unknown> = { ...data };
    if (typeof normalizedData.name === "string") {
      normalizedData.name = toTitleCase(normalizedData.name.trim());
    }
    // Remove undefined values to prevent Firestore errors
    Object.keys(normalizedData).forEach((key) => {
      if (normalizedData[key] === undefined) {
        delete normalizedData[key];
      }
    });

    await updateDoc(doc(db, COLLECTION, id), normalizedData);
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    throw error;
  }
}

/**
 * Dedicated atomic stock refill method using Firestore Transaction.
 *
 * Rules:
 * - Validates additionalServings > 0 and integer.
 * - Validates refillCost >= 0.
 * - Does NOT overwrite originalServings or initial amount.
 * - Computes new unit cost using weighted-average costing.
 * - Records refill history in both the product document and subcollection.
 */
export async function refillStock(
  productId: string,
  refillData: {
    additionalServings: number;
    refillCost: number;
    notes?: string;
  }
): Promise<{ updatedProduct: Product; refill: ProductRefill }> {
  const { additionalServings, refillCost, notes } = refillData;

  const validation = validateRefillInput(additionalServings, refillCost);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const productRef = doc(db, COLLECTION, productId);
  const refillSubRef = doc(collection(db, COLLECTION, productId, "refills"));

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) {
        throw new Error(`Product with ID ${productId} does not exist.`);
      }

      const product = { id: snap.id, ...snap.data() } as Product;

      if (product.type !== "service") {
        throw new Error("Refill stock is only supported for service supplies/products.");
      }
      if (product.isActive === false) {
        throw new Error("Cannot refill a deleted or inactive product.");
      }

      const currentRemaining = product.noOfServings ?? 0;
      const currentUnitCost = getEffectiveCostPerServing(product);

      const costResult = computeRefillCostPerServing(
        currentRemaining,
        currentUnitCost,
        additionalServings,
        refillCost
      );

      const refillRecord: ProductRefill = {
        id: refillSubRef.id,
        servingsAdded: Math.floor(additionalServings),
        cost: Number(refillCost),
        costPerServing: costResult.refillUnitCost,
        previousRemainingServings: currentRemaining,
        newRemainingServings: costResult.newRemainingServings,
        previousCostPerServing: currentUnitCost,
        newCostPerServing: costResult.newCostPerServing,
        createdAt: new Date().toISOString(),
        notes: notes?.trim() || undefined,
      };

      // 1. Write refill record to subcollection for auditing
      tx.set(refillSubRef, {
        ...refillRecord,
        createdAt: serverTimestamp(),
      });

      // 2. Update parent product document atomically
      const currentTotalServings = product.totalPurchasedServings ?? product.originalServings ?? 0;
      const currentTotalCost = product.totalPurchaseCost ?? product.amount ?? 0;

      tx.update(productRef, {
        noOfServings: costResult.newRemainingServings,
        costPerServing: costResult.newCostPerServing,
        lastRefillAt: serverTimestamp(),
        totalPurchasedServings: currentTotalServings + refillRecord.servingsAdded,
        totalPurchaseCost: currentTotalCost + refillRecord.cost,
        refillHistory: arrayUnion(refillRecord),
      });

      const updatedProduct: Product = {
        ...product,
        noOfServings: costResult.newRemainingServings,
        costPerServing: costResult.newCostPerServing,
        lastRefillAt: new Date().toISOString(),
        totalPurchasedServings: currentTotalServings + refillRecord.servingsAdded,
        totalPurchaseCost: currentTotalCost + refillRecord.cost,
        refillHistory: [...(product.refillHistory || []), refillRecord],
      };

      return { updatedProduct, refill: refillRecord };
    });
  } catch (error) {
    console.error(`Error refilling stock for product ${productId}:`, error);
    throw error;
  }
}

/**
 * Consumes servings of a service product.
 * Guarantees that stock deduction cannot produce negative inventory.
 * Original purchase info and cost per serving are never modified.
 */
export async function consumeServings(
  productId: string,
  servingsToConsume: number = 1
): Promise<{ productId: string; newRemainingServings: number; costPerServing: number }> {
  if (!Number.isInteger(servingsToConsume) || servingsToConsume <= 0) {
    throw new Error("Servings to consume must be a positive whole number.");
  }

  const productRef = doc(db, COLLECTION, productId);

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) {
        throw new Error(`Product with ID ${productId} does not exist.`);
      }

      const product = { id: snap.id, ...snap.data() } as Product;
      const currentRemaining = product.noOfServings ?? 0;

      if (currentRemaining < servingsToConsume) {
        throw new Error(
          `Cannot consume ${servingsToConsume} servings of "${product.name}". Only ${currentRemaining} serving(s) available in stock.`
        );
      }

      const newRemainingServings = currentRemaining - servingsToConsume;

      tx.update(productRef, {
        noOfServings: newRemainingServings,
      });

      return {
        productId,
        newRemainingServings,
        costPerServing: getEffectiveCostPerServing(product),
      };
    });
  } catch (error) {
    console.error(`Error consuming servings for product ${productId}:`, error);
    throw error;
  }
}

/**
 * Soft delete — sets isActive: false so historical invoice lines still resolve.
 * The product disappears from getAll() but its data is preserved in Firestore.
 */
async function deleteProduct(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), { isActive: false });
  } catch (error) {
    console.error(`Error soft-deleting product ${id}:`, error);
    throw error;
  }
}

export { deleteProduct as delete };