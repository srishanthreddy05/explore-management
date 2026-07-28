"use client";

import { useEffect, useState } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { Search, WalletCards, DollarSign, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, limit, startAfter } from "firebase/firestore";
import type { Invoice } from "@/types/invoice";

export default function PaymentsPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Collect Payment Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [collectAmount, setCollectAmount] = useState<number | "">("");
  const [collectMethod, setCollectMethod] = useState<"cash" | "upi" | "card">("upi");
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadDueInvoices = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "invoices"),
        where("balanceDue", ">", 0),
        orderBy("balanceDue", "desc"),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const dues: any[] = [];
      querySnapshot.forEach((doc) => {
        dues.push({ id: doc.id, ...doc.data() });
      });
      setInvoices(dues);

      const last = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(last || null);
      setHasMore(querySnapshot.docs.length === 10);
    } catch (error) {
      console.error("Failed to load dues:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreDues = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, "invoices"),
        where("balanceDue", ">", 0),
        orderBy("balanceDue", "desc"),
        startAfter(lastDoc),
        limit(10)
      );
      const querySnapshot = await getDocs(q);
      const dues: any[] = [];
      querySnapshot.forEach((doc) => {
        dues.push({ id: doc.id, ...doc.data() });
      });
      setInvoices((prev) => [...prev, ...dues]);

      const last = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastDoc(last || null);
      setHasMore(querySnapshot.docs.length === 10);
    } catch (error) {
      console.error("Failed to load more dues:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadDueInvoices();
  }, []);

  const handleOpenCollect = (inv: any) => {
    setSelectedInvoice(inv);
    setCollectAmount(inv.balanceDue); // Default to full remaining balance
    setCollectMethod("upi");
    setModalOpen(true);
    setMessage(null);
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || collectAmount === "" || collectAmount <= 0) return;

    const amount = Number(collectAmount);
    if (amount > selectedInvoice.balanceDue) {
      setMessage({
        type: "error",
        text: `Cannot collect more than the remaining balance of ${formatCurrency(selectedInvoice.balanceDue)}.`,
      });
      return;
    }

    setCollecting(true);
    try {
      const paymentSplit = {
        cash: collectMethod === "cash" ? amount : 0,
        upi: collectMethod === "upi" ? amount : 0,
        card: collectMethod === "card" ? amount : 0,
      };

      await invoicesService.collectCreditPayment(
        selectedInvoice.id,
        amount,
        paymentSplit
      );

      setMessage({
        type: "success",
        text: `Successfully collected ${formatCurrency(amount)} for ${selectedInvoice.invoiceNo || selectedInvoice.invoiceNumber}!`,
      });

      // Reload list
      setTimeout(() => {
        setModalOpen(false);
        loadDueInvoices();
      }, 1500);
    } catch (error) {
      console.error("Failed to collect payment:", error);
      setMessage({ type: "error", text: "Failed to log payment transaction." });
    } finally {
      setCollecting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const name = (inv.customerName || "").toLowerCase();
    const mobile = (inv.customerPhone || inv.customerMobile || "");
    const invNo = (inv.invoiceNo || inv.invoiceNumber || "").toLowerCase();

    return name.includes(query) || mobile.includes(query) || invNo.includes(query);
  });

  return (
    <div className="w-full text-[#F5F0E8]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Cashier
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Pending Dues Collection
          </h1>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-5 flex max-w-md items-center rounded-2xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E]">
        <Search size={18} className="text-[#6B6358] mr-2" />
        <input
          type="text"
          placeholder="Search by name, phone, or invoice..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
        />
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#131210] text-[#B8962E] mb-4">
            <WalletCards size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#F5F0E8]">All Clear! No Pending Dues</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            There are no invoices with active balance dues matching your query.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#1C1A16] shadow-md">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm text-[#A89F8C]">
              <thead className="bg-[#131210] text-xs uppercase tracking-[0.2em] text-[#A89F8C] border-b border-[#2E2B24]">
                <tr>
                  <th className="px-6 py-4 font-bold">Customer</th>
                  <th className="px-6 py-4 font-bold">Phone</th>
                  <th className="px-6 py-4 font-bold">Invoice No</th>
                  <th className="px-6 py-4 font-bold">Bill Amount</th>
                  <th className="px-6 py-4 font-bold">Received</th>
                  <th className="px-6 py-4 font-bold">Balance</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2B24]">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#1F1A0F] transition bg-[#1C1A16] text-[#F5F0E8]">
                    <td className="px-6 py-4 font-semibold text-[#F5F0E8]">{inv.customerName}</td>
                    <td className="px-6 py-4 font-medium text-[#A89F8C]">{inv.customerPhone || inv.customerMobile}</td>
                    <td className={`px-6 py-4 font-bold ${
                      inv.customerType === "membership" ? "text-[#B8962E]" : "text-[#F5F0E8]"
                    }`}>
                      {inv.invoiceNo || inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#F5F0E8]">{formatCurrency(inv.grandTotal || 0)}</td>
                    <td className="px-6 py-4 font-semibold text-[#34D399]">
                      {formatCurrency(inv.receivedAmount ?? inv.grandTotal)}
                    </td>
                    <td className="px-6 py-4 font-bold text-[#E57373]">
                      {formatCurrency(inv.balanceDue ?? 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenCollect(inv)}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#B8962E] px-4 text-xs font-bold text-[#0E0D0B] hover:bg-[#D4A935] transition shadow-md"
                      >
                        <DollarSign size={14} />
                        Collect Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <button
                type="button"
                onClick={loadMoreDues}
                disabled={loadingMore}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:bg-[#1C1A16] hover:text-[#F5F0E8] hover:border-[#B8962E] transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? "Loading More..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collect Payment Modal Dialog */}
      {modalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8]">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#F5F0E8]"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">Collect Balance Payment</h2>
            
            {message && (
              <div
                className={`mb-4 rounded-xl border p-3 text-xs font-semibold ${
                  message.type === "success"
                    ? "border-[#105E3C] bg-[#0C2E1D] text-[#34D399]"
                    : "border-[#5C2424] bg-[#2E1616] text-[#E57373]"
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleCollectSubmit} className="space-y-4">
              <div className="space-y-1.5 text-sm bg-[#131210] border border-[#2E2B24] p-3.5 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-[#A89F8C] font-medium">Customer:</span>
                  <span className="font-bold text-[#F5F0E8]">{selectedInvoice.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A89F8C] font-medium">Invoice:</span>
                  <span className="font-bold text-[#F5F0E8]">{selectedInvoice.invoiceNo || selectedInvoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between border-t border-[#2E2B24] pt-2 mt-2">
                  <span className="text-[#A89F8C] font-semibold">Total Invoice Amount:</span>
                  <span className="font-bold text-[#F5F0E8]">{formatCurrency(selectedInvoice.grandTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#A89F8C] font-semibold">Already Received:</span>
                  <span className="font-bold text-[#34D399]">
                    {formatCurrency(selectedInvoice.receivedAmount ?? selectedInvoice.grandTotal)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#2E2B24] pt-2 mt-2">
                  <span className="text-[#F5F0E8] font-bold">Remaining Balance Due:</span>
                  <span className="font-extrabold text-[#E57373]">{formatCurrency(selectedInvoice.balanceDue)}</span>
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Payment Amount Collected (INR)</span>
                <input
                  required
                  type="number"
                  min="1"
                  max={selectedInvoice.balanceDue}
                  value={collectAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCollectAmount(val === "" ? "" : Math.min(Number(val), selectedInvoice.balanceDue));
                  }}
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E]"
                />
              </label>

              <div className="space-y-1.5">
                <span className="text-sm font-semibold text-[#A89F8C]">Payment Method</span>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(["cash", "upi", "card"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
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
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:bg-[#1C1A16] hover:text-[#F5F0E8] transition"
                  disabled={collecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] transition shadow-md"
                  disabled={collecting}
                >
                  {collecting ? "Logging..." : "Confirm Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
