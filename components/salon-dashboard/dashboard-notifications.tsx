"use client";

import { useEffect, useState } from "react";
import { Bell, Package, AlertTriangle, UserCheck, UserX, Check, Trash, Sparkles } from "lucide-react";
import * as productService from "@/services/products";
import * as customerService from "@/services/customers";
import * as notificationService from "@/services/notifications";
import type { Product } from "@/types/product";
import type { Customer } from "@/types/customer";
import type { Notification } from "@/types/notification";
import Link from "next/link";

export default function DashboardNotifications() {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [expiringMemberships, setExpiringMemberships] = useState<Customer[]>([]);
  const [dbNotifications, setDbNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = async () => {
    try {
      // 1. Fetch products and filter low stock / servings
      const allProducts = await productService.getAll();
      const lowStock = allProducts.filter((p) => {
        if (p.type === "service") {
          return (p.noOfServings ?? 0) < 3;
        } else {
          return (p.quantity ?? 0) < 5;
        }
      });
      setLowStockProducts(lowStock);

      // 2. Fetch memberships and filter expiring soon (within 7 days)
      const memberships = await customerService.getMemberships();
      const now = new Date();
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(now.getDate() + 7);

      const expiring = memberships.filter((c) => {
        if (!c.membershipEnd) return false;
        const end = new Date(c.membershipEnd);
        return end > now && end <= sevenDaysFromNow;
      });
      setExpiringMemberships(expiring);

      // 3. Fetch unread notifications from DB
      const allNotifications = await notificationService.getAll();
      const unread = allNotifications.filter((n) => !n.read);
      setDbNotifications(unread);
    } catch (error) {
      console.error("Error fetching dashboard notification data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Poll every 60 seconds to keep it fresh
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setDbNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleDismissProduct = (productId: string) => {
    setLowStockProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleDismissMembership = (customerId: string) => {
    setExpiringMemberships((prev) => prev.filter((c) => c.id !== customerId));
  };

  const totalAlertsCount = lowStockProducts.length + expiringMemberships.length + dbNotifications.length;

  if (loading) {
    return (
      <div className="grid size-11 place-items-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-300">
        <Bell size={18} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative grid size-11 place-items-center rounded-2xl border border-stone-200 bg-stone-50 text-black transition hover:bg-stone-100 cursor-pointer"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={18} className={totalAlertsCount > 0 ? "animate-swing" : ""} />
        {totalAlertsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {totalAlertsCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close the dropdown when clicking outside */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Dropdown panel */}
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Bell size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900 text-left">Notifications & Alerts</h2>
                  <p className="text-[10px] text-stone-400 font-semibold mt-0.5 text-left">Critical stock and membership updates</p>
                </div>
              </div>
              {totalAlertsCount > 0 && (
                <span className="inline-flex items-center justify-center bg-stone-100 text-stone-850 text-[10px] font-bold px-2 py-0.5 rounded-full select-none shrink-0">
                  {totalAlertsCount} Alert{totalAlertsCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
              {totalAlertsCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-stone-400">
                  <Sparkles size={24} className="text-stone-300 mb-2 animate-pulse" />
                  <p className="text-xs font-semibold text-stone-600">All caught up!</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">No pending stock or membership alerts.</p>
                </div>
              ) : (
                <>
                  {/* 1. Low Stock Products Alerts */}
                  {lowStockProducts.map((p) => (
                    <div 
                      key={p.id}
                      className="flex items-center justify-between gap-4 p-3 bg-rose-50/50 border border-rose-100 rounded-2xl text-xs text-rose-900"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Package size={14} className="text-rose-600 shrink-0" />
                        <div className="min-w-0 text-left">
                          <span className="font-bold text-rose-950 truncate block mr-1">{p.name}</span>
                          <span className="font-medium text-rose-800">
                            {p.type === "service" ? (
                              <>Only <b>{p.noOfServings ?? 0}</b> servings left.</>
                            ) : (
                              <>Only <b>{p.quantity}</b> remaining.</>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link 
                          href="/products" 
                          onClick={() => setIsOpen(false)}
                          className="font-bold text-rose-700 hover:text-rose-900 hover:underline transition px-2 py-1 rounded-lg hover:bg-rose-100/50"
                        >
                          Reorder
                        </Link>
                        <button
                          onClick={() => p.id && handleDismissProduct(p.id)}
                          className="p-1 rounded-lg hover:bg-rose-100/50 text-rose-400 hover:text-rose-700 cursor-pointer"
                          title="Dismiss warning"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* 2. Expiring Memberships Alerts */}
                  {expiringMemberships.map((c) => {
                    const daysLeft = Math.ceil(
                      (new Date(c.membershipEnd!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                    );
                    
                    return (
                      <div 
                        key={c.id}
                        className="flex items-center justify-between gap-4 p-3 bg-amber-50/50 border border-amber-100 rounded-2xl text-xs text-amber-900"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserCheck size={14} className="text-amber-600 shrink-0" />
                          <div className="min-w-0 text-left">
                            <span className="font-bold text-amber-950 truncate block mr-1">{c.name}</span>
                            <span className="font-medium text-amber-800">
                              Expiring in <b>{daysLeft} days</b>.
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link 
                            href="/customers" 
                            onClick={() => setIsOpen(false)}
                            className="font-bold text-amber-700 hover:text-amber-900 hover:underline transition px-2 py-1 rounded-lg hover:bg-amber-100/50"
                          >
                            Renew
                          </Link>
                          <button
                            onClick={() => c.id && handleDismissMembership(c.id)}
                            className="p-1 rounded-lg hover:bg-amber-100/50 text-amber-400 hover:text-amber-700 cursor-pointer"
                            title="Dismiss warning"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* 3. DB Notifications */}
                  {dbNotifications.map((n) => (
                    <div 
                      key={n.id}
                      className="flex items-center justify-between gap-4 p-3 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-700"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 text-left">
                        <UserX size={14} className="text-stone-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-bold text-stone-900 truncate block mr-1">{n.title}</span>
                          <span className="font-medium text-stone-600">{n.message}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => n.id && handleMarkAsRead(n.id)}
                        className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 cursor-pointer shrink-0"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
