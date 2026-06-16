"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButtons } from "@/components/salon-dashboard/action-buttons";
import { BillingTable } from "@/components/salon-dashboard/billing-table";
import { ProductTable } from "@/components/salon-dashboard/product-table";
import { SummaryCard } from "@/components/salon-dashboard/summary-card";
import type { ProductRow, ServiceRow } from "@/components/salon-dashboard/types";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { X } from "lucide-react";

import * as customerService from "@/services/customers";
import * as productsService from "@/services/products";
import * as invoicesService from "@/services/invoices";
import { useAppData } from "@/context/AppDataContext";
import { toLocalDateString } from "@/lib/utils/date";

import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";
import type { Product } from "@/types/product";
import type { Staff } from "@/types/staff";
import type { Offer } from "@/types/offer";

interface BillingTerminalProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function BillingTerminal({ onClose, onSuccess }: BillingTerminalProps) {
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

  const [invoiceNumberDisplay, setInvoiceNumberDisplay] = useState("Auto-assigned on save");

  const [dateString, setDateString] = useState(toLocalDateString(new Date()));

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [upiAmount, setUpiAmount] = useState<number | "">("");
  const [cardAmount, setCardAmount] = useState<number | "">("");
  const [isSplitEdited, setIsSplitEdited] = useState(false);

  // Offer selection
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [manuallyDeselected, setManuallyDeselected] = useState(false);

  // Customer lookup by phone
  useEffect(() => {
    setManuallyDeselected(false);
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

  // Filter offers to those currently valid & eligible for this bill
  const eligibleOffers = useMemo(() => {
    return offersList.filter((offer) => {
      if (offer.status !== "Active") return false;

      // Validity dates: compare against the invoice date
      if (offer.startDate && dateString < offer.startDate) return false;
      if (offer.endDate && dateString > offer.endDate) return false;

      // Customer type check
      if (offer.customerType && offer.customerType !== "all") {
        const currentType = clientStatus || "regular";
        if (currentType !== offer.customerType) return false;
      }

      // Minimum bill amount check: if the offer is scoped, check against the subtotal of applicable items.
      // Otherwise, check against the entire subtotal.
      if (offer.minBillAmount) {
        const hasServiceScope = !!offer.applicableServiceIds?.length;
        const hasProductScope = !!offer.applicableProductIds?.length;
        const isScoped = hasServiceScope || hasProductScope;

        let eligibleSubtotal = baseSubtotal;
        if (isScoped) {
          eligibleSubtotal = 0;
          if (hasServiceScope) {
            eligibleSubtotal += services.reduce((sum, row) => {
              const matched = servicesList.find((s) => s.name === row.service);
              if (matched?.id && offer.applicableServiceIds!.includes(matched.id)) {
                return sum + Math.max(row.price, 0);
              }
              return sum;
            }, 0);
          }
          if (hasProductScope) {
            eligibleSubtotal += products.reduce((sum, row) => {
              const matched = productsList.find((p) => p.id === row.productId || p.name === row.product);
              if (matched?.id && offer.applicableProductIds!.includes(matched.id)) {
                return sum + Math.max(row.price * row.quantity, 0);
              }
              return sum;
            }, 0);
          }
        }

        if (eligibleSubtotal < offer.minBillAmount) return false;
      }

      return true;
    });
  }, [offersList, dateString, baseSubtotal, services, products, servicesList, productsList]);

  // If the selected offer becomes ineligible, clear it
  useEffect(() => {
    if (selectedOfferId && !eligibleOffers.some((o) => o.id === selectedOfferId)) {
      setSelectedOfferId("");
    }
  }, [eligibleOffers, selectedOfferId]);

  // Auto-apply offer
  useEffect(() => {
    if (manuallyDeselected) return;
    if (eligibleOffers.length > 0) {
      if (!selectedOfferId) {
        setSelectedOfferId(eligibleOffers[0].id || "");
      }
    } else {
      setSelectedOfferId("");
    }
  }, [eligibleOffers, selectedOfferId, manuallyDeselected]);

  const selectedOffer = eligibleOffers.find((o) => o.id === selectedOfferId) || null;

  const totals = useMemo(() => {
    const serviceTotal = services.reduce((sum, s) => sum + Math.max(s.price, 0), 0);
    const productTotal = products.reduce((sum, p) => sum + Math.max(p.price * p.quantity, 0), 0);
    const subtotal = serviceTotal + productTotal;
    const lineDiscount =
      services.reduce((sum, s) => sum + (s.discount || 0), 0) +
      products.reduce((sum, p) => sum + (p.discount || 0), 0);

    // Compute offer discount
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
            const matched = productsList.find((p) => p.id === row.productId || p.name === row.product);
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
      setUpiAmount(totals.grandTotal);
      setCashAmount("");
      setCardAmount("");
    }
  }, [totals.grandTotal, isSplitEdited]);

  const cashVal = cashAmount === "" ? 0 : Number(cashAmount);
  const upiVal = upiAmount === "" ? 0 : Number(upiAmount);
  const cardVal = cardAmount === "" ? 0 : Number(cardAmount);
  const totalPaid = cashVal + upiVal + cardVal;
  const paymentDiff = totals.grandTotal - totalPaid;
  const isPaymentValid = totals.grandTotal > 0 && Math.abs(paymentDiff) < 0.01;

  // ESC Key Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // If onClose is provided, close the terminal
        if (onClose) {
          handleClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, services, products, customerName, customerMobile, cashAmount, upiAmount, cardAmount, selectedOfferId]);

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
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

