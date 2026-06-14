"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButtons } from "@/components/salon-dashboard/action-buttons";
import { BillingTable } from "@/components/salon-dashboard/billing-table";
import { ProductTable } from "@/components/salon-dashboard/product-table";
import { SummaryCard } from "@/components/salon-dashboard/summary-card";
import type { ProductRow, ServiceRow } from "@/components/salon-dashboard/types";
import { formatCurrency } from "@/components/salon-dashboard/types";

import * as customerService from "@/services/customers";
import * as productsService from "@/services/products";
import * as invoicesService from "@/services/invoices";
import { useAppData } from "@/context/AppDataContext";

import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";
import type { Product } from "@/types/product";
import type { Staff } from "@/types/staff";
import type { Offer } from "@/types/offer";

export default function BillingPage() {
  const { services: servicesContextData, products: productsContextData, staff: staffContextData, offers: offersContextData, refreshProducts, loadingAppData } = useAppData();

  const servicesList = servicesContextData;
  const productsList = productsContextData;
  const staffList = useMemo(() => staffContextData.filter((s) => s.status === "Active" && s.dutyStatus === "onDuty"), [staffContextData]);
  const offersList = offersContextData;
  const loading = loadingAppData;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invoice Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [clientStatus, setClientStatus] = useState<"regular" | "membership" | "new" | null>(null);
  const [foundCustomerId, setFoundCustomerId] = useState<string | null>(null);

  // ── FIX: invoice number now comes from getNextInvoiceNumber() at save time,
  //         not pre-computed from invs.length on page load.
  //         We show a placeholder until the bill is saved.
  const [invoiceNumberDisplay, setInvoiceNumberDisplay] = useState("Auto-assigned on save");

  const [dateString, setDateString] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [upiAmount, setUpiAmount] = useState<number | "">("");
  const [cardAmount, setCardAmount] = useState<number | "">("");
  const [isSplitEdited, setIsSplitEdited] = useState(false);

  // ── Offer selection ──────────────────────────────────────────────────────
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");

  // Customer lookup by phone
  useEffect(() => {
    let active = true;
    if (customerMobile.trim().length >= 10) {
      const check = async () => {
        try {
          const client = await customerService.getByPhone(customerMobile.trim());
          if (!active) return;
          if (client) {
            setClientStatus(client.customerType as "regular" | "membership");
            setFoundCustomerId(client.id ?? null);
            if (!customerName) setCustomerName(client.name);
          } else {
            setClientStatus("new");
            setFoundCustomerId(null);
          }
        } catch (err) {
          console.error("Phone lookup failed:", err);
        }
      };
      check();
    } else {
      setClientStatus(null);
      setFoundCustomerId(null);
    }
    return () => { active = false; };
  }, [customerMobile]);

  // Bill subtotal (services + products) before any offer discount
  const baseSubtotal = useMemo(() => {
    const serviceTotal = services.reduce((sum, s) => sum + Math.max(s.price, 0), 0);
    const productTotal = products.reduce((sum, p) => sum + Math.max(p.price * p.quantity, 0), 0);
    return serviceTotal + productTotal;
  }, [services, products]);

  // ── Filter offers to those currently valid & eligible for this bill ───────
  const eligibleOffers = useMemo(() => {
    return offersList.filter((offer) => {
      if (offer.status !== "Active") return false;

      // Validity dates: compare against the invoice date (YYYY-MM-DD strings sort correctly)
      if (offer.startDate && dateString < offer.startDate) return false;
      if (offer.endDate && dateString > offer.endDate) return false;

      // Minimum bill amount check against the pre-discount subtotal
      if (offer.minBillAmount && baseSubtotal < offer.minBillAmount) return false;

      return true;
    });
  }, [offersList, dateString, baseSubtotal]);

  // If the selected offer becomes ineligible (e.g. bill total dropped below min), clear it
  useEffect(() => {
    if (selectedOfferId && !eligibleOffers.some((o) => o.id === selectedOfferId)) {
      setSelectedOfferId("");
    }
  }, [eligibleOffers, selectedOfferId]);

  const selectedOffer = eligibleOffers.find((o) => o.id === selectedOfferId) || null;

  const totals = useMemo(() => {
    const serviceTotal = services.reduce((sum, s) => sum + Math.max(s.price, 0), 0);
    const productTotal = products.reduce((sum, p) => sum + Math.max(p.price * p.quantity, 0), 0);
    const subtotal = serviceTotal + productTotal;
    const lineDiscount =
      services.reduce((sum, s) => sum + (s.discount || 0), 0) +
      products.reduce((sum, p) => sum + (p.discount || 0), 0);

    // ── Compute offer discount ──────────────────────────────────────────
    let offerDiscount = 0;
    if (selectedOffer) {
      const hasServiceScope = !!selectedOffer.applicableServiceIds?.length;
      const hasProductScope = !!selectedOffer.applicableProductIds?.length;
      const isScoped = hasServiceScope || hasProductScope;

      let offerBase = subtotal;
      if (isScoped) {
        offerBase = 0;
        if (hasServiceScope) {
          offerBase += services.reduce((sum, row) => {
            const matched = servicesList.find((s) => s.name === row.service);
            if (matched?.id && selectedOffer.applicableServiceIds!.includes(matched.id)) {
              return sum + Math.max(row.price, 0);
            }
            return sum;
          }, 0);
        }
        if (hasProductScope) {
          offerBase += products.reduce((sum, row) => {
            const matched = productsList.find((p) => p.name === row.product);
            if (matched?.id && selectedOffer.applicableProductIds!.includes(matched.id)) {
              return sum + Math.max(row.price * row.quantity, 0);
            }
            return sum;
          }, 0);
        }
      }

      if (selectedOffer.discountType === "percentage") {
        offerDiscount = (offerBase * selectedOffer.discountValue) / 100;
      } else {
        // Flat discount, capped at the offer's applicable base so it can't go negative
        offerDiscount = Math.min(selectedOffer.discountValue, offerBase);
      }
    }

    const totalDiscount = lineDiscount + offerDiscount;
    const grandTotal = Math.max(subtotal - totalDiscount, 0);
    return {
      serviceTotal,
      productTotal,
      subtotal,
      totalDiscount,
      billDiscount: lineDiscount,
      offerDiscount,
      grandTotal,
      gst: 0,
    };
  }, [services, products, selectedOffer, servicesList, productsList]);

  useEffect(() => {
    if (!isSplitEdited && totals.grandTotal > 0) {
      setCashAmount(totals.grandTotal);
      setUpiAmount("");
      setCardAmount("");
    }
  }, [totals.grandTotal, isSplitEdited]);

  const cashVal = cashAmount === "" ? 0 : Number(cashAmount);
  const upiVal = upiAmount === "" ? 0 : Number(upiAmount);
  const cardVal = cardAmount === "" ? 0 : Number(cardAmount);
  const totalPaid = cashVal + upiVal + cardVal;
  const paymentDiff = totals.grandTotal - totalPaid;
  const isPaymentValid = totals.grandTotal > 0 && Math.abs(paymentDiff) < 0.01;

  const handleSaveBill = async () => {
    if (!customerName.trim() || !customerMobile.trim()) {
      setMessage({ type: "error", text: "Please enter customer name and mobile number." });
      return;
    }
    if (services.length === 0 && products.length === 0) {
      setMessage({ type: "error", text: "Please add at least one service or product." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // ── Step 1: Resolve or create customer ──────────────────────────────
      let customerId = foundCustomerId;
      let resolvedCustomerType: "regular" | "membership" | "new" = clientStatus ?? "new";

      if (!customerId) {
        customerId = await customerService.create({
          name: customerName.trim(),
          phone: customerMobile.trim(),
          customerType: "regular",
        });
        resolvedCustomerType = "regular";
      }

      // ── Step 2: Get a collision-safe invoice number via Firestore transaction ──
      const invoiceNumber = await invoicesService.getNextInvoiceNumber();
      setInvoiceNumberDisplay(invoiceNumber);

      // ── Step 3: Build correctly-shaped service and product rows ─────────
      // Enrich each service row with serviceId and staffId (looked up by name).
      // Your BillingTable already has the service/staff name — we resolve IDs here.
      const enrichedServices = services.map((row) => {
        const matchedService = servicesList.find((s) => s.name === row.service);
        const matchedStaff = staffList.find((s) => s.name === row.staff);
        return {
          serviceId: matchedService?.id ?? "",
          serviceName: row.service,
          staffId: matchedStaff?.id ?? "",
          staffName: row.staff,
          price: row.price,
          discount: row.discount || 0,
          amount: Math.max(row.price - (row.discount || 0), 0),
        };
      });

      const enrichedProducts = products.map((row) => {
        return {
          productId: row.productId || "",
          productName: row.product,
          quantity: row.quantity,
          price: row.price,
          discount: row.discount || 0,
          amount: Math.max(row.price * row.quantity - (row.discount || 0), 0),
        };
      });

      // ── Step 4: Save invoice with correct schema ─────────────────────────
      await invoicesService.create({
        invoiceNumber,
        dateString,                          // service converts to Timestamp

        customerId,
        customerName: customerName.trim(),
        customerPhone: customerMobile.trim(), // single canonical field
        customerType: resolvedCustomerType,

        services: enrichedServices as any,
        products: enrichedProducts as any,

        totalServices: totals.serviceTotal,
        totalProducts: totals.productTotal,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        grandTotal: totals.grandTotal,

        // ── Offer applied to this bill, if any ────────────────────────────
        ...(selectedOffer
          ? {
            appliedOffer: {
              offerId: selectedOffer.id ?? "",
              code: selectedOffer.code,
              name: selectedOffer.name,
              discountType: selectedOffer.discountType,
              discountValue: selectedOffer.discountValue,
              discountAmount: totals.offerDiscount,
            },
          }
          : {}),

        paymentSplit: {                       // was "payments" — now matches spec
          cash: cashVal,
          upi: upiVal,
          card: cardVal,
        },
        paymentStatus: "paid",
        notes,
      });

      // ── Step 5: Deduct product stock by productId (not name string) ──────
      for (const row of enrichedProducts) {
        if (!row.productId) {
          console.warn(`Skipping stock deduction for product "${row.productName}" because productId is missing.`);
          continue;
        }
        const current = productsList.find((p) => p.id === row.productId);
        if (current) {
          await productsService.update(row.productId, {
            quantity: Math.max(0, current.quantity - row.quantity),
          });
        }
      }

      await refreshProducts();

      setMessage({ type: "success", text: `Invoice ${invoiceNumber} saved successfully!` });
      setSaved(true);
    } catch (error) {
      console.error("Failed to save bill:", error);
      setMessage({ type: "error", text: "Failed to submit invoice. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setServices([]);
    setProducts([]);
    setCustomerName("");
    setCustomerMobile("");
    setNotes("");
    setClientStatus(null);
    setFoundCustomerId(null);
    setMessage(null);
    setSaved(false);
    setCashAmount("");
    setUpiAmount("");
    setCardAmount("");
    setIsSplitEdited(false);
    setInvoiceNumberDisplay("Auto-assigned on save");
    setSelectedOfferId("");
  };

  const handleWhatsApp = () => {
    if (!customerMobile.trim()) {
      alert("Please enter a customer mobile number first.");
      return;
    }

    const formattedServices = services
      .map((s) => `• ${s.service} - ₹${s.price - (s.discount || 0)}`)
      .join("\n");
    const formattedProducts = products
      .map((p) => `• ${p.product} (x${p.quantity}) - ₹${p.price * p.quantity - (p.discount || 0)}`)
      .join("\n");

    let itemsText = "";
    if (formattedServices) itemsText += `Services:\n${formattedServices}\n`;
    if (formattedProducts) itemsText += `\nProducts:\n${formattedProducts}\n`;

    const offerLine = selectedOffer
      ? `\nOffer Applied: ${selectedOffer.code} (-₹${totals.offerDiscount})\n`
      : "";

    const msg =
      `Thank you for choosing Explore Salon ✨\n\n` +
      `Invoice No: ${invoiceNumberDisplay}\n` +
      `Customer: ${customerName}\n\n` +
      `${itemsText}` +
      `${offerLine}\n` +
      `Total Amount: ₹${totals.grandTotal}\n\n` +
      `We look forward to serving you again.\n\nExplore Salon`;

    // ── FIX: always prefix India country code 91 ──────────────────────────
    const digits = customerMobile.trim().replace(/\D/g, "");
    const e164 = digits.startsWith("91") && digits.length === 12 ? digits : `91${digits}`;
    window.open(`https://wa.me/${e164}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  const mappedServicesList = servicesList.map((s) => ({
    name: s.name,
    price: s.price,
    category: s.category || "General",
  }));

  const mappedProductsList = productsList.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
  }));

  const staffOptions = staffList.map((s) => s.name);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Billing
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            New Billing
          </h1>
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-2xl border p-4 text-sm max-w-4xl font-medium ${message.type === "success"
            ? "border-emerald-250 bg-emerald-50 text-emerald-800"
            : "border-red-250 bg-red-50 text-red-800"
            }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-md sm:p-5 text-stone-900">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Invoice Number</span>
              <input
                readOnly
                type="text"
                value={invoiceNumberDisplay}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-500 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Date</span>
              <input
                type="date"
                value={dateString}
                onChange={(e) => setDateString(e.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
              />
            </label>

            <div className="block">
              <span className="text-sm font-semibold text-stone-700">Customer Mobile</span>
              <input
                required
                type="text"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Type phone number..."
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
              />
              {clientStatus && (
                <div className="mt-2 flex justify-start">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${clientStatus === "membership"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : clientStatus === "regular"
                        ? "bg-blue-100 text-blue-800 border border-blue-300"
                        : "bg-stone-100 text-stone-800 border border-stone-300 animate-pulse"
                      }`}
                  >
                    {clientStatus === "membership"
                      ? "Membership Customer"
                      : clientStatus === "regular"
                        ? "Regular Customer"
                        : "New Customer"}
                  </span>
                </div>
              )}
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Customer Name</span>
              <input
                required
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name..."
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
              />
            </label>
          </div>

          <BillingTable
            rows={services}
            onRowsChange={setServices}
            serviceOptions={mappedServicesList}
            staffOptions={staffOptions}
          />

          <ProductTable
            rows={products}
            onRowsChange={setProducts}
            productOptions={mappedProductsList}
          />

          <label className="mt-5 block">
            <span className="text-sm font-semibold text-stone-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-black"
              placeholder="Add consultation notes, package details, or special instructions."
            />
          </label>
        </section>

        <aside className="space-y-5">
          {/* ── Offers Selector ────────────────────────────────────────── */}
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
            <h2 className="text-lg font-bold text-stone-900 mb-3">Apply Offer</h2>
            {offersList.length === 0 ? (
              <p className="text-sm text-stone-400">No offers have been created yet.</p>
            ) : eligibleOffers.length === 0 ? (
              <p className="text-sm text-stone-400">
                No active offers are eligible for this bill right now.
              </p>
            ) : (
              <select
                value={selectedOfferId}
                onChange={(e) => setSelectedOfferId(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none transition focus:border-black"
              >
                <option value="">No offer applied</option>
                {eligibleOffers.map((offer) => (
                  <option key={offer.id} value={offer.id}>
                    {offer.code} — {offer.name} (
                    {offer.discountType === "percentage"
                      ? `${offer.discountValue}% off`
                      : `${formatCurrency(offer.discountValue)} off`}
                    )
                  </option>
                ))}
              </select>
            )}
            {selectedOffer && (
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                Discount applied: -{formatCurrency(totals.offerDiscount)}
              </p>
            )}
          </section>

          <SummaryCard totals={totals} />

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">Payment Information</h2>
              {isSplitEdited && (
                <button
                  type="button"
                  onClick={() => setIsSplitEdited(false)}
                  className="text-xs font-semibold text-stone-500 hover:text-black transition underline"
                >
                  Reset to Full Cash
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-sm font-semibold text-stone-700">Grand Total</span>
                <span className="text-lg font-bold text-stone-900">{formatCurrency(totals.grandTotal)}</span>
              </div>

              {(["cash", "upi", "card"] as const).map((method) => {
                const val = method === "cash" ? cashAmount : method === "upi" ? upiAmount : cardAmount;
                const setFn = method === "cash" ? setCashAmount : method === "upi" ? setUpiAmount : setCardAmount;
                return (
                  <label key={method} className="block">
                    <span className="text-xs font-semibold text-stone-600 capitalize">{method} Amount</span>
                    <input
                      type="number"
                      min="0"
                      value={val}
                      placeholder="0"
                      onChange={(e) => {
                        setIsSplitEdited(true);
                        const v = e.target.value;
                        setFn(v === "" ? "" : Math.max(0, Number(v)));
                      }}
                      className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-black"
                    />
                  </label>
                );
              })}

              <div className="border-t border-stone-100 pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-700">Total Paid</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-stone-900">{formatCurrency(totalPaid)}</span>
                    {isPaymentValid && (
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                </div>
                {totals.grandTotal > 0 && (
                  <div className="text-xs font-semibold text-right">
                    {isPaymentValid ? (
                      <span className="text-emerald-600">Payment matches bill total</span>
                    ) : paymentDiff > 0 ? (
                      <span className="text-amber-600">Remaining {formatCurrency(paymentDiff)}</span>
                    ) : (
                      <span className="text-red-600">Exceeds total by {formatCurrency(Math.abs(paymentDiff))}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          <ActionButtons
            onSave={handleSaveBill}
            onClose={handleClose}
            onWhatsApp={handleWhatsApp}
            disabled={saved || saving || !isPaymentValid}
            saved={saved}
          />
        </aside>
      </div>
    </>
  );
}