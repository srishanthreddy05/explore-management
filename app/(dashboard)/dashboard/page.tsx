"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import * as staffService from "@/services/staff";
import { formatCurrency } from "@/components/salon-dashboard/types";
import type { Staff } from "@/types/staff";
import {
  CalendarDays,
  CreditCard,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [staffLoaded, setStaffLoaded] = useState(false);

  useEffect(() => {
    // Realtime listener for invoices
    const unsubInvoices = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() });
        });
        setInvoices(list);
        setInvoicesLoaded(true);
      },
      (err) => console.error("Invoices listener error:", err)
    );

    // Realtime listener for staff
    const unsubStaff = onSnapshot(
      collection(db, "staff"),
      (snapshot) => {
        const list: Staff[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Staff);
        });
        // Sort alphabetically by name
        list.sort((a, b) => a.name.localeCompare(b.name));
        setStaff(list);
        setStaffLoaded(true);
      },
      (err) => console.error("Staff listener error:", err)
    );

    return () => {
      unsubInvoices();
      unsubStaff();
    };
  }, []);

  const toggleDutyStatus = async (member: Staff) => {
    if (!member.id) return;
    const currentStatus = member.dutyStatus || "offDuty";
    const newStatus = currentStatus === "onDuty" ? "offDuty" : "onDuty";
    try {
      await staffService.update(member.id, { dutyStatus: newStatus });
    } catch (error) {
      console.error("Failed to update staff duty status:", error);
    }
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayRevenue = 0;
    let monthlyRevenue = 0;
    let todayVisits = 0;
    let cashToday = 0;
    let upiToday = 0;
    let cardToday = 0;

    invoices.forEach((inv) => {
      const cash = inv.payments?.cash ?? (inv.paymentMethod === "Cash" ? (inv.grandTotal || 0) : 0);
      const upi = inv.payments?.upi ?? (inv.paymentMethod === "UPI" ? (inv.grandTotal || 0) : 0);
      const card = inv.payments?.card ?? (inv.paymentMethod === "Card" ? (inv.grandTotal || 0) : 0);
      const totalPaid = cash + upi + card;

      if (inv.date === todayStr) {
        todayRevenue += totalPaid;
        todayVisits += 1;
        cashToday += cash;
        upiToday += upi;
        cardToday += card;
      }

      const invDate = new Date(inv.date);
      if (
        invDate.getMonth() === currentMonth &&
        invDate.getFullYear() === currentYear
      ) {
        monthlyRevenue += totalPaid;
      }
    });

    const onDutyStaffCount = staff.filter((s) => s.dutyStatus === "onDuty").length;

    return {
      todayRevenue,
      monthlyRevenue,
      todayVisits,
      cashToday,
      upiToday,
      cardToday,
      onDutyStaff: onDutyStaffCount,
    };
  }, [invoices, staff]);

  const loading = !(invoicesLoaded && staffLoaded);

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Analytics
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Dashboard Overview
          </h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.8fr_1.2fr]">
        {/* Left Column: Metrics & Quick Actions */}
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {/* Today's Collection Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span className="text-sm font-bold">Today's Collection</span>
                <TrendingUp size={20} className="opacity-80 text-stone-600" />
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                {formatCurrency(stats.todayRevenue)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-3 text-center">
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Cash</p>
                  <p className="text-xs font-bold text-stone-850">{formatCurrency(stats.cashToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">UPI</p>
                  <p className="text-xs font-bold text-stone-850">{formatCurrency(stats.upiToday)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider">Card</p>
                  <p className="text-xs font-bold text-stone-850">{formatCurrency(stats.cardToday)}</p>
                </div>
              </div>
            </div>

            {/* Monthly Revenue Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-stone-500">
                  <span className="text-sm font-bold">Monthly Revenue</span>
                  <CreditCard size={20} className="opacity-80 text-stone-600" />
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                  {formatCurrency(stats.monthlyRevenue)}
                </p>
              </div>
              <p className="mt-2 text-xs text-stone-400">Sales in current month</p>
            </div>

            {/* Today's Visits Card */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-stone-500">
                  <span className="text-sm font-bold">Today's Visits</span>
                  <CalendarDays size={20} className="opacity-80 text-stone-600" />
                </div>
                <p className="mt-3 text-3xl font-bold tracking-tight text-stone-900">
                  {stats.todayVisits}
                </p>
              </div>
              <p className="mt-2 text-xs text-stone-400">Customers served today</p>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Quick Actions</h2>
            <div className="flex flex-wrap gap-4">
              <a
                href="/billing"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-850 transition shadow-sm"
              >
                Open Billing Terminal
              </a>
              <a
                href="/customers"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition shadow-sm"
              >
                Add Customer
              </a>
              <a
                href="/appointments"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-stone-200 bg-white px-6 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition shadow-sm"
              >
                Create Appointment
              </a>
            </div>
          </section>
        </div>

        {/* Right Column: Staff Duty Status list */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-stone-900">Staff Duty Status</h2>
            <p className="text-xs text-stone-400">
              Manage daily active stylists ready on floor
            </p>
          </div>

          <div className="space-y-6">
            {/* On Duty Section */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-3 inline-block">
                On Duty ({stats.onDutyStaff})
              </h3>
              {staff.filter(s => s.dutyStatus === "onDuty").length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2 pl-2">No stylists on duty.</p>
              ) : (
                <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                  {staff
                    .filter(s => s.dutyStatus === "onDuty")
                    .map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="font-semibold text-stone-900 text-sm">{member.name}</span>
                        <button
                          onClick={() => toggleDutyStatus(member)}
                          className="h-8 items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 px-3 text-xs font-bold text-white transition shadow-sm"
                        >
                          Off Duty
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Off Duty Section */}
            <div className="border-t border-stone-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-stone-600 bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg mb-3 inline-block">
                Off Duty ({staff.length - stats.onDutyStaff})
              </h3>
              {staff.filter(s => s.dutyStatus !== "onDuty").length === 0 ? (
                <p className="text-xs text-stone-400 italic py-2 pl-2">No stylists off duty.</p>
              ) : (
                <div className="divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                  {staff
                    .filter(s => s.dutyStatus !== "onDuty")
                    .map((member) => (
                      <div key={member.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="font-semibold text-stone-900 text-sm">{member.name}</span>
                        <button
                          onClick={() => toggleDutyStatus(member)}
                          className="h-8 items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 text-xs font-bold text-white transition shadow-sm"
                        >
                          On Duty
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
