"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Wallet, Sparkles, User, Calendar, X, Check, DollarSign } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import type { CreditBalance } from "@/types/creditBalance";
import type { Invoice } from "@/types/invoice";
import { buildUnifiedCreditTracker, UnifiedCreditItem } from "@/lib/utils/creditTracker";
import * as invoicesService from "@/services/invoices";

export default function CreditTracker() {
  const [pendingCredits, setPendingCredits] = useState<CreditBalance[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [creditsLoaded, setCreditsLoaded] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  // In-place Payment Collection Modal state
  const [selectedItemForPayment, setSelectedItemForPayment] = useState<UnifiedCreditItem | null>(null);
  const [collectAmount, setCollectAmount] = useState<number | "">("");
  const [collectMethod, setCollectMethod] = useState<"cash" | "upi" | "card">("upi");
  const [collectNote, setCollectNote] = useState("");
  const [isCollecting, setIsCollecting] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 1. Real-time listeners on credit_balances and invoices collections
  useEffect(() => {
    let isMounted = true;

    const unsubCredits = onSnapshot(
      collection(db, "credit_balances"),
      (snapshot) => {
        if (!isMounted) return;
        const list: CreditBalance[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as CreditBalance);
        });
        setPendingCredits(list);
        setCreditsLoaded(true);
      },
      (error) => {
        console.error("Error listening to credit_balances:", error);
        if (!isMounted) return;
        setQueryError("Failed to load credit balances.");
        setCreditsLoaded(true);
      }
    );

    const unsubInvoices = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        if (!isMounted) return;
        const invList: Invoice[] = [];
        snapshot.forEach((d) => {
          invList.push({ id: d.id, ...d.data() } as Invoice);
        });
        setInvoices(invList);
        setInvoicesLoaded(true);
      },
      (error) => {
        console.error("Error listening to invoices:", error);
        if (!isMounted) return;
        setQueryError("Failed to load invoices.");
        setInvoicesLoaded(true);
      }
    );

    return () => {
      isMounted = false;
      unsubCredits();
      unsubInvoices();
    };
  }, []);

  const refreshInvoices = async () => {
    try {
      const snap = await getDocs(collection(db, "invoices"));
      const invList: Invoice[] = [];
      snap.forEach((d) => {
        invList.push({ id: d.id, ...d.data() } as Invoice);
      });
      setInvoices(invList);
    } catch (e) {
      console.error("Failed to load invoices for credit tracker:", e);
    }
  };

  const isReady = creditsLoaded && invoicesLoaded && !queryError;
  const loading = !creditsLoaded || !invoicesLoaded;

  // 3. Build unified, grouped credit tracker view
  const summary = useMemo(() => {
    if (!isReady) {
      return {
        items: [],
        totalDue: 0,
        totalCredit: 0,
        totalPaid: 0,
        totalInvoicesCount: 0,
      };
    }
    return buildUnifiedCreditTracker(pendingCredits, invoices);
  }, [isReady, pendingCredits, invoices]);

  const totalPendingCount = summary.totalInvoicesCount;

  // Development-only diagnostics for navbar badge verification
  useEffect(() => {
    const rawCreditDocCount = pendingCredits.length;
    const pendingLedgerDocCount = pendingCredits.filter((c) => {
      const remaining = Number(c.remainingAmount !== undefined ? c.remainingAmount : (c.amount ?? 0));
      const statusLower = String(c.status || "").toLowerCase();
      const collectionStatusLower = String(c.collectionStatus || "").toLowerCase();
      return remaining > 0 && statusLower !== "settled" && collectionStatusLower !== "settled";
    }).length;
    const settledLedgerDocCount = pendingCredits.filter((c) => {
      const remaining = Number(c.remainingAmount !== undefined ? c.remainingAmount : (c.amount ?? 0));
      const statusLower = String(c.status || "").toLowerCase();
      const collectionStatusLower = String(c.collectionStatus || "").toLowerCase();
      return remaining <= 0 || statusLower === "settled" || collectionStatusLower === "settled";
    }).length;
    const uniqueInvoiceCount = summary.items.length;
    const uniqueInvoicesWithDuePositive = summary.items.filter((it) => it.due > 0).length;
    const unlinkedItems = summary.items.filter((i) => i.isUnlinkedInvoice);
    const unlinkedCount = unlinkedItems.length;
    const finalBadgeValue = totalPendingCount;

    console.log("[CreditTracker Diagnostic]", {
      rawCreditDocCount,
      pendingLedgerDocCount,
      settledLedgerDocCount,
      uniqueInvoiceCount,
      uniqueInvoicesWithDuePositive,
      unlinkedCount,
      finalBadgeValue,
    });

    if (unlinkedCount > 0) {
      console.table(unlinkedItems);
    }
  }, [pendingCredits, invoices, summary, totalPendingCount]);

  // Recalculate dropdown position whenever it opens
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
      refreshInvoices();
    }
    setIsOpen((prev) => !prev);
  };

  // Close on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      if (!selectedItemForPayment) {
        setIsOpen(false);
      }
    };
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [isOpen, selectedItemForPayment]);

  // Open Collect Payment modal
  const handleOpenCollect = (item: UnifiedCreditItem) => {
    setSelectedItemForPayment(item);
    setCollectAmount(item.due);
    setCollectMethod("upi");
    setCollectNote("");
    setPaymentFeedback(null);
  };

  // Submit payment collection
  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForPayment || collectAmount === "" || collectAmount <= 0) return;

    const amount = Number(collectAmount);
    if (amount > selectedItemForPayment.due) {
      setPaymentFeedback({
        type: "error",
        text: `Cannot collect more than the remaining balance of ${formatCurrency(selectedItemForPayment.due)}.`,
      });
      return;
    }

    setIsCollecting(true);
    setPaymentFeedback(null);

    try {
      const paymentSplit = {
        cash: collectMethod === "cash" ? amount : 0,
        upi: collectMethod === "upi" ? amount : 0,
        card: collectMethod === "card" ? amount : 0,
      };

      await invoicesService.collectCreditPayment(
        selectedItemForPayment.invoiceId,
        amount,
        paymentSplit,
        new Date(),
        collectNote
      );

      setPaymentFeedback({
        type: "success",
        text: `Successfully collected ${formatCurrency(amount)} for ${selectedItemForPayment.invoiceNumber}!`,
      });

      // Refresh invoices and close modal after brief delay
      await refreshInvoices();
      setTimeout(() => {
        setSelectedItemForPayment(null);
        setIsCollecting(false);
      }, 1200);
    } catch (err: any) {
      console.error("Payment collection error:", err);
      setPaymentFeedback({
        type: "error",
        text: err?.message || "Failed to log payment transaction.",
      });
      setIsCollecting(false);
    }
  };

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
            onClick={() => {
              if (!selectedItemForPayment) setIsOpen(false);
            }}
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
                  <p className="text-[10px] text-stone-400 font-semibold mt-0.5 text-left">
                    Total Due: <strong className="text-amber-700 font-bold">{formatCurrency(summary.totalDue)}</strong>
                  </p>
                </div>
              </div>
              {totalPendingCount > 0 && (
                <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full select-none shrink-0 border border-amber-100">
                  {totalPendingCount} Invoice{totalPendingCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
              {queryError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-red-500">
                  <p className="text-xs font-semibold">{queryError}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">Please check network or permissions.</p>
                </div>
              ) : totalPendingCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-stone-400">
                  <Sparkles size={24} className="text-amber-500 mb-2 animate-pulse" />
                  <p className="text-xs font-semibold text-stone-600">Zero outstanding credit!</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">All customer payments are settled.</p>
                </div>
              ) : (
                summary.items.map((item) => {
                  const dateObj = item.date ? new Date(item.date) : null;
                  const creditDate = dateObj && !isNaN(dateObj.getTime())
                    ? dateObj.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : item.date || "—";

                  const statusLabel = item.collectionStatus === "partial" ? "PARTIAL" : "UNPAID";
                  const statusClass =
                    item.collectionStatus === "partial"
                      ? "bg-amber-50 text-amber-700 border-amber-100"
                      : "bg-red-50 text-red-700 border-red-100";

                  const hasMultipleLedgers = item.creditDocIds.length > 1;

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2.5 p-3.5 bg-stone-50 border border-stone-150 rounded-2xl text-xs text-stone-700"
                    >
                      {/* Top Row: Customer Name & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="grid size-7 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                            <User size={13} />
                          </div>
                          <span className="font-bold text-stone-900 truncate block">
                            {item.customerName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {hasMultipleLedgers && (
                            <span className="inline-block rounded-full bg-stone-200/80 px-1.5 py-0.5 text-[8px] font-bold text-stone-600">
                              {item.creditDocIds.length} items
                            </span>
                          )}
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border select-none shrink-0 ${statusClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* Middle Details: Invoice No & Date */}
                      <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium px-0.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] bg-stone-200/60 px-1.5 py-0.5 rounded font-bold text-stone-700">
                            {item.invoiceNumber}
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
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 border-x border-stone-100">
                          <span className="text-stone-400">Paid</span>
                          <span className="font-bold text-stone-800 text-[11px]">
                            {formatCurrency(item.paid)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-amber-700 font-bold">Due</span>
                          <span className="font-black text-amber-700 text-[11px]">
                            {formatCurrency(item.due)}
                          </span>
                        </div>
                      </div>

                      {/* Action Button: Opens dedicated collection modal */}
                      <div className="flex justify-end mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCollect(item)}
                          className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#B8962E] hover:bg-[#D4A935] px-4 text-xs font-black uppercase tracking-wider text-[#0E0D0B] shadow-sm hover:shadow transition shrink-0 cursor-pointer"
                        >
                          Collect Payment
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Collect Payment Modal (renders inside portal) */}
          {selectedItemForPayment && (
            <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="w-full max-w-md rounded-2xl border border-[#2E2B24] bg-[#0E0D0B] p-6 shadow-2xl space-y-5 text-white">
                <div className="flex items-center justify-between border-b border-[#2E2B24] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="grid size-9 place-items-center rounded-xl bg-[#B8962E]/10 text-[#D4A935] border border-[#B8962E]/20">
                      <DollarSign size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#F5F0E8]">Collect Outstanding Payment</h3>
                      <p className="text-xs text-[#A89F8C]">{selectedItemForPayment.invoiceNumber}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isCollecting) setSelectedItemForPayment(null);
                    }}
                    className="p-1.5 rounded-lg text-[#A89F8C] hover:bg-[#1C1A16] hover:text-[#F5F0E8] transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                {paymentFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      paymentFeedback.type === "success"
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                        : "bg-red-950/40 border-red-800 text-red-400"
                    }`}
                  >
                    {paymentFeedback.text}
                  </div>
                )}

                <form onSubmit={handleCollectSubmit} className="space-y-4">
                  <div className="space-y-1.5 text-xs bg-[#131210] border border-[#2E2B24] p-3.5 rounded-xl">
                    <div className="flex justify-between">
                      <span className="text-[#A89F8C]">Customer:</span>
                      <span className="font-bold text-[#F5F0E8]">{selectedItemForPayment.customerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A89F8C]">Total Bill:</span>
                      <span className="font-bold text-[#F5F0E8]">{formatCurrency(selectedItemForPayment.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#A89F8C]">Already Received:</span>
                      <span className="font-bold text-emerald-400">{formatCurrency(selectedItemForPayment.paid)}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#2E2B24] pt-2 mt-2">
                      <span className="text-[#F5F0E8] font-bold">Remaining Balance Due:</span>
                      <span className="font-black text-[#E57373] text-sm">{formatCurrency(selectedItemForPayment.due)}</span>
                    </div>
                  </div>

                  <label className="block">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-[#A89F8C]">Payment Amount (INR)</span>
                      {collectAmount !== "" && (
                        <span className="text-[11px] text-stone-400">
                          Balance after:{" "}
                          <strong className="text-amber-400">
                            {formatCurrency(Math.max(0, selectedItemForPayment.due - Number(collectAmount)))}
                          </strong>
                        </span>
                      )}
                    </div>
                    <input
                      required
                      type="number"
                      min="1"
                      max={selectedItemForPayment.due}
                      value={collectAmount}
                      disabled={isCollecting}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCollectAmount(val === "" ? "" : Math.min(Number(val), selectedItemForPayment.due));
                      }}
                      className="h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]"
                    />
                  </label>

                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-[#A89F8C]">Payment Method</span>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {(["cash", "upi", "card"] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          disabled={isCollecting}
                          onClick={() => setCollectMethod(method)}
                          className={`h-10 rounded-xl border text-xs font-bold uppercase tracking-wider transition ${
                            collectMethod === method
                              ? "border-[#B8962E] bg-[#B8962E]/10 text-[#D4A935]"
                              : "border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:border-[#B8962E]/50 hover:text-[#F5F0E8]"
                          }`}
                        >
                          {method === "cash" ? "💵 Cash" : method === "upi" ? "📱 UPI" : "💳 Card"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedItemForPayment(null)}
                      disabled={isCollecting}
                      className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:bg-[#1C1A16] hover:text-[#F5F0E8] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCollecting}
                      className="h-10 rounded-xl bg-[#B8962E] px-6 text-xs font-bold text-[#0E0D0B] hover:bg-[#D4A935] transition shadow-md"
                    >
                      {isCollecting ? "Recording..." : "Confirm Collection"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </div>
  );
}
