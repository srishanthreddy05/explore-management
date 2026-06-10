"use client";

import {
  BadgePercent,
  BarChart3,
  CalendarDays,
  CreditCard,
  Gauge,
  Menu,
  Package,
  ReceiptText,
  Scissors,
  Users,
  WalletCards,
  Settings,
  X,
  Boxes,
  BadgeDollarSign,
  History,
  Coins,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useEffect, useState } from "react";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge },
  { label: "Appointments", href: "/appointments", icon: CalendarDays },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Services", href: "/services", icon: Scissors },
  { label: "Products", href: "/products", icon: Package },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Invoices", href: "/invoices", icon: History },
  { label: "Staff", href: "/staff", icon: BadgePercent },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Offers", href: "/offers", icon: WalletCards },
  { label: "Expenses", href: "/expenses", icon: Coins },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const [salonName, setSalonName] = useState("Explore");
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    async function initSubscription() {
      try {
        const { subscribeSettings } = await import("@/services/settings");
        unsubscribe = subscribeSettings((settings) => {
          if (active) {
            const firstWord = settings.salonName.split(" ")[0];
            setSalonName(firstWord);
          }
        });
      } catch (err) {
        console.error("Failed to load sidebar settings subscription:", err);
      }
    }
    initSubscription();

    async function loadProducts() {
      try {
        const { getAll } = await import("@/services/products");
        const productsList = await getAll();
        const lowStock = productsList.filter((p) => p.quantity <= 5).length;
        if (active) {
          setLowStockCount(lowStock);
        }
      } catch (err) {
        console.error("Failed to load products for sidebar:", err);
      }
    }
    loadProducts();

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const navList = (isMobile: boolean) => (
    <nav className="space-y-2">
      {menuItems.map((item) => (
        <SidebarItem
          key={item.label}
          label={item.label}
          href={item.href}
          icon={item.icon}
          collapsed={isMobile ? false : collapsed}
          onClick={isMobile ? () => setMobileOpen(false) : undefined}
        />
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop/Tablet Collapsible Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-30 hidden border-r border-stone-850 bg-black shadow-2xl transition-all duration-300 lg:block ${
          collapsed ? "w-24" : "w-72"
        }`}
      >
        <div className="flex h-full flex-col p-4">
          <div className="mb-8 flex h-14 items-center justify-between">
            <div className="flex min-w-0 items-center">
              {!collapsed && (
                <div>
                  <p className="text-lg font-bold tracking-wide text-white">{salonName}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Salon ERP</p>
                </div>
              )}
            </div>
            <button
              aria-label="Toggle sidebar"
              onClick={onToggle}
              className={`grid size-10 place-items-center rounded-2xl border border-white/10 text-stone-300 transition hover:border-white hover:bg-white/10 hover:text-white ${
                collapsed ? "mx-auto" : ""
              }`}
            >
              <Menu size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 select-none font-medium">
            {navList(false)}
          </div>

          {!collapsed && (
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Boxes size={18} />
                <span className="text-sm font-semibold">Inventory Alert</span>
              </div>
              <p className="text-sm leading-6 text-stone-300">
                {lowStockCount > 0
                  ? `${lowStockCount} products are close to reorder level.`
                  : "All products are sufficiently stocked."}
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Navigation overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <aside className="fixed bottom-0 left-0 top-0 z-50 w-72 border-r border-stone-850 bg-black p-4 flex flex-col shadow-2xl transition-transform duration-300">
            <div className="mb-8 flex h-14 items-center justify-between">
              <div className="flex min-w-0 items-center">
                <div>
                  <p className="text-lg font-bold tracking-wide text-white">{salonName}</p>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">Salon ERP</p>
                </div>
              </div>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="grid size-10 place-items-center rounded-2xl border border-white/10 text-stone-300 transition hover:border-white hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 select-none font-medium">
              {navList(true)}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center gap-2 text-white">
                <Boxes size={18} />
                <span className="text-sm font-semibold">Inventory Alert</span>
              </div>
              <p className="text-sm leading-6 text-stone-300">
                {lowStockCount > 0
                  ? `${lowStockCount} products are close to reorder level.`
                  : "All products are sufficiently stocked."}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
