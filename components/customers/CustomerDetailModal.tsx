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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-[#2E2B24] bg-[#1C1A16] shadow-2xl text-[#A89F8C] my-auto animate-in zoom-in-95 duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2E2B24] bg-[#1C1A16] px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#131210] text-[#B8962E] border border-[#2E2B24]">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#F5F0E8]">{customer.name}</h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-[#A89F8C]">
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
            className="grid size-10 place-items-center rounded-xl border border-[#2E2B24] hover:border-[#B8962E] bg-[#131210] text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Customer Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Total Visits</span>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#F5F0E8]">{visitCount}</p>
              <span className="text-xs text-[#6B6358] mt-1">Last visit: {lastVisitDate}</span>
            </div>

            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Total Spend</span>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#F5F0E8]">{formatCurrency(totalSpend)}</p>
              <span className="text-xs text-[#6B6358] mt-1">Average per visit: {formatCurrency(avgSpend)}</span>
            </div>

            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 shadow-sm flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">Membership Status</span>
              {customer.customerType === "membership" ? (
                <div>
                  <div className="flex items-center gap-1.5 mt-2">
                    {isMembershipActive() ? (
                      <>
                        <CheckCircle2 size={18} className="text-[#B8962E] shrink-0" />
                        <span className="text-sm font-bold text-[#B8962E]">Active Membership</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={18} className="text-[#E57373] shrink-0" />
                        <span className="text-sm font-bold text-[#E57373]">Expired Membership</span>
                      </>
                    )}
                  </div>
                  <p className="text-[10px] text-[#A89F8C] mt-1">
                    Valid till {customer.membershipEnd ? formatDate(customer.membershipEnd) : "N/A"}
                  </p>
                </div>
              ) : (
                <div>
                  <span className="inline-block mt-2 rounded-full px-2.5 py-0.5 text-xs font-bold bg-[#1F1A0F] border border-[#B8962E]/20 text-[#B8962E]">
                    Regular Customer
                  </span>
                  <p className="text-[10px] text-[#6B6358] mt-1">No active membership subscription</p>
                </div>
              )}
            </div>
          </div>

          {/* Membership Cost Details */}
          {customer.customerType === "membership" && (
            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-4 shadow-sm space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#B8962E] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[#B8962E]" />
                Membership Details
              </h3>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-[#A89F8C]">Amount Paid</p>
                  <p className="font-bold text-[#F5F0E8] mt-0.5">{customer.membershipAmount ? formatCurrency(customer.membershipAmount) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#A89F8C]">Duration</p>
                  <p className="font-bold text-[#F5F0E8] mt-0.5">{customer.membershipDuration ? `${customer.membershipDuration} Months` : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#A89F8C]">Start Date</p>
                  <p className="font-bold text-[#F5F0E8] mt-0.5">{customer.membershipStart ? formatDate(customer.membershipStart) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#A89F8C]">End Date</p>
                  <p className="font-bold text-[#F5F0E8] mt-0.5">{customer.membershipEnd ? formatDate(customer.membershipEnd) : "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Visit History Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#F5F0E8]">Visit & Invoice History</h3>

            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-3 border-[#B8962E] border-t-transparent" />
              </div>
            ) : error ? (
              <div className="text-center py-6 text-[#E57373] bg-[#131210] border border-[#2E2B24] rounded-xl">
                {error}
              </div>
            ) : visitCount === 0 ? (
              <div className="text-center py-12 bg-[#131210] rounded-2xl border border-[#2E2B24] text-[#6B6358] italic">
                No visits recorded yet. Invoices will appear here when this customer visits.
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedInvoices).map(([monthYear, monthInvoices]) => {
                  const monthlyTotal = monthInvoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
                  
                  return (
                    <div key={monthYear} className="space-y-3">
                      {/* Month Header */}
                      <div className="flex items-center justify-between bg-[#131210] rounded-xl px-4 py-2 border border-[#2E2B24] shadow-sm">
                        <span className="font-bold text-[#F5F0E8] text-sm tracking-tight">{monthYear}</span>
                        <div className="flex gap-3 text-xs font-semibold text-[#A89F8C]">
                          {(() => {
                            const mVisits = Array.from(new Set(monthInvoices.map(getInvoiceDateString).filter(Boolean))).length;
                            return (
                              <span>{mVisits} visit{mVisits !== 1 ? "s" : ""}</span>
                            );
                          })()}
                          <span>•</span>
                          <span className="text-[#B8962E] font-bold">Total Spent: {formatCurrency(monthlyTotal)}</span>
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
                              className="rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-sm overflow-hidden hover:border-[#B8962E]/50 transition"
                            >
                              {/* Invoice Header row */}
                              <div 
                                onClick={() => inv.id && toggleInvoiceExpand(inv.id)}
                                className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="grid size-9 place-items-center rounded-xl bg-[#0E0D0B] text-[#B8962E] border border-[#2E2B24]">
                                    <Receipt size={16} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-[#F5F0E8] text-sm">{inv.invoiceNumber}</p>
                                    <p className="text-[10px] text-[#A89F8C] font-semibold mt-0.5">
                                      {formatDate(inv.invoiceDate || inv.date)} at {formatTime(inv.invoiceDate || inv.date)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-4">
                                  <div className="text-right">
                                    <p className="text-xs text-[#6B6358] font-medium">Stylist</p>
                                    <p className="text-xs font-semibold text-[#F5F0E8] mt-0.5">
                                      {staffList || <span className="italic text-[#6B6358]">—</span>}
                                    </p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-xs text-[#6B6358] font-medium">Total Amount</p>
                                    <p className="text-sm font-bold text-[#B8962E] mt-0.5">
                                      {formatCurrency(inv.grandTotal)}
                                    </p>
                                  </div>

                                  <div className="text-[#A89F8C] pl-2">
                                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>

                              {/* Expanded Invoice details */}
                              {isExpanded && (
                                <div className="border-t border-[#2E2B24] bg-[#0E0D0B] p-4 space-y-4 text-xs animate-in slide-in-from-top-1 duration-150">
                                  {/* Services & Products breakdown */}
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Services */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-[#B8962E] uppercase tracking-wider text-[10px] border-b border-[#2E2B24] pb-1 flex items-center gap-1">
                                        <Sparkles size={11} />
                                        Services
                                      </h4>
                                      {hasServices ? (
                                        <div className="space-y-1">
                                          {inv.services.map((s: any, idx: number) => (
                                            <div key={idx} className="flex justify-between py-0.5">
                                              <div>
                                                <p className="font-semibold text-[#F5F0E8]">{s.serviceName || s.service}</p>
                                                <p className="text-[9px] text-[#A89F8C]">Stylist: {s.staffName || s.staff}</p>
                                              </div>
                                              <p className="font-bold text-[#F5F0E8]">
                                                {formatCurrency(s.price * (s.quantity || 1))}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[#6B6358] italic">No services purchased.</p>
                                      )}
                                    </div>

                                    {/* Products */}
                                    <div className="space-y-2">
                                      <h4 className="font-bold text-[#B8962E] uppercase tracking-wider text-[10px] border-b border-[#2E2B24] pb-1 flex items-center gap-1">
                                        <ShoppingBag size={11} />
                                        Products
                                      </h4>
                                      {hasProducts ? (
                                        <div className="space-y-1">
                                          {inv.products.map((p: any, idx: number) => (
                                            <div key={idx} className="flex justify-between py-0.5">
                                              <div>
                                                <p className="font-semibold text-[#F5F0E8]">{p.productName || p.product}</p>
                                                <p className="text-[9px] text-[#A89F8C]">Qty: {p.quantity || 1}</p>
                                              </div>
                                              <p className="font-bold text-[#F5F0E8]">
                                                {formatCurrency(p.price * (p.quantity || 1))}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[#6B6358] italic">No products purchased.</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Payments split & details */}
                                  <div className="border-t border-[#2E2B24] pt-3 flex flex-wrap justify-between items-center gap-4 text-xs">
                                    <div className="flex flex-wrap gap-4 text-[#A89F8C]">
                                      <div>
                                        <span className="font-medium">Payment: </span>
                                        <span className="font-bold capitalize text-[#F5F0E8]">
                                          {inv.paymentStatus === "paid" ? "Fully Paid" : inv.paymentStatus}
                                        </span>
                                      </div>
                                      
                                      {inv.paymentSplit && (
                                        <div className="flex gap-2">
                                          <span className="font-medium">Split:</span>
                                          {inv.paymentSplit.cash > 0 && <span className="font-bold text-[#F5F0E8]">Cash (₹{inv.paymentSplit.cash})</span>}
                                          {inv.paymentSplit.upi > 0 && <span className="font-bold text-[#F5F0E8]">UPI (₹{inv.paymentSplit.upi})</span>}
                                          {inv.paymentSplit.card > 0 && <span className="font-bold text-[#F5F0E8]">Card (₹{inv.paymentSplit.card})</span>}
                                        </div>
                                      )}
                                    </div>

                                    {/* Link to view invoice */}
                                    <a
                                      href={`/invoices/${inv.id}`}
                                      className="inline-flex items-center gap-1 font-bold text-[#B8962E] hover:text-[#D4A935] hover:underline cursor-pointer"
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
        <div className="flex justify-end border-t border-[#2E2B24] bg-[#131210] px-6 py-4 shrink-0">
          <button
            onClick={onClose}
            className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-5 text-sm font-semibold text-[#A89F8C] hover:text-[#B8962E] hover:border-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