      // Step 1: Resolve or create customer
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

      // Step 2: Get a collision-safe invoice number via Firestore transaction
      let invoiceNumber = "Auto";
      if (!isOnline) {
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const dateStr = `${yy}${mm}${dd}`;
        const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        invoiceNumber = `EXP-${dateStr}-OFF-${rand}`;
      } else {
        try {
          invoiceNumber = await invoicesService.getNextInvoiceNumber();
        } catch (txErr: any) {
          console.warn("Failed to get invoice number via transaction, falling back to offline code:", txErr);
          const now = new Date();
          const yy = String(now.getFullYear()).slice(-2);
          const mm = String(now.getMonth() + 1).padStart(2, '0');
          const dd = String(now.getDate()).padStart(2, '0');
          const dateStr = `${yy}${mm}${dd}`;
          const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
          invoiceNumber = `EXP-${dateStr}-OFF-${rand}`;
        }
      }
      setInvoiceNumberDisplay(invoiceNumber);

      // Step 3: Build correctly-shaped service and product rows
      const enrichedServices = services.map((row) => {
        const matchedService = servicesList.find((s) => s.name === row.service);
        const matchedStaff = staffList.find((s) => s.name === row.staff);
        let usedProductCost = 0;
        if (row.usedProductId) {
          const matchedProduct = productsList.find((p) => p.id === row.usedProductId);
          if (matchedProduct && typeof matchedProduct.costPerServing === "number") {
            usedProductCost = matchedProduct.costPerServing;
          }
        }
        const serviceAmount = Math.max(row.price - (row.discount || 0), 0);
        const staffRole = matchedStaff?.role || "Stylist";
        const stylistShare = staffRole === "Owner" ? 0 : 0.5 * serviceAmount - usedProductCost;
        const ownerShare = staffRole === "Owner" ? serviceAmount : 0.5 * serviceAmount + usedProductCost;
        return {
          serviceId: matchedService?.id ?? "",
          serviceName: row.service,
          staffId: matchedStaff?.id ?? "",
          staffName: row.staff,
          price: row.price,
          discount: row.discount || 0,
          amount: serviceAmount,
          usedProductId: row.usedProductId ?? null,
          usedProductName: row.usedProductName ?? null,
          usedProductCost,
          staffRole,
          stylistShare,
          ownerShare,
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

      // Step 4: Save invoice with correct schema
      await invoicesService.create({
        invoiceNumber,
        dateString,

        customerId,
        customerName: customerName.trim(),
        customerPhone: customerMobile.trim(),
        customerType: resolvedCustomerType,

        services: enrichedServices as any,
        products: enrichedProducts as any,

        totalServices: totals.serviceTotal,
        totalProducts: totals.productTotal,
        subtotal: totals.subtotal,
        totalDiscount: totals.totalDiscount,
        grandTotal: totals.grandTotal,

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

        paymentSplit: {
          cash: cashVal,
          upi: upiVal,
          card: cardVal,
        },
        paymentMethod: cashVal === totals.grandTotal ? "Cash" : upiVal === totals.grandTotal ? "UPI" : cardVal === totals.grandTotal ? "Card" : "Split",
        paymentStatus: "paid",
      });

      await refreshProducts();

      if (isOnline) {
        setMessage({ type: "success", text: `Invoice ${invoiceNumber} saved successfully!` });
      } else {
        setMessage({ type: "success", text: `Invoice ${invoiceNumber} saved locally — will sync when online!` });
      }
      setSaved(true);

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, isOnline ? 0 : 2000);
      }
    } catch (error: any) {
      console.error("Failed to save bill:", error);
      const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
      if (error?.code === "unavailable" || error?.message?.includes("unavailable") || !isOnline) {
        // Local persistent cache handles offline writes, let cashier proceed
        setMessage({ type: "success", text: `Saved locally — will sync when online!` });
        setSaved(true);
        await refreshProducts();
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } else {
        setMessage({ type: "error", text: error?.message || "Failed to submit invoice. Please try again." });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setServices([]);
    setProducts([]);
    setCustomerName("");
    setCustomerMobile("");
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

    if (onClose) {
      onClose();
    }
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

    const greeting = `Hello ${customerName},\n\nThank you for choosing Explore Salon ✨\n\n`;

    let itemsText = "";
    if (formattedServices) {
      itemsText += `Services:\n${formattedServices}\n\n`;
    }
    if (formattedProducts) {
      itemsText += `Products:\n${formattedProducts}\n\n`;
    }

    const grandTotal = totals.grandTotal;
    const discountAmount = totals.totalDiscount;
    const offerDiscount = totals.offerDiscount;
    const lineDiscount = totals.billDiscount;
    const subtotal = totals.subtotal;

    const hasDiscountOrOffer = discountAmount > 0;

    let pricingText = "";
    if (hasDiscountOrOffer) {
      pricingText += `Subtotal: ₹${subtotal}\n`;
      if (lineDiscount > 0) {
        pricingText += `Discount: -₹${lineDiscount}\n`;
      }
      if (selectedOffer && offerDiscount > 0) {
        pricingText += `Offer Applied: ${selectedOffer.code} (-₹${offerDiscount})\n`;
      }
    }
    pricingText += `Total Amount: ₹${grandTotal}\n\n`;

    const closing =
      `Invoice No: ${invoiceNumberDisplay}\n` +
      `We look forward to serving you again.\n\n` +
      `Explore Salon`;

    const msg = `${greeting}${itemsText}${pricingText}${closing}`;

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

  const mappedProductsList = productsList
    .filter((p) => !p.type || p.type === "retail")
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
    }));

  const serviceProductOptions = useMemo(() => {
    return productsList
      .filter((p) => p.type === "service")
      .map((p) => ({
        id: p.id || "",
        name: p.name,
        noOfServings: p.noOfServings || 0,
      }));
  }, [productsList]);

  const staffOptions = staffList.map((s) => s.name);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            New Billing
          </h1>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-stone-200 bg-white p-2.5 text-stone-500 hover:text-black hover:border-black hover:-translate-y-0.5 transition shadow-sm cursor-pointer"
            title="Close Terminal (ESC)"
          >
            <X size={20} />
          </button>
        )}
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
                disabled={saved}
                onChange={(e) => setDateString(e.target.value)}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
              />
            </label>

            <div className="block">
              <span className="text-sm font-semibold text-stone-700">Customer Mobile</span>
              <input
                required
                type="text"
                value={customerMobile}
                disabled={saved}
                onChange={(e) => setCustomerMobile(e.target.value)}
                placeholder="Type phone number..."
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
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
                disabled={saved}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name..."
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
              />
            </label>
          </div>

          <BillingTable
            rows={services}
            onRowsChange={setServices}
            serviceOptions={mappedServicesList}
            staffOptions={staffOptions}
            serviceProductOptions={serviceProductOptions}
            disabled={saved}
          />

          <ProductTable
            rows={products}
            onRowsChange={setProducts}
            productOptions={mappedProductsList}
            disabled={saved}
          />

          <div className="grid gap-5 md:grid-cols-2 mt-6 pt-6 border-t border-stone-200">
            {/* Offers Selector */}
            <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm text-stone-900 flex flex-col justify-between">
              <div>
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
                    disabled={saved}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedOfferId(val);
                      if (val === "") {
                        setManuallyDeselected(true);
                      } else {
                        setManuallyDeselected(false);
                      }
                    }}
                    className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none transition focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
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
              </div>
              {selectedOffer && (
                <p className="mt-3 text-xs font-semibold text-emerald-700">
                  Discount applied: -{formatCurrency(totals.offerDiscount)}
                </p>
              )}
            </section>

            {/* Action Buttons */}
            <ActionButtons
              onSave={handleSaveBill}
              onClose={handleClose}
              onWhatsApp={handleWhatsApp}
              disabled={saved || saving || !isPaymentValid}
              saved={saved}
            />
          </div>
        </section>

        <aside className="space-y-5">
          <SummaryCard totals={totals} />

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md text-stone-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-stone-900">Payment Information</h2>
              {isSplitEdited && (
                <button
                  type="button"
                  disabled={saved}
                  onClick={() => setIsSplitEdited(false)}
                  className="text-xs font-semibold text-stone-500 hover:text-black transition underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                >
                  Reset to Full UPI
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-sm font-semibold text-stone-700">Grand Total</span>
                <span className="text-lg font-bold text-stone-900">{formatCurrency(totals.grandTotal)}</span>
              </div>

              {/* Horizontal Payment Inputs */}
              <div className="grid grid-cols-3 gap-2.5">
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
                        disabled={saved}
                        onChange={(e) => {
                          setIsSplitEdited(true);
                          const v = e.target.value;
                          setFn(v === "" ? "" : Math.max(0, Number(v)));
                        }}
                        className="mt-1.5 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-2 text-sm text-stone-900 outline-none focus:border-black disabled:bg-stone-100 disabled:text-stone-500"
                      />
                    </label>
                  );
                })}
              </div>

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
        </aside>
      </div>
    </>
  );
}
