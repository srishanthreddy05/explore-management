export interface CacheEntry<T> {
  data: T[];
  cachedAt: number;
}

export const CACHE_TTL = {
  services: 60 * 60 * 1000,       // 1 hour
  products: 30 * 60 * 1000,        // 30 minutes
  offers:   60 * 60 * 1000,        // 1 hour
  settings: 24 * 60 * 60 * 1000,   // 24 hours
};

export const CACHE_KEYS = {
  services: "cache_services_v1",
  products: "cache_products_v1",
  offers:   "cache_offers_v1",
  settings: "cache_settings_v1",
};

export function readCache<T>(key: string, ttl: number): T[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (!entry || typeof entry.cachedAt !== "number" || typeof entry.data === "undefined") {
      return null;
    }
    if (Date.now() - entry.cachedAt < ttl) {
      return entry.data;
    }
    return null;
  } catch (error) {
    console.error(`Failed to read cache for key ${key}:`, error);
    return null;
  }
}

export function writeCache<T>(key: string, data: T[]): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error(`Failed to write cache for key ${key}:`, error);
  }
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear cache for key ${key}:`, error);
  }
}

export function isCacheExpired(key: string, ttl: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.cachedAt !== "number" || typeof entry.data === "undefined") {
      return true;
    }
    return Date.now() - entry.cachedAt >= ttl;
  } catch {
    return true;
  }
}
