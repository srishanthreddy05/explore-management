"use client";

import { useEffect, useState, use } from "react";
import * as invoicesService from "@/services/invoices";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { ChevronLeft, Receipt, User, DollarSign, CalendarDays, Send, Tag } from "lucide-react";
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

  // ── New-schema field reads ───────────────────────────────────────────────
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

  const cashPaid = paymentSplit.cash ?? (invoice.paymentMethod === "Cash" ? invoice.grandTotal : 0);
  const upiPaid = paymentSplit.upi ?? (invoice.paymentMethod === "UPI" ? invoice.grandTotal : 0);
  const cardPaid = paymentSplit.card ?? (invoice.paymentMethod === "Card" ? invoice.grandTotal : 0);
  const totalPaid = (cashPaid || 0) + (upiPaid || 0) + (cardPaid || 0) || invoice.grandTotal;

  // ── WhatsApp re-share ─────────────────────────────────────────────────────
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
    <div className="w-full text-stone-900 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/invoices"
            className="grid size-10 place-items-center rounded-xl border border-stone-200 bg-white text-stone-700 hover:text-black hover:border-black transition"
          >
            <ChevronLeft size={18} />
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-stone-500 font-bold">Receipts</p>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
              Invoice details for {invoiceNumber}
            </h1>
          </div>
        </div>

        {/* WhatsApp re-share button */}
        <button
          onClick={handleWhatsApp}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-700"
        >
          <Send size={16} />
          Share on WhatsApp
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Customer Info */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3 text-stone-500">
            <User size={18} className="text-stone-600" />
            <span className="text-sm font-bold text-stone-900">Customer Details</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-850">{invoice.customerName}</p>
            <p className="text-xs text-stone-500 mt-1">{customerPhone}</p>
            {invoice.customerType && (
              <span className="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                {invoice.customerType}
              </span>
            )}
          </div>
        </div>

        {/* Date info */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3 text-stone-500">
            <CalendarDays size={18} className="text-stone-600" />
            <span className="text-sm font-bold text-stone-900">Billing Date</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-850">{invoiceDateLabel}</p>
            <p className="text-xs text-stone-500 mt-1">
              Logged: {createdAtObj ? createdAtObj.toLocaleString() : "—"}
            </p>
          </div>
        </div>

        {/* Status info */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3 text-stone-500">
            <DollarSign size={18} className="text-stone-600" />
            <span className="text-sm font-bold text-stone-900">Payment Status</span>
          </div>
          <div className="flex flex-col items-start gap-1">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${paymentStatus === "paid"
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
            <span className="text-[10px] text-stone-400 mt-1 uppercase tracking-wider font-semibold">
              Method: {invoice.paymentMethod || "Split"}
            </span>
          </div>
        </div>
      </div>

      {/* Applied offer banner */}
      {appliedOffer && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <Tag size={18} className="text-emerald-700" />
          <div className="text-sm text-emerald-800">
            <span className="font-bold uppercase tracking-wider">{appliedOffer.code}</span>
            {" "}— {appliedOffer.name} applied, saving{" "}
            <span className="font-bold">{formatCurrency(appliedOffer.discountAmount)}</span>
          </div>
        </div>
      )}

      {/* Services Table */}
      {invoice.services && invoice.services.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900 mb-3">Services Rendered</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 font-bold">Service</th>
                  <th className="px-4 py-3 font-bold">Staff</th>
                  <th className="px-4 py-3 font-bold">Price</th>
                  <th className="px-4 py-3 font-bold">Discount</th>
                  <th className="px-4 py-3 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {invoice.services.map((item: any, idx: number) => {
                  const name = item.serviceName || item.service;
                  const staffName = item.staffName || item.staff;
                  const amount = item.amount ?? Math.max((item.price || 0) - (item.discount || 0), 0);
                  return (
                    <tr key={idx} className="bg-white">
                      <td className="px-4 py-3 font-semibold text-stone-900">{name}</td>
                      <td className="px-4 py-3 font-medium text-stone-700">{staffName}</td>
                      <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3 text-emerald-600">- {formatCurrency(item.discount || 0)}</td>
                      <td className="px-4 py-3 font-bold text-stone-900 text-right">
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

      {/* Products Table */}
      {invoice.products && invoice.products.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900 mb-3">Products Purchased</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3 font-bold">Product</th>
                  <th className="px-4 py-3 font-bold">Price</th>
                  <th className="px-4 py-3 font-bold">Quantity</th>
                  <th className="px-4 py-3 font-bold">Discount</th>
                  <th className="px-4 py-3 font-bold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {invoice.products.map((item: any, idx: number) => {
                  const name = item.productName || item.product;
                  const amount = item.amount ?? Math.max((item.price || 0) * (item.quantity || 1) - (item.discount || 0), 0);
                  return (
                    <tr key={idx} className="bg-white">
                      <td className="px-4 py-3 font-semibold text-stone-900">{name}</td>
                      <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                      <td className="px-4 py-3 font-medium text-stone-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-emerald-600">- {formatCurrency(item.discount || 0)}</td>
                      <td className="px-4 py-3 font-bold text-stone-900 text-right">
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

      {/* Bill summary and notes */}
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        {/* Notes */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-2">
          <span className="text-sm font-bold text-stone-900">Notes / Remarks</span>
          <p className="text-sm text-stone-500 leading-relaxed min-h-12">
            {invoice.notes || "No extra consultation notes or special instructions logged."}
          </p>
        </div>

        {/* Calculations */}
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm text-stone-900 space-y-4">
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

          <div className="space-y-2 border-t border-stone-200 pt-3 text-sm bg-stone-50/50 p-2.5 rounded-xl">
            <div className="font-semibold text-stone-700 text-xs mb-1.5 uppercase tracking-wider">Payment Split</div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Cash</span>
              <span className="font-medium text-stone-900">{formatCurrency(cashPaid || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>UPI</span>
              <span className="font-medium text-stone-900">{formatCurrency(upiPaid || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-500">
              <span>Card</span>
              <span className="font-medium text-stone-900">{formatCurrency(cardPaid || 0)}</span>
            </div>
            <div className="flex items-center justify-between text-stone-850 font-bold border-t border-stone-200 pt-2">
              <span>Total Paid</span>
              <span className="text-emerald-700">{formatCurrency(totalPaid)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}