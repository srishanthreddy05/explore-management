"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import type { Service } from "@/types/service";
import type { Product } from "@/types/product";
import type { Staff } from "@/types/staff";
import type { Offer } from "@/types/offer";
import type { Settings } from "@/types/settings";
import { getSettings } from "@/services/settings";
import {
  CACHE_TTL,
  CACHE_KEYS,
  readCache,
  writeCache,
  clearCache,
  isCacheExpired,
} from "@/lib/cache";

interface AppDataContextType {
  services: Service[];
  products: Product[];
  staff: Staff[];
  offers: Offer[];
  settings: Settings | null;
  loadingAppData: boolean;
  refreshServices: () => Promise<Service[]>;
  refreshProducts: () => Promise<Product[]>;
  refreshStaff: () => Promise<Staff[]>;
  refreshOffers: () => Promise<Offer[]>;
  refreshSettings: () => Promise<Settings | null>;
  invalidateCache: (key: "services" | "products" | "settings") => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingAppData, setLoadingAppData] = useState(true);

  const loadServices = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingAppData(true);
    try {
      const cached = readCache<Service>(CACHE_KEYS.services, CACHE_TTL.services);
      if (cached) {
        setServices(cached);
        return cached;
      }
      const q = query(
        collection(db, "services"),
        where("isActive", "==", true),
        orderBy("name", "asc")
      );
      const snap = await getDocs(q);
      const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service));
      writeCache(CACHE_KEYS.services, result);
      setServices(result);
      return result;
    } catch (err) {
      console.error("Error loading services:", err);
      const fallback = readCache<Service>(CACHE_KEYS.services, Infinity);
      if (fallback) {
        setServices(fallback);
        return fallback;
      } else {
        setServices([]);
        return [];
      }
    } finally {
      if (showLoading) setLoadingAppData(false);
    }
  }, []);

  const loadProducts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingAppData(true);
    try {
      const cached = readCache<Product>(CACHE_KEYS.products, CACHE_TTL.products);
      if (cached) {
        setProducts(cached);
        return cached;
      }
      const q = query(
        collection(db, "products"),
        where("isActive", "==", true),
        orderBy("name", "asc")
      );
      const snap = await getDocs(q);
      const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
      writeCache(CACHE_KEYS.products, result);
      setProducts(result);
      return result;
    } catch (err) {
      console.error("Error loading products:", err);
      const fallback = readCache<Product>(CACHE_KEYS.products, Infinity);
      if (fallback) {
        setProducts(fallback);
        return fallback;
      } else {
        setProducts([]);
        return [];
      }
    } finally {
      if (showLoading) setLoadingAppData(false);
    }
  }, []);

  const loadOffers = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingAppData(true);
    try {
      const q = query(
        collection(db, "offers"),
        orderBy("code", "asc")
      );
      const snap = await getDocs(q);
      const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Offer));
      setOffers(result);
      return result;
    } catch (err) {
      console.error("Error loading offers:", err);
      setOffers([]);
      return [];
    } finally {
      if (showLoading) setLoadingAppData(false);
    }
  }, []);

  const loadStaff = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingAppData(true);
    try {
      const snap = await getDocs(collection(db, "staff"));
      const result = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Staff)).sort((a, b) => a.name.localeCompare(b.name));
      setStaff(result);
      return result;
    } catch (err) {
      console.error("Error loading staff:", err);
      setStaff([]);
      return [];
    } finally {
      if (showLoading) setLoadingAppData(false);
    }
  }, []);

  const loadSettings = useCallback(async (showLoading = false) => {
    if (showLoading) setLoadingAppData(true);
    try {
      const data = await getSettings();
      setSettings(data);
      return data;
    } catch (err) {
      console.error("Error loading settings in context:", err);
      setSettings(null);
      return null;
    } finally {
      if (showLoading) setLoadingAppData(false);
    }
  }, []);

  const refreshServices = useCallback(() => {
    clearCache(CACHE_KEYS.services);
    return loadServices(false);
  }, [loadServices]);

  const refreshProducts = useCallback(() => {
    clearCache(CACHE_KEYS.products);
    return loadProducts(false);
  }, [loadProducts]);

  const refreshStaff = useCallback(() => {
    return loadStaff(false);
  }, [loadStaff]);

  const refreshOffers = useCallback(() => {
    return loadOffers(false);
  }, [loadOffers]);

  const refreshSettings = useCallback(() => {
    clearCache(CACHE_KEYS.settings);
    return loadSettings(false);
  }, [loadSettings]);

  const invalidateCache = useCallback((key: "services" | "products" | "settings") => {
    clearCache(CACHE_KEYS[key]);
  }, []);

  useEffect(() => {
    async function initLoad() {
      setLoadingAppData(true);
      try {
        await Promise.all([
          loadServices(false),
          loadProducts(false),
          loadOffers(false),
          loadStaff(false),
          loadSettings(false),
        ]);
      } catch (err) {
        console.error("Failed parallel initialization load:", err);
      } finally {
        setLoadingAppData(false);
      }
    }
    initLoad();
  }, [loadServices, loadProducts, loadOffers, loadStaff, loadSettings]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (isCacheExpired(CACHE_KEYS.services, CACHE_TTL.services)) {
          refreshServices();
        }
        if (isCacheExpired(CACHE_KEYS.products, CACHE_TTL.products)) {
          refreshProducts();
        }
        if (isCacheExpired(CACHE_KEYS.settings, CACHE_TTL.settings)) {
          refreshSettings();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshServices, refreshProducts, refreshSettings]);

  useEffect(() => {
    if (loadingAppData) return;

    const unsubStaff = onSnapshot(
      collection(db, "staff"),
      (snapshot) => {
        setStaff((prevStaff) => {
          let hasChanges = false;
          const updated = prevStaff.map((member) => {
            const change = snapshot.docChanges().find(
              (c) => c.doc.id === member.id && c.type === "modified"
            );
            if (change) {
              const newData = change.doc.data();
              const dutyChanged = member.dutyStatus !== newData.dutyStatus;
              const logsChanged = JSON.stringify(member.clockLogs) !== JSON.stringify(newData.clockLogs);

              if (dutyChanged || logsChanged) {
                hasChanges = true;
                return {
                  ...member,
                  dutyStatus: newData.dutyStatus,
                  clockLogs: newData.clockLogs,
                } as Staff;
              }
            }
            return member;
          });

          // Handle newly added staff
          const currentIds = new Set(prevStaff.map((s) => s.id));
          const addedStaff: Staff[] = [];
          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !currentIds.has(change.doc.id)) {
              hasChanges = true;
              addedStaff.push({
                id: change.doc.id,
                ...change.doc.data(),
              } as Staff);
            }
          });

          // Handle deleted staff
          const removedIds = new Set(
            snapshot.docChanges()
              .filter((c) => c.type === "removed")
              .map((c) => c.doc.id)
          );
          if (removedIds.size > 0) {
            hasChanges = true;
          }

          if (!hasChanges && addedStaff.length === 0 && removedIds.size === 0) {
            return prevStaff;
          }

          let finalStaff = updated;
          if (removedIds.size > 0) {
            finalStaff = finalStaff.filter((s) => !s.id || !removedIds.has(s.id));
          }
          if (addedStaff.length > 0) {
            finalStaff = [...finalStaff, ...addedStaff];
          }

          return finalStaff.sort((a, b) => a.name.localeCompare(b.name));
        });
      },
      (err) => console.error("Staff real-time listener error:", err)
    );

    return () => {
      unsubStaff();
    };
  }, [loadingAppData]);

  const contextValue = useMemo(() => ({
    services,
    products,
    staff,
    offers,
    settings,
    loadingAppData,
    refreshServices,
    refreshProducts,
    refreshStaff,
    refreshOffers,
    refreshSettings,
    invalidateCache,
  }), [
    services,
    products,
    staff,
    offers,
    settings,
    loadingAppData,
    refreshServices,
    refreshProducts,
    refreshStaff,
    refreshOffers,
    refreshSettings,
    invalidateCache,
  ]);

  return (
    <AppDataContext.Provider value={contextValue}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (context === undefined) {
    throw new Error("useAppData must be used within an AppDataProvider");
  }
  return context;
}
