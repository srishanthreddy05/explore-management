import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Service } from "@/types/service";

export interface ServiceProductMapping {
  id?: string;
  serviceId: string;
  serviceName: string;
  productName: string;
  usageCost: number;
  isActive?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const COLLECTION = "serviceProductMappings";

// Initial salon configuration. These records are written to Firestore once per
// matching service; billing reads the saved documents, not this defaults list.
const DEFAULT_MAPPINGS = [
  // Hair colour services — names match the live Services catalogue.
  { serviceName: "Beard Color Regular", productName: "Beard Color", usageCost: 20 },
  { serviceName: "Beard Color Lorea'l", productName: "Beard Color L'Oréal", usageCost: 40 },
  { serviceName: "Natural Color", productName: "Natural Color", usageCost: 30 },
  { serviceName: "Burgandy", productName: "Burgundy", usageCost: 50 },
  { serviceName: "Creative Colors", productName: "Creative Color", usageCost: 100 },
  { serviceName: "Lorea'l", productName: "L'Oréal", usageCost: 50 },
  { serviceName: "Matrix Ammonia", productName: "Matrix", usageCost: 40 },
  { serviceName: "Streax", productName: "Streax", usageCost: 40 },

  // Hair treatment services — names match the live Services catalogue.
  { serviceName: "Botox Apl", productName: "Botox", usageCost: 300 },
  { serviceName: "Botox Extra Lenght", productName: "Botox Extra Length", usageCost: 100 },
  { serviceName: "Dandruff Treatment", productName: "Dandruff Treatment", usageCost: 100 },
  { serviceName: "Hair Fall Treatment", productName: "Hairfall Treatment", usageCost: 100 },
  { serviceName: "Keratin Apl", productName: "Keratin", usageCost: 250 },
  { serviceName: "Regular Spa", productName: "Regular Spa", usageCost: 50 },
  { serviceName: "Straightening", productName: "Straightening", usageCost: 250 },
] as const;

const normalize = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

export async function getAll(): Promise<ServiceProductMapping[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTION), where("isActive", "==", true))
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ServiceProductMapping));
}

export async function save(
  mapping: Omit<ServiceProductMapping, "id" | "createdAt" | "updatedAt">
): Promise<void> {
  if (!mapping.serviceId) throw new Error("Please select a service.");
  if (!mapping.productName.trim()) throw new Error("Product name is required.");
  if (!Number.isFinite(mapping.usageCost) || mapping.usageCost < 0) {
    throw new Error("Enter a valid usage cost.");
  }

  const ref = doc(db, COLLECTION, mapping.serviceId);
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ...mapping,
    productName: mapping.productName.trim(),
    isActive: true,
    ...(existing.exists() ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
  }, { merge: true });
}

export async function remove(serviceId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, serviceId), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}

export async function seedDefaultMappings(services: Service[]): Promise<ServiceProductMapping[]> {
  const existing = await getAll();
  const existingIds = new Set(existing.map((item) => item.serviceId));
  const byName = new Map(services.map((service) => [normalize(service.name), service]));

  // Apply the shared facial product cost to every facial service/category.
  for (const service of services) {
    const isFacial = normalize(service.category || "").includes("facial") || normalize(service.name).includes("facial");
    if (!isFacial || !service.id || existingIds.has(service.id)) continue;
    await save({
      serviceId: service.id,
      serviceName: service.name,
      productName: "All Facials",
      usageCost: 100,
    });
    existingIds.add(service.id);
  }

  for (const defaults of DEFAULT_MAPPINGS) {
    const service = byName.get(normalize(defaults.serviceName));
    if (!service?.id || existingIds.has(service.id)) continue;
    await save({
      serviceId: service.id,
      serviceName: service.name,
      productName: defaults.productName,
      usageCost: defaults.usageCost,
    });
    existingIds.add(service.id);
  }

  return getAll();
}
