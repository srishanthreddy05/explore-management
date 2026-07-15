"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wallet, Sparkles, User, Calendar } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";

export default function CreditTracker() {
  const [pendingCredits, setPendingCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Real-time Firestore listener for unpaid/partially paid invoices
    const q = query(
      collection(db, "invoices"),
      where("paymentStatus", "in", ["unpaid", "partial"])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          const invoice = doc.data();
          const paymentSplit = invoice.paymentSplit || {};
          const paymentStatus = invoice.paymentStatus || "paid";

          const cashPaid = paymentSplit.cash ?? (invoice.paymentMethod === "Cash" ? invoice.grandTotal : 0);
          const upiPaid = paymentSplit.upi ?? (invoice.paymentMethod === "UPI" ? invoice.grandTotal : 0);
          const cardPaid = paymentSplit.card ?? (invoice.paymentMethod === "Card" ? invoice.grandTotal : 0);
          
          const totalPaid = paymentStatus === "unpaid"
            ? 0
            : paymentStatus === "paid"
              ? ((cashPaid || 0) + (upiPaid || 0) + (cardPaid || 0) || invoice.grandTotal)
              : ((cashPaid || 0) + (upiPaid || 0) + (cardPaid || 0));

          const outstanding = invoice.grandTotal - totalPaid;

          if (outstanding > 0) {
            list.push({
              id: doc.id,
              ...invoice,
              totalPaid,
              outstanding,
            });
          }
        });
        
        // Sort by invoice date descending client-side
        list.sort((a, b) => {
          const getVal = (x: any) => {
            const ts = x.invoiceDate || x.createdAt || x.date;
            if (!ts) return 0;
            if (ts.toMillis) return ts.toMillis();
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === "string") return new Date(ts).getTime();
            if (typeof ts.seconds === "number") return ts.seconds * 1000;
            return 0;
          };
          return getVal(b) - getVal(a);
        });

        setPendingCredits(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to unpaid invoices:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Recalculate dropdown position whenever it opens
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setIsOpen((prev) => !prev);
  };

  // Close on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  const totalPendingCount = pendingCredits.length;

  if (loading) {
    return (
      <div className="grid size-11 place-items-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-300">
        <Wallet size={18} className="animate-pulse" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="relative grid size-11 place-items-center rounded-2xl border border-stone-200 bg-stone-50 text-black transition hover:bg-stone-100 cursor-pointer"
        aria-label="Credit Customer Tracker"
        title="Credit Customer Tracker"
      >
        <Wallet size={18} className={totalPendingCount > 0 ? "animate-pulse text-amber-600" : ""} />
        {totalPendingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-bounce">
            {totalPendingCount}
          </span>
        )}
      </button>

      {isOpen && typeof window !== "undefined" && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown panel */}
          <div
            className="fixed z-[9999] w-80 sm:w-96 rounded-2xl border border-stone-200 bg-white p-5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-4 text-stone-800"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                  <Wallet size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900 text-left">Outstanding Credits</h2>
                  <p className="text-[10px] text-stone-400 font-semibold mt-0.5 text-left">Track clients paying later</p>
                </div>
              </div>
              {totalPendingCount > 0 && (
                <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full select-none shrink-0 border border-amber-100">
                  {totalPendingCount} Invoice{totalPendingCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              {totalPendingCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-stone-400">
                  <Sparkles size={24} className="text-amber-500 mb-2 animate-pulse" />
                  <p className="text-xs font-semibold text-stone-600">Zero outstanding credit!</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">All customer payments are settled.</p>
                </div>
              ) : (
                pendingCredits.map((invoice) => {
                  const paymentStatus = invoice.paymentStatus || "paid";
                  const dateObj =
                    invoice.invoiceDate && typeof invoice.invoiceDate.toDate === "function"
                      ? invoice.invoiceDate.toDate()
                      : invoice.createdAt && typeof invoice.createdAt.toDate === "function"
                        ? invoice.createdAt.toDate()
                        : invoice.date && typeof invoice.date.toDate === "function"
                          ? invoice.date.toDate()
                          : null;
                  const creditDate = dateObj
                    ? dateObj.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—";

                  return (
                    <div
                      key={invoice.id}
                      className="flex flex-col gap-2.5 p-3.5 bg-stone-50 border border-stone-150 rounded-2xl text-xs text-stone-700"
                    >
                      {/* Top Row: Customer Name & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid size-7 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                            <User size={13} />
                          </div>
                          <span className="font-bold text-stone-900 truncate block">
                            {invoice.customerName}
                          </span>
                        </div>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border select-none shrink-0 ${
                            paymentStatus === "unpaid"
                              ? "bg-red-50 text-red-700 border-red-100"
                              : "bg-amber-50 text-amber-700 border-amber-100"
                          }`}
                        >
                          {paymentStatus === "unpaid" ? "UNPAID" : "PARTIAL"}
                        </span>
                      </div>

                      {/* Middle Details: Invoice No & Date */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium px-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-stone-200/60 px-1.5 py-0.5 rounded font-bold text-stone-700">
                            {invoice.invoiceNumber || invoice.invoiceNo}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={11} className="text-stone-400" />
                          <span>{creditDate}</span>
                        </div>
                      </div>

                      {/* Financials Row */}
                      <div className="grid grid-cols-3 gap-2.5 bg-white border border-stone-100 p-2.5 rounded-xl text-center text-[10px] text-stone-500 font-semibold shadow-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-stone-400">Total</span>
                          <span className="font-bold text-stone-800 text-[11px]">
                            {formatCurrency(invoice.grandTotal)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 border-x border-stone-100">
                          <span className="text-stone-400">Paid</span>
                          <span className="font-bold text-stone-800 text-[11px]">
                            {formatCurrency(invoice.totalPaid)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-amber-700 font-bold">Due</span>
                          <span className="font-black text-amber-700 text-[11px]">
                            {formatCurrency(invoice.outstanding)}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end mt-0.5">
                        <Link
                          href={`/billing?edit=${invoice.id}`}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#B8962E] hover:bg-[#D4A935] px-4 text-xs font-black uppercase tracking-wider text-[#0E0D0B] shadow-sm hover:shadow transition shrink-0 cursor-pointer"
                        >
                          Collect Payment
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
