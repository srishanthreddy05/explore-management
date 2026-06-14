"use client";

import { useEffect, useState, use } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { ChevronLeft, Receipt, Send, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInvoice() {
      setLoading(true);
      try {
        const data = await invoicesService.getById(resolvedParams.id);
        if (data) {
          setInvoice(data);
        } else {
          alert("Invoice not found!");
          router.push("/invoices");
        }
      } catch (error) {
        console.error("Failed to load invoice details:", error);
      } finally {
        setLoading(false);
      }
    }
    loadInvoice();
  }, [resolvedParams.id, router]);

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  if (!invoice) return null;

  const paymentStatus = invoice.paymentStatus || "paid";

  // ── Schema field reads ───────────────────────────────────────────────────
  const invoiceNumber = invoice.invoiceNumber || invoice.invoiceNo;
  const customerPhone = invoice.customerPhone || invoice.customerMobile;
  const totalDiscount = invoice.totalDiscount ?? invoice.discount ?? 0;
  const paymentSplit = invoice.paymentSplit || invoice.payments || {};
  const appliedOffer = invoice.appliedOffer;

  // Invoice date may be a Firestore Timestamp or a "YYYY-MM-DD" string
  const invoiceDateObj =
    invoice.date && typeof invoice.date?.toDate === "function"
      ? invoice.date.toDate()
      : invoice.date
        ? new Date(invoice.date)
        : null;
  const invoiceDateLabel = invoiceDateObj
    ? invoiceDateObj.toLocaleDateString()
    : invoice.date || "—";

  const createdAtObj =
    invoice.createdAt && typeof invoice.createdAt?.toDate === "function"
      ? invoice.createdAt.toDate()
      : invoice.createdAt
        ? new Date(invoice.createdAt)
        : invoiceDateObj;

  const invoiceTimeLabel = createdAtObj
    ? createdAtObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
    : "—";

  const cashPaid = paymentSplit.cash ?? (invoice.paymentMethod === "Cash" ? invoice.grandTotal : 0);
  const upiPaid = paymentSplit.upi ?? (invoice.paymentMethod === "UPI" ? invoice.grandTotal : 0);
  const cardPaid = paymentSplit.card ?? (invoice.paymentMethod === "Card" ? invoice.grandTotal : 0);
  const totalPaid = (cashPaid || 0) + (upiPaid || 0) + (cardPaid || 0) || invoice.grandTotal;

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (!customerPhone) {
      alert("This invoice has no customer mobile number on file.");
      return;
    }

    const formattedServices = (invoice.services || [])
      .map((s: any) => {
        const name = s.serviceName || s.service;
        const amount = s.amount ?? Math.max((s.price || 0) - (s.discount || 0), 0);
        return `• ${name} - ₹${amount}`;
      })
      .join("\n");

    const formattedProducts = (invoice.products || [])
      .map((p: any) => {
        const name = p.productName || p.product;
        const amount = p.amount ?? Math.max((p.price || 0) * (p.quantity || 1) - (p.discount || 0), 0);
        return `• ${name} (x${p.quantity}) - ₹${amount}`;
      })
      .join("\n");

    const greeting = `Hello ${invoice.customerName},\n\nThank you for choosing Explore Salon ✨\n\n`;

    let itemsText = "";
    if (formattedServices) {
      itemsText += `Services:\n${formattedServices}\n\n`;
    }
    if (formattedProducts) {
      itemsText += `Products:\n${formattedProducts}\n\n`;
    }

    const grandTotal = invoice.grandTotal;
    const discountAmount = totalDiscount;
    const offerDiscount = appliedOffer?.discountAmount ?? 0;
    const lineDiscount = Math.max(discountAmount - offerDiscount, 0);
    const subtotal = invoice.subtotal ?? (grandTotal + discountAmount);

    const hasDiscountOrOffer = discountAmount > 0;

    let pricingText = "";
    if (hasDiscountOrOffer) {
      pricingText += `Subtotal: ₹${subtotal}\n`;
      if (lineDiscount > 0) {
        pricingText += `Discount: -₹${lineDiscount}\n`;
      }
      if (appliedOffer && offerDiscount > 0) {
        pricingText += `Offer Applied: ${appliedOffer.code} (-₹${offerDiscount})\n`;
      }
    }
    pricingText += `Total Amount: ₹${grandTotal}\n\n`;

    const closing =
      `Invoice No: ${invoiceNumber}\n` +
      `We look forward to serving you again.\n\n` +
      `Explore Salon`;

    const msg = `${greeting}${itemsText}${pricingText}${closing}`;

    const digits = String(customerPhone).trim().replace(/\D/g, "");
    const e164 = digits.startsWith("91") && digits.length === 12 ? digits : `91${digits}`;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="w-full text-stone-900 max-w-7xl px-4 sm:px-6 lg:px-8 mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-black hover:border-black transition"
          >
            <ChevronLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Invoice Detail View
          </h1>
        </div>

        {/* WhatsApp share button */}
        <button
          onClick={handleWhatsApp}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700 cursor-pointer"
        >
          <Send size={16} />
          Share on WhatsApp
        </button>
      </div>

      {/* Main Content Layout Grid */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        {/* Left Column: Form Details & Tables (Billing Terminal format) */}
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-md sm:p-5 text-stone-900 space-y-6">
          {/* Top Form Grid (Invoice metadata) */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Invoice Number</span>
              <input
                readOnly
                type="text"
                value={invoiceNumber}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Date</span>
              <input
                readOnly
                type="text"
                value={invoiceDateLabel}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Time</span>
              <input
                readOnly
                type="text"
                value={invoiceTimeLabel}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Customer Mobile</span>
              <input
                readOnly
                type="text"
                value={customerPhone || "—"}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Customer Name</span>
              <input
                readOnly
                type="text"
                value={invoice.customerName}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>
          </div>

          {/* Services Rendered Table */}
          {invoice.services && invoice.services.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3">Services</h2>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Service</th>
                      <th className="px-4 py-4 font-semibold">Staff</th>
                      <th className="px-4 py-4 font-semibold">Price</th>
                      <th className="px-4 py-4 font-semibold">Discount</th>
                      <th className="px-4 py-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {invoice.services.map((item: any, idx: number) => {
                      const name = item.serviceName || item.service;
                      const staffName = item.staffName || item.staff;
                      const amount = item.amount ?? Math.max((item.price || 0) - (item.discount || 0), 0);
                      return (
                        <tr key={idx} className="bg-white transition hover:bg-stone-50">
                          <td className="px-4 py-3 font-semibold text-stone-900">{name}</td>
                          <td className="px-4 py-3 text-stone-900">{staffName}</td>
                          <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-emerald-600">- {formatCurrency(item.discount || 0)}</td>
                          <td className="px-4 py-3 font-semibold text-stone-900 text-right">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Products Purchased Table */}
          {invoice.products && invoice.products.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-stone-900 mb-3">Products</h2>
              <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-4 font-semibold">Product</th>
                      <th className="px-4 py-4 font-semibold">Price</th>
                      <th className="px-4 py-4 font-semibold">Quantity</th>
                      <th className="px-4 py-4 font-semibold">Discount</th>
                      <th className="px-4 py-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {invoice.products.map((item: any, idx: number) => {
                      const name = item.productName || item.product;
                      const amount = item.amount ?? Math.max((item.price || 0) * (item.quantity || 1) - (item.discount || 0), 0);
                      return (
                        <tr key={idx} className="bg-white transition hover:bg-stone-50">
                          <td className="px-4 py-3 font-semibold text-stone-900">{name}</td>
                          <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                          <td className="px-4 py-3 text-stone-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-emerald-600">- {formatCurrency(item.discount || 0)}</td>
                          <td className="px-4 py-3 font-semibold text-stone-900 text-right">
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </section>

        {/* Right Column: Totals Summary, Offer if applied, Payment split info */}
        <aside className="space-y-5">
          {/* Totals Summary */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt size={18} />
              <h2 className="text-sm font-bold">Totals Summary</h2>
            </div>

            <div className="space-y-2 border-t border-stone-100 pt-3 text-sm">
              {invoice.totalServices !== undefined && (
                <div className="flex items-center justify-between text-stone-500">
                  <span>Total Services</span>
                  <span className="font-semibold text-stone-800">{formatCurrency(invoice.totalServices)}</span>
                </div>
              )}
              {invoice.totalProducts !== undefined && (
                <div className="flex items-center justify-between text-stone-500">
                  <span>Total Products</span>
                  <span className="font-semibold text-stone-800">{formatCurrency(invoice.totalProducts)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-stone-500">
                <span>Subtotal</span>
                <span className="font-semibold text-stone-800">{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-500">
                <span>Overall Discount</span>
                <span className="font-semibold text-emerald-600">- {formatCurrency(totalDiscount)}</span>
              </div>
              <div className="flex items-center justify-between text-stone-800 font-bold border-t border-stone-100 pt-2 text-base">
                <span>Grand Total</span>
                <span>{formatCurrency(invoice.grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* Offer if applied */}
          {appliedOffer && (
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
              <h2 className="text-lg font-bold text-stone-900 mb-3">Applied Offer</h2>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 flex items-start gap-2.5">
                <Tag size={16} className="text-emerald-700 mt-0.5 shrink-0" />
                <div className="text-xs text-emerald-800 leading-normal">
                  <span className="font-bold uppercase tracking-wider">{appliedOffer.code}</span>
                  {" "}— {appliedOffer.name}
                  <p className="mt-1.5 font-bold text-emerald-700">Discount: -{formatCurrency(appliedOffer.discountAmount)}</p>
                </div>
              </div>
            </section>
          )}

          {/* Payment Method & Split */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">Payment Information</h2>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold border ${paymentStatus === "paid"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : paymentStatus === "unpaid"
                      ? "bg-red-50 text-red-800 border-red-300"
                      : "bg-amber-50 text-amber-800 border-amber-300"
                  }`}
              >
                {paymentStatus === "paid"
                  ? "Paid"
                  : paymentStatus === "unpaid"
                    ? "Unpaid"
                    : "Partially Paid"}
              </span>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3 text-sm">
                <span className="font-semibold text-stone-700">Grand Total</span>
                <span className="font-bold text-stone-900">{formatCurrency(invoice.grandTotal)}</span>
              </div>

              {/* Horizontal Payment Inputs */}
              <div className="grid grid-cols-3 gap-2.5">
                {(["cash", "upi", "card"] as const).map((method) => {
                  const val = method === "cash" ? cashPaid : method === "upi" ? upiPaid : cardPaid;
                  return (
                    <label key={method} className="block">
                      <span className="text-xs font-semibold text-stone-600 capitalize">{method} Paid</span>
                      <input
                        readOnly
                        type="text"
                        value={formatCurrency(val || 0)}
                        className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-stone-100 px-2 text-xs text-stone-500 font-semibold outline-none"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="border-t border-stone-100 pt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-700">Total Paid</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-stone-900">{formatCurrency(totalPaid)}</span>
                    {paymentStatus === "paid" && (
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-stone-400 text-right uppercase tracking-wider font-semibold">
                  Method: {invoice.paymentMethod || "Split"}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}