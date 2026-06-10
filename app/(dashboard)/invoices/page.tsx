"use client";

import { useEffect, useMemo, useState } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { Search, Eye, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const currentMonthIdx = new Date().getMonth();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await invoicesService.getAll();
      setInvoices(data);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Filter & Search Logic
  const filteredInvoices = useMemo(() => {
    const currentYear = new Date().getFullYear();

    return invoices.filter((inv) => {
      // 1. Month Filter
      if (inv.date) {
        const invDate = new Date(inv.date);
        const invMonth = invDate.getMonth();
        const invYear = invDate.getFullYear();
        if (invMonth !== selectedMonth || invYear !== currentYear) {
          return false;
        }
      } else {
        return false;
      }

      // 2. Search query filter
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;

      const name = (inv.customerName || "").toLowerCase();
      const mobile = (inv.customerMobile || inv.customerPhone || "");
      const invNo = (inv.invoiceNo || inv.invoiceNumber || "").toLowerCase();

      return name.includes(query) || mobile.includes(query) || invNo.includes(query);
    });
  }, [invoices, selectedMonth, searchQuery]);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, searchQuery]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredInvoices, currentPage]);

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Records
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Invoice History
          </h1>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="mb-5 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="flex flex-1 min-w-[280px] max-w-md items-center rounded-2xl border border-stone-200 bg-white px-4 h-12 shadow-sm focus-within:border-black">
          <Search size={18} className="text-stone-400 mr-2" />
          <input
            type="text"
            placeholder="Search by client name, phone, or invoice no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
          />
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-3 h-12 shadow-sm">
          <Calendar size={18} className="text-stone-550" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-sm font-semibold text-stone-850 outline-none cursor-pointer pr-4"
          >
            {MONTHS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <h2 className="text-xl font-bold text-stone-900">No Invoices Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            There are no invoices matching your search parameters for {MONTHS[selectedMonth]}.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
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
              <tbody className="divide-y divide-stone-200">
                {paginatedInvoices.map((inv) => {
                  const cash = inv.payments?.cash ?? (inv.paymentMethod === "Cash" ? (inv.grandTotal || 0) : 0);
                  const upi = inv.payments?.upi ?? (inv.paymentMethod === "UPI" ? (inv.grandTotal || 0) : 0);
                  const card = inv.payments?.card ?? (inv.paymentMethod === "Card" ? (inv.grandTotal || 0) : 0);
                  return (
                    <tr key={inv.id} className="hover:bg-stone-50 transition bg-white text-stone-900">
                      <td className="px-6 py-4 font-bold text-stone-900">
                        {inv.invoiceNo || inv.invoiceNumber}
                      </td>
                      <td className="px-6 py-4 font-semibold text-stone-900">
                        {inv.customerName}
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {inv.customerPhone || inv.customerMobile}
                      </td>
                      <td className="px-6 py-4">
                        {inv.date}
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-700">
                        {formatCurrency(cash)}
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-700">
                        {formatCurrency(upi)}
                      </td>
                      <td className="px-6 py-4 font-medium text-stone-700">
                        {formatCurrency(card)}
                      </td>
                      <td className="px-6 py-4 font-bold text-stone-900">
                        {formatCurrency(inv.grandTotal || 0)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-stone-200 px-3 text-xs font-semibold text-stone-700 hover:text-black hover:border-black transition"
                        >
                          <Eye size={14} />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-stone-500 font-medium">
                Page {currentPage} of {totalPages} ({filteredInvoices.length} Invoices)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:text-black disabled:opacity-50"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 transition hover:text-black disabled:opacity-50"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
