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
} from "firebase/firestore";
import type { Product } from "@/types/product";

const COLLECTION = "products";

export async function create(product: Omit<Product, "id">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...product,
      isActive: true,
      createdAt: serverTimestamp(),
    });
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

export async function update(
  id: string,
  data: Partial<Omit<Product, "id">>
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTION, id), data as Record<string, unknown>);
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
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