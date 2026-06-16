"use client";

import { useEffect, useState } from "react";
import { X, Calendar, User, Phone, CheckCircle2, AlertTriangle, Eye, ArrowUpRight, Plus, ChevronDown, ChevronUp, ShoppingBag, Receipt, Sparkles } from "lucide-react";
import type { Customer } from "@/types/customer";
import type { Invoice } from "@/types/invoice";
import * as invoiceService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
}

export default function CustomerDetailModal({ customer, onClose }: CustomerDetailModalProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    async function fetchInvoices() {
      if (!customer.id) return;
      try {
        setLoading(true);
        const data = await invoiceService.getByCustomerId(customer.id);
        setInvoices(data);
      } catch (err) {
        console.error("Error fetching customer invoices:", err);
        setError("Failed to load visit history.");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [customer.id]);

  // Calculations
  const getInvoiceDateString = (inv: Invoice) => {
    const timestamp: any = inv.invoiceDate || inv.date;
    if (!timestamp) return "";
    const dateObj = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const uniqueVisitDates = Array.from(new Set(invoices.map(getInvoiceDateString).filter(Boolean)));
  const visitCount = uniqueVisitDates.length;
  const totalSpend = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const avgSpend = visitCount > 0 ? totalSpend / visitCount : 0;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const dateObj = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    const dateObj = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const lastVisitDate = visitCount > 0 ? formatDate(invoices[0].invoiceDate || invoices[0].date) : "No visits recorded yet";

  // Group invoices by Month Year
  const getMonthYearKey = (timestamp: any) => {
    if (!timestamp) return "Unknown Date";
    const dateObj = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
  };

  const groupedInvoices = invoices.reduce((acc, inv) => {
    const key = getMonthYearKey(inv.invoiceDate || inv.date);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(inv);
    return acc;
  }, {} as Record<string, Invoice[]>);

  // Check membership status
  const isMembershipActive = () => {
    if (customer.customerType !== "membership" || !customer.membershipEnd) return false;
    const end = new Date(customer.membershipEnd);
    return end >= new Date();
  };

  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoiceId(expandedInvoiceId === id ? null : id);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-stone-200 bg-[#F9FAFB] shadow-2xl text-black my-auto animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-stone-100 text-black">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-black">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-black/70">
                <span className="flex items-center gap-1">
                  <Phone size={12} />
                  {customer.phone}
                </span>
                <span>•</span>
                <span className="capitalize">{customer.customerType} Profile</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-10 place-items-center rounded-xl border border-stone-200 hover:border-stone-400 bg-white text-stone-450 hover:text-black transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Customer Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-black/60 uppercase tracking-wider">Total Visits</span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-black">{visitCount}</p>
              <span className="text-xs text-black/60 mt-1">Last visit: {lastVisitDate}</span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-black/60 uppercase tracking-wider">Total Spend</span>
              <p className="mt-2 text-2xl font-bold tracking-tight text-black">{formatCurrency(totalSpend)}</p>
              <span className="text-xs text-black/60 mt-1">Average per visit: {formatCurrency(avgSpend)}</span>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-black/60 uppercase tracking-wider">Membership Status</span>
              {customer.customerType === "membership" ? (
                <div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {isMembershipActive() ? (
                      <>
                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-emerald-800">Active Membership</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={18} className="text-amber-600 shrink-0" />
                        <span className="text-sm font-bold text-amber-800">Expired Membership</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-black/70 mt-1">
                    Valid till {customer.membershipEnd ? formatDate(customer.membershipEnd) : "N/A"}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700">
                    Regular Customer
                  </span>
                  <p className="text-[10px] text-black/60 mt-1">No active membership subscription</p>
                </div>
              )}
            </div>
          </div>

          {/* Membership Cost Details */}
          {customer.customerType === "membership" && (
            <div className="rounded-2xl border border-stone-200 bg-amber-50/50 p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-black" />
                Membership Details
              </h3>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-black/65">Amount Paid</p>
                  <p className="font-bold text-black mt-0.5">{customer.membershipAmount ? formatCurrency(customer.membershipAmount) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-black/65">Duration</p>
                  <p className="font-bold text-black mt-0.5">{customer.membershipDuration ? `${customer.membershipDuration} Months` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-black/65">Start Date</p>
                  <p className="font-bold text-black mt-0.5">{customer.membershipStart ? formatDate(customer.membershipStart) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-black/65">End Date</p>
                  <p className="font-bold text-black mt-0.5">{customer.membershipEnd ? formatDate(customer.membershipEnd) : "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Visit History Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-black">Visit & Invoice History</h3>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-3 border-black border-t-transparent" />
              </div>
            ) : error ? (
              <div className="text-center py-6 text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            ) : visitCount === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 text-black/60 italic">
                No visits recorded yet. Invoices will appear here when this customer visits.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedInvoices).map(([monthYear, monthInvoices]) => {
                  const monthlyTotal = monthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
                  
                  return (
                    <div key={monthYear} className="space-y-3">
                      {/* Month Header */}
                      <div className="flex items-center justify-between bg-stone-100/80 rounded-xl px-4 py-2 border border-stone-200/60 shadow-sm">
                        <span className="font-bold text-black text-sm tracking-tight">{monthYear}</span>
                        <div className="flex gap-3 text-xs font-semibold text-black/70">
                          {(() => {
                            const mVisits = Array.from(new Set(monthInvoices.map(getInvoiceDateString).filter(Boolean))).length;
                            return (
                              <span>{mVisits} visit{mVisits !== 1 ? "s" : ""}</span>
                            );
                          })()}
                          <span>•</span>
                          <span className="text-black font-bold">Total Spent: {formatCurrency(monthlyTotal)}</span>
                        </div>
                      </div>

                      {/* Invoices List */}
                      <div className="space-y-2.5">
                        {monthInvoices.map((inv) => {
                          const isExpanded = expandedInvoiceId === inv.id;
                          const hasServices = inv.services && inv.services.length > 0;
                          const hasProducts = inv.products && inv.products.length > 0;
                          const staffSet = new Set(
                            (inv.services || [])
                              .map((s: any) => s.staffName || s.staff)
                              .filter(Boolean)
                          );
                          const staffList = Array.from(staffSet).join(", ");
                          
                          return (
                            <div 
                              key={inv.id} 
                              className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden hover:border-stone-300 transition"
                            >
                              {/* Invoice Header row */}
                              <div 
                                onClick={() => inv.id && toggleInvoiceExpand(inv.id)}
                                className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="grid size-9 place-items-center rounded-xl bg-stone-50 text-stone-600 border border-stone-200">
                                    <Receipt size={16} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-stone-900 text-sm">{inv.invoiceNumber}</p>
                                    <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                                      {formatDate(inv.invoiceDate || inv.date)} at {formatTime(inv.invoiceDate || inv.date)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-stone-500 font-medium">Stylist</p>
                                    <p className="text-xs font-semibold text-stone-900 mt-0.5">
                                      {staffList || <span className="italic text-stone-300">—</span>}
                                    </p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-xs text-stone-500 font-medium">Total Amount</p>
                                    <p className="text-sm font-bold text-stone-950 mt-0.5">
                                      {formatCurrency(inv.grandTotal)}
                                    </p>
                                  </div>

                                  <div className="text-stone-400 pl-2">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Invoice details */}
                              {isExpanded && (
                                <div className="border-t border-stone-100 bg-stone-50 p-4 space-y-4 text-xs animate-in slide-in-from-top-1 duration-150">
                                  {/* Services & Products breakdown */}
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Services */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[10px] border-b border-stone-200 pb-1 flex items-center gap-1">
                                        <Sparkles size={11} />
                                        Services
                                      </h4>
                                      {hasServices ? (
                                        <div className="space-y-1">
                                          {inv.services.map((s: any, idx: number) => (
                                            <div key={idx} className="flex justify-between py-0.5">
                                              <div>
                                                <p className="font-semibold text-stone-800">{s.serviceName || s.service}</p>
                                                <p className="text-[9px] text-stone-400">Stylist: {s.staffName || s.staff}</p>
                                              </div>
                                              <p className="font-bold text-stone-900">
                                                {formatCurrency(s.price * (s.quantity || 1))}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-stone-400 italic">No services purchased.</p>
                                      )}
                                    </div>

                                    {/* Products */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-stone-700 uppercase tracking-wider text-[10px] border-b border-stone-200 pb-1 flex items-center gap-1">
                                        <ShoppingBag size={11} />
                                        Products
                                      </h4>
                                      {hasProducts ? (
                                        <div className="space-y-1">
                                          {inv.products.map((p: any, idx: number) => (
                                            <div key={idx} className="flex justify-between py-0.5">
                                              <div>
                                                <p className="font-semibold text-stone-800">{p.productName || p.product}</p>
                                                <p className="text-[9px] text-stone-400">Qty: {p.quantity || 1}</p>
                                              </div>
                                              <p className="font-bold text-stone-900">
                                                {formatCurrency(p.price * (p.quantity || 1))}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-stone-400 italic">No products purchased.</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Payments split & details */}
                                  <div className="border-t border-stone-200 pt-3 flex flex-wrap justify-between items-center gap-4 text-xs">
                                    <div className="flex flex-wrap gap-4 text-stone-500">
                                      <div>
                                        <span className="font-medium">Payment: </span>
                                        <span className="font-bold capitalize text-stone-700">
                                          {inv.paymentStatus === "paid" ? "Fully Paid" : inv.paymentStatus}
                                        </span>
                                      </div>
                                      
                                      {inv.paymentSplit && (
                                        <div className="flex gap-2">
                                          <span className="font-medium">Split:</span>
                                          {inv.paymentSplit.cash > 0 && <span className="font-bold text-stone-700">Cash (₹{inv.paymentSplit.cash})</span>}
                                          {inv.paymentSplit.upi > 0 && <span className="font-bold text-stone-700">UPI (₹{inv.paymentSplit.upi})</span>}
                                          {inv.paymentSplit.card > 0 && <span className="font-bold text-stone-700">Card (₹{inv.paymentSplit.card})</span>}
                                        </div>
                                      )}
                                    </div>

                                    {/* Link to view invoice */}
                                    <a
                                      href={`/invoices/${inv.id}`}
                                      className="inline-flex items-center gap-1 font-bold text-black hover:underline cursor-pointer"
                                      title="Open Invoice View Page"
                                    >
                                      Open Invoice Page
                                      <ArrowUpRight size={12} />
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-stone-200 bg-stone-50 px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-stone-200 bg-white px-5 text-sm font-semibold text-stone-700 hover:bg-stone-50 hover:border-stone-400 transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
