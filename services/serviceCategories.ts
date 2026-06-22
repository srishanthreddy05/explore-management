import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import type { ServiceCategory } from "@/types/serviceCategory";
import { toTitleCase } from "@/lib/utils/text";

const COLLECTION_NAME = "serviceCategories";

export async function getAll(): Promise<ServiceCategory[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    const categories: ServiceCategory[] = [];
    querySnapshot.forEach((doc) => {
      categories.push({ id: doc.id, ...doc.data() } as ServiceCategory);
    });
    return categories;
  } catch (error) {
    console.error("Error getting service categories:", error);
    throw error;
  }
}

export async function create(name: string): Promise<string> {
  try {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Category name cannot be empty");
    }

    const titleCased = toTitleCase(trimmed);

    // Fetch existing categories to perform case-insensitive duplicate check
    const categories = await getAll();
    const exists = categories.some(
      (c) => c.name.toLowerCase() === titleCased.toLowerCase()
    );

    if (exists) {
      throw new Error(`Category "${titleCased}" already exists.`);
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      name: titleCased,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating service category in Firestore:", error);
    throw error;
  }
}
