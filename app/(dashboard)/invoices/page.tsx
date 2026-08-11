"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { Search, Eye, Calendar, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { toLocalDateString } from "@/lib/utils/date";
import { db } from "@/lib/firebase";
import { useAppData } from "@/context/AppDataContext";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";

function InvoicesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { staff } = useAppData();

  const now = new Date();
  const firstDayStr = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStr = toLocalDateString(now);

  // 1. URL State (Applied State)
  const appliedDateFrom = searchParams.get("from") || firstDayStr;
  const appliedDateTo = searchParams.get("to") || todayStr;
  const appliedSearchQuery = searchParams.get("search") || "";
  const appliedStaffId = searchParams.get("staff") || "All";

  // 2. Component State
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 3. Draft State for UI
  const [draftDateFrom, setDraftDateFrom] = useState(appliedDateFrom);
  const [draftDateTo, setDraftDateTo] = useState(appliedDateTo);
  const [searchQuery, setSearchQuery] = useState(appliedSearchQuery);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(appliedStaffId);

  // Helper to update URL which triggers the useEffect
  const updateUrl = (from: string, to: string, search: string, staffId: string) => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (search) params.set("search", search);
    if (staffId && staffId !== "All") params.set("staff", staffId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleApplyDateRange = () => {
    if (!draftDateFrom || !draftDateTo) {
      alert("Please select both From and To dates.");
      return;
    }
    if (new Date(draftDateFrom) > new Date(draftDateTo)) {
      alert("From date cannot be after To date.");
      return;
    }
    updateUrl(draftDateFrom, draftDateTo, searchQuery, selectedStaffId);
  };

  // Sync draft states when URL changes (e.g. back navigation)
  useEffect(() => {
    setDraftDateFrom(appliedDateFrom);
    setDraftDateTo(appliedDateTo);
    setSearchQuery(appliedSearchQuery);
    setSelectedStaffId(appliedStaffId);
  }, [appliedDateFrom, appliedDateTo, appliedSearchQuery, appliedStaffId]);

  // Fetch logic strictly driven by Applied Dates
  const loadInvoices = async () => {
    setLoading(true);
    try {
      const start = new Date(appliedDateFrom);
      const end = new Date(appliedDateTo);

      if (!appliedDateFrom || !appliedDateTo || isNaN(start.getTime()) || isNaN(end.getTime())) {
        return;
      }

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      // We remove limit() to fetch ALL invoices in the date range as requested.
      const q = query(
        collection(db, "invoices"),
        where("date", ">=", Timestamp.fromDate(start)),
        where("date", "<=", Timestamp.fromDate(end)),
        orderBy("date", "desc")
      );

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Ensure perfect chronological sorting
      docs.sort((a: any, b: any) => {
        const getTimestampMillis = (x: any) => {
          const ts = x.invoiceDate || x.createdAt || x.date;
          if (ts && typeof ts.toMillis === "function") return ts.toMillis();
          if (ts instanceof Date) return ts.getTime();
          if (typeof ts === "string") return new Date(ts).getTime();
          if (ts && typeof ts.seconds === "number") return ts.seconds * 1000;
          return 0;
        };
        return getTimestampMillis(b) - getTimestampMillis(a);
      });

      setInvoices(docs);
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [appliedDateFrom, appliedDateTo]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this invoice? This will revert stats and product quantities.")) {
      return;
    }
    try {
      await invoicesService.delete(id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    } catch (error) {
      alert("Failed to delete invoice. Please try again.");
      console.error(error);
    }
  };

  // Client-side filtering applies over the fully fetched date range
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const queryStr = searchQuery.toLowerCase().trim();
      let matchesSearch = true;
      if (queryStr) {
        const name = (inv.customerName || "").toLowerCase();
        const mobile = (inv.customerPhone || inv.customerMobile || "");
        const invNo = (inv.invoiceNo || inv.invoiceNumber || "").toLowerCase();
        const normalizedInvNo = invNo.replace(/[^a-z0-9]/g, '');
        const normalizedQueryStr = queryStr.replace(/[^a-z0-9]/g, '');

        matchesSearch = name.includes(queryStr) || mobile.includes(queryStr) || invNo.includes(queryStr) || (normalizedQueryStr.length > 0 && normalizedInvNo.includes(normalizedQueryStr));
      }

      let matchesStaff = true;
      if (selectedStaffId !== "All") {
        const targetStaff = staff.find((s) => s.id === selectedStaffId);
        if (targetStaff) {
          matchesStaff = (inv.services || []).some((s: any) =>
            s.staffId === targetStaff.id ||
            (s.staffName && s.staffName.toLowerCase() === targetStaff.name.toLowerCase()) ||
            (s.staff && s.staff.toLowerCase() === targetStaff.name.toLowerCase())
          );
        }
      }

      return matchesSearch && matchesStaff;
    });
  }, [invoices, searchQuery, selectedStaffId, staff]);

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              updateUrl(appliedDateFrom, appliedDateTo, e.target.value, selectedStaffId);
            }}
            className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
          />
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-2 flex-wrap bg-[#131210] p-2 rounded-xl border border-[#2E2B24] shadow-sm">
          <Calendar size={16} className="text-[#6B6358] ml-1" />
          <input
            type="date"
            value={draftDateFrom}
            onChange={(e) => setDraftDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
          <span className="text-xs text-[#A89F8C] font-semibold px-1">to</span>
          <input
            type="date"
            value={draftDateTo}
            onChange={(e) => setDraftDateTo(e.target.value)}
            className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
          />
          <button
            onClick={handleApplyDateRange}
            disabled={!draftDateFrom || !draftDateTo || draftDateFrom > draftDateTo}
            className="ml-2 h-9 px-4 rounded-lg bg-[#B8962E] text-[#0E0D0B] text-sm font-bold shadow-sm hover:bg-[#D4A935] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            APPLY
          </button>
        </div>
      </div>

      {/* Staff Filter Chips */}
      <div className="mb-5 flex flex-wrap items-center gap-2 border border-[#2E2B24] bg-[#1C1A16] px-4 py-3 rounded-2xl shadow-sm animate-in fade-in duration-200">
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6358] mr-2">Filter by Staff:</span>
        <button
          type="button"
          onClick={() => {
            setSelectedStaffId("All");
            updateUrl(appliedDateFrom, appliedDateTo, searchQuery, "All");
          }}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
            selectedStaffId === "All"
              ? "bg-[#B8962E] text-[#0E0D0B] border-[#B8962E]"
              : "bg-[#131210] border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
          }`}
        >
          All
        </button>
        {staff.filter((s) => s.status === "Active").map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => {
              setSelectedStaffId(member.id!);
              updateUrl(appliedDateFrom, appliedDateTo, searchQuery, member.id!);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
              selectedStaffId === member.id
                ? "bg-[#B8962E] text-[#0E0D0B] border-[#B8962E]"
                : "bg-[#131210] border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
            }`}
          >
            {member.name}
          </button>
        ))}
      </div>

      {loading ? (
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
        <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm text-[#A89F8C]">
            <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
              <tr>
                <th className="px-6 py-4 font-bold">Staff</th>
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

                const dateObj = (() => {
                  const ts = inv.createdAt || inv.invoiceDate || inv.date;
                  if (!ts) return null;
                  if (typeof ts.toDate === "function") return ts.toDate();
                  if (typeof ts.seconds === "number") return new Date(ts.seconds * 1000);
                  if (ts instanceof Date) return ts;
                  return new Date(ts);
                })();
                const dateLabel = dateObj ? dateObj.toLocaleDateString("en-IN") : "—";
                const timeLabel = dateObj ? dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
                
                const currentUrlParams = new URLSearchParams(searchParams.toString());
                const returnUrl = `${pathname}?${currentUrlParams.toString()}`;
                const encodedReturnUrl = encodeURIComponent(returnUrl);

                const hasEdits = inv.editHistory && inv.editHistory.length > 0;
                const lastEdit = hasEdits ? inv.editHistory[inv.editHistory.length - 1] : null;

                return (
                  <tr key={inv.id} className={`transition ${hasEdits ? "bg-[#18150D]/50 hover:bg-[#201C11]" : "bg-transparent hover:bg-[#1C1A16]"} text-[#A89F8C]`}>
                    <td className="px-6 py-4 text-xs font-semibold text-[#F5F0E8] leading-tight">
                      {(() => {
                        const uniqueStaffNames = Array.from(
                          new Set(
                            (inv.services || [])
                              .map((s: any) => s.staffName || s.staff)
                              .filter(Boolean)
                          )
                        ) as string[];
                        if (uniqueStaffNames.length === 0) {
                          return <span className="italic text-[#6B6358] font-normal">Unassigned</span>;
                        }
                        return (
                          <div className="flex flex-col gap-0.5">
                            {uniqueStaffNames.map((name) => (
                              <span key={name} className="block">
                                {name}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 font-semibold text-[#F5F0E8]">
                      <div className="flex flex-col gap-1">
                        <span>{inv.customerName}</span>
                        {hasEdits && lastEdit && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#D4A935] font-semibold tracking-wide">
                            <span className="rounded bg-[#2A2310] px-1 py-0.5 uppercase">EDITED</span>
                            by {lastEdit.editedByStaffName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      {inv.customerPhone || inv.customerMobile}
                    </td>
                    <td className="px-6 py-4 font-medium text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#F5F0E8]">{dateLabel}</span>
                        {timeLabel && (
                          <span className="text-[10px] text-[#6B6358]">{timeLabel}</span>
                        )}
                      </div>
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
                          href={`/invoices/${inv.id}?returnTo=${encodedReturnUrl}`}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#A89F8C] hover:text-[#B8962E] hover:border-[#B8962E] transition"
                        >
                          <Eye size={14} />
                          View
                        </Link>
                        <Link
                          href={`/billing?edit=${inv.id}&returnTo=${encodedReturnUrl}`}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#2E2B24] bg-[#131210] px-3 text-xs font-semibold text-[#B8962E] hover:text-[#D4A935] hover:border-[#B8962E] transition"
                        >
                          <Edit2 size={14} />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(inv.id)}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-red-950/50 bg-red-950/20 px-3 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/40 hover:border-red-900/50 transition cursor-pointer"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex h-[40vh] items-center justify-center"><div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" /></div>}>
      <InvoicesContent />
    </Suspense>
  );
}
