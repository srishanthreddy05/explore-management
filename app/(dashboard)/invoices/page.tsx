"use client";

import { useEffect, useMemo, useState } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { Search, Eye, Calendar, Edit2 } from "lucide-react";
import Link from "next/link";
import { toLocalDateString } from "@/lib/utils/date";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Timestamp,
} from "firebase/firestore";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);

  // Date range filters
  const now = new Date();
  const firstDayStr = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStr = toLocalDateString(now);

  const [dateFrom, setDateFrom] = useState(firstDayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  const loadInvoices = async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      let q = query(
        collection(db, "invoices"),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc"),
        limit(10)
      );

      if (isLoadMore && lastDoc) {
        q = query(
          collection(db, "invoices"),
          where("date", ">=", Timestamp.fromDate(start)),
          where("date", "<=", Timestamp.fromDate(end)),
          orderBy("date", "desc"),
          startAfter(lastDoc),
          limit(10)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      let nextList = [];
      if (isLoadMore) {
        nextList = [...invoices, ...docs];
      } else {
        nextList = docs;
      }

      nextList.sort((a: any, b: any) => {
        const dateA = a.invoiceDate || a.date;
        const dateB = b.invoiceDate || b.date;
        const timeA = dateA && typeof dateA.toMillis === "function" ? dateA.toMillis() : 0;
        const timeB = dateB && typeof dateB.toMillis === "function" ? dateB.toMillis() : 0;
        if (timeB !== timeA) return timeB - timeA;

        const createdA = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
        const createdB = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
        return createdB - createdA;
      });

      setInvoices(nextList);

      if (snap.docs.length > 0) {
        setLastDoc(snap.docs[snap.docs.length - 1]);
      } else if (!isLoadMore) {
        setLastDoc(null);
      }
      setHasMore(snap.docs.length === 10);

    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadInvoices(false);
  }, [dateFrom, dateTo]);

  // Filter & Search Logic (scoping done at Firestore level, filter only search query here)
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const name = (inv.customerName || "").toLowerCase();
      const mobile = (inv.customerPhone || inv.customerMobile || "");
      const invNo = (inv.invoiceNo || inv.invoiceNumber || "").toLowerCase();

      return name.includes(query) || mobile.includes(query) || invNo.includes(query);
    });
  }, [invoices, searchQuery]);

  return (
    <div className="w-full text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Records
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Invoice History
          </h1>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex flex-1 min-w-[280px] max-w-md items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-12 shadow-sm focus-within:border-[#B8962E] transition">
          <Search size={18} className="text-[#6B6358] mr-2" />
          <input
            type="text"
            placeholder="Search by client name, phone, or invoice no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
          />
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 flex-wrap bg-[#131210] p-2 rounded-xl border border-[#2E2B24] shadow-sm">
          <Calendar size={16} className="text-[#6B6358] ml-1" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
          <span className="text-xs text-[#A89F8C] font-semibold px-1">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
        </div>
      </div>

      {loading && invoices.length === 0 ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
          <h2 className="text-xl font-bold text-[#F5F0E8]">No Invoices Found</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            There are no invoices matching your search parameters in the selected date range.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm text-[#A89F8C]">
              <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                <tr>
                  <th className="px-6 py-4 font-bold">Invoice Number</th>
                  <th className="px-6 py-4 font-bold">Customer Name</th>
                  <th className="px-6 py-4 font-bold">Mobile Number</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Cash</th>
                  <th className="px-6 py-4 font-bold">UPI</th>
                  <th className="px-6 py-4 font-bold">Card</th>
                  <th className="px-6 py-4 font-bold">Total</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2B24]">
                {filteredInvoices.map((inv) => {
                  const cash = inv.paymentSplit?.cash ?? inv.payments?.cash ?? (inv.paymentMethod === "Cash" ? (inv.grandTotal || 0) : 0);
                  const upi = inv.paymentSplit?.upi ?? inv.payments?.upi ?? (inv.paymentMethod === "UPI" ? (inv.grandTotal || 0) : 0);
                  const card = inv.paymentSplit?.card ?? inv.payments?.card ?? (inv.paymentMethod === "Card" ? (inv.grandTotal || 0) : 0);

                  const dateObj =
                    inv.date && typeof inv.date.toDate === "function"
                      ? inv.date.toDate()
                      : inv.date
                        ? new Date(inv.date)
                        : null;
                  const dateLabel = dateObj ? dateObj.toLocaleDateString("en-IN") : "—";

                  return (
                    <tr key={inv.id} className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]">
                      <td className={`px-6 py-4 font-bold ${
                        inv.customerType === "membership" ? "text-[#B8962E]" : "text-[#F5F0E8]"
                      }`}>
                        {inv.invoiceNo || inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#F5F0E8]">
                        {inv.customerName}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {inv.customerPhone || inv.customerMobile}
                      </td>
                      <td className="px-6 py-4">
                        {dateLabel}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#A89F8C]">
                        {formatCurrency(cash)}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#A89F8C]">
                        {formatCurrency(upi)}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#A89F8C]">
                        {formatCurrency(card)}
                      </td>
                      <td className="px-6 py-4 font-bold text-[#B8962E]">
                        {formatCurrency(inv.grandTotal || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#A89F8C] hover:text-[#B8962E] hover:border-[#B8962E] transition"
                          >
                            <Eye size={14} />
                            View
                          </Link>
                          <Link
                            href={`/billing?edit=${inv.id}`}
                            className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#B8962E] hover:text-[#D4A935] hover:border-[#B8962E] transition"
                          >
                            <Edit2 size={14} />
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                disabled={loadingMore}
                onClick={() => loadInvoices(true)}
                className="w-full sm:w-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] px-6 text-sm font-semibold text-[#A89F8C] transition disabled:opacity-50 cursor-pointer"
              >
                {loadingMore && (
                  <div className="size-4 animate-spin rounded-full border-2 border-[#B8962E] border-t-transparent" />
                )}
                {loadingMore ? "Loading..." : "Load More Invoices"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
