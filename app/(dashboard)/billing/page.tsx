"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionButtons } from "@/components/salon-dashboard/action-buttons";
import { BillingTable } from "@/components/salon-dashboard/billing-table";
import { ProductTable } from "@/components/salon-dashboard/product-table";
import { SummaryCard } from "@/components/salon-dashboard/summary-card";
import type { ProductRow, ServiceRow } from "@/components/salon-dashboard/types";
import { formatCurrency } from "@/components/salon-dashboard/types";

// Firestore services
import * as customerService from "@/services/customers";
import * as servicesService from "@/services/services";
import * as productsService from "@/services/products";
import * as staffService from "@/services/staff";
import * as invoicesService from "@/services/invoices";

import type { Customer } from "@/types/customer";
import type { Service } from "@/types/service";
import type { Product } from "@/types/product";
import type { Staff } from "@/types/staff";

export default function BillingPage() {
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [invoicesCount, setInvoicesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false); // Controls button "Saved ✓" text and disabling
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invoice Form Fields
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [clientStatus, setClientStatus] = useState<"regular" | "membership" | "new" | null>(null);
  
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const [services, setServices] = useState<ServiceRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [upiAmount, setUpiAmount] = useState<number | "">("");
  const [cardAmount, setCardAmount] = useState<number | "">("");
  const [isSplitEdited, setIsSplitEdited] = useState(false);

  const loadBillingData = async () => {
    setLoading(true);
    try {
      const srvs = await servicesService.getAll();
      setServicesList(srvs);

      const prods = await productsService.getAll();
      setProductsList(prods);

      const stff = await staffService.getAll();
      setStaffList(stff.filter((s) => s.status === "Active"));

      const invs = await invoicesService.getAll();
      setInvoicesCount(invs.length);
      
      const nextNum = `INV-${new Date().getFullYear()}-${1001 + invs.length}`;
      setInvoiceNumber(nextNum);
    } catch (error) {
      console.error("Failed to load billing dependencies:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  // Membership detection trigger
  useEffect(() => {
    let active = true;
    if (customerMobile.trim().length >= 10) {
      const checkClient = async () => {
        try {
          const client = await customerService.getByPhone(customerMobile.trim());
          if (active) {
            if (client) {
              setClientStatus(client.customerType);
              // Auto-fill client name if found and not already edited
              if (!customerName) {
                setCustomerName(client.name);
              }
            } else {
              setClientStatus("new");
            }
          }
        } catch (error) {
          console.error("Failed to search customer phone:", error);
        }
      };
      checkClient();
    } else {
      setClientStatus(null);
    }
    return () => {
      active = false;
    };
  }, [customerMobile]);

  const totals = useMemo(() => {
    // Services sum before row discount
    const serviceTotal = services.reduce(
      (sum, item) => sum + Math.max(item.price, 0),
      0,
    );
    // Products sum before row discount
    const productTotal = products.reduce(
      (sum, item) => sum + Math.max(item.price * item.quantity, 0),
      0,
    );
    const subtotal = serviceTotal + productTotal;
    
    // Sum of all row-level discounts entered by the user
    const billDiscount = services.reduce((sum, item) => sum + (item.discount || 0), 0) +
                         products.reduce((sum, item) => sum + (item.discount || 0), 0);
                         
    const grandTotal = Math.max(subtotal - billDiscount, 0);

    return {
      serviceTotal,
      productTotal,
      subtotal,
      billDiscount,
      gst: 0, // No GST
      grandTotal,
    };
  }, [products, services]);

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
      setMessage({ type: "error", text: "Please enter Customer Name and Customer Mobile Number." });
      return;
    }
    if (services.length === 0 && products.length === 0) {
      setMessage({ type: "error", text: "Please add at least one service or product." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      // Step 1: Auto client creation
      let client = await customerService.getByPhone(customerMobile.trim());
      if (!client) {
        const newClientId = await customerService.create({
          name: customerName.trim(),
          phone: customerMobile.trim(),
          customerType: "regular",
        });
        client = {
          id: newClientId,
          name: customerName.trim(),
          phone: customerMobile.trim(),
          customerType: "regular",
        };
      }

      // Step 2: Save invoice
      const invoiceData = {
        invoiceNumber,
        invoiceNo: invoiceNumber,
        date,
        customerName: client.name,
        customerMobile: client.phone,
        customerPhone: client.phone,
        services,
        products,
        notes,
        subtotal: totals.subtotal,
        discount: totals.billDiscount,
        gst: 0,
        grandTotal: totals.grandTotal,
        paymentMethod: "Split",
        payments: {
          cash: cashVal,
          upi: upiVal,
          card: cardVal,
        },
        totalPaid: totals.grandTotal,
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
      };

      await invoicesService.create(invoiceData);
      
      // Auto-deduct inventory quantities
      for (const p of products) {
        const matchingProd = productsList.find((prod) => prod.name === p.product);
        if (matchingProd && matchingProd.id) {
          const newQty = Math.max(0, matchingProd.quantity - p.quantity);
          await productsService.update(matchingProd.id, { quantity: newQty });
        }
      }

      setMessage({ type: "success", text: `Invoice ${invoiceNumber} saved successfully!` });
      setSaved(true);
    } catch (error) {
      console.error("Failed to save bill:", error);
      setMessage({ type: "error", text: "Failed to submit invoice." });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    // Clear and prepare for next billing
    setServices([]);
    setProducts([]);
    setCustomerName("");
    setCustomerMobile("");
    setNotes("");
    setClientStatus(null);
    setMessage(null);
    setSaved(false);
    setCashAmount("");
    setUpiAmount("");
    setCardAmount("");
    setIsSplitEdited(false);
    
    // Re-increment invoice count number
    const nextNum = `INV-${new Date().getFullYear()}-${1001 + invoicesCount}`;
    setInvoiceNumber(nextNum);
  };

  const handleWhatsApp = () => {
    if (!customerMobile.trim()) {
      alert("Please enter a customer mobile number first.");
      return;
    }
    
    const formattedServices = services.map(s => `• ${s.service} - ₹${s.price - s.discount}`).join("\n");
    const formattedProducts = products.map(p => `• ${p.product} (x${p.quantity}) - ₹${p.price * p.quantity - p.discount}`).join("\n");
    
    let itemsText = "";
    if (formattedServices) itemsText += `Services:\n${formattedServices}\n`;
    if (formattedProducts) itemsText += `Products:\n${formattedProducts}\n`;

    const messageText = `Thank you for choosing Explore Salon ✨\n\nInvoice No: ${invoiceNumber}\nCustomer: ${customerName}\n\n${itemsText}\nTotal Amount: ₹${totals.grandTotal}\n\nWe look forward to serving you again.\n\nExplore Salon`;
    
    const cleanPhone = customerMobile.trim().replace(/[^0-9]/g, "");
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    
    window.open(whatsappUrl, "_blank");
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
        <div className="rounded-full border border-stone-200 bg-stone-100 px-4 py-2 text-sm text-stone-800 font-semibold shadow-sm">
          POS Shift Open • {invoicesCount} Invoices
        </div>
      </div>

      {message && (
        <div
          className={`mb-5 rounded-2xl border p-4 text-sm max-w-4xl font-medium ${
            message.type === "success"
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
                value={invoiceNumber}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-sm text-stone-700 outline-none"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
              {/* Membership Detection Badge */}
              {clientStatus && (
                <div className="mt-2 flex justify-start">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                      clientStatus === "membership"
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
          <SummaryCard totals={totals} />

          {/* Payment Details Card */}
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
              {/* Grand Total display */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <span className="text-sm font-semibold text-stone-700">Grand Total</span>
                <span className="text-lg font-bold text-stone-900">{formatCurrency(totals.grandTotal)}</span>
              </div>

              {/* Cash Input */}
              <label className="block">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-stone-600">Cash Amount</span>
                  {cashAmount !== "" && Number(cashAmount) > 0 && (
                    <span className="text-[10px] text-stone-400 font-medium">₹{cashAmount}</span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={cashAmount}
                  placeholder="0"
                  onChange={(e) => {
                    setIsSplitEdited(true);
                    const val = e.target.value;
                    setCashAmount(val === "" ? "" : Math.max(0, Number(val)));
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              {/* UPI Input */}
              <label className="block">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-stone-600">UPI Amount</span>
                  {upiAmount !== "" && Number(upiAmount) > 0 && (
                    <span className="text-[10px] text-stone-400 font-medium">₹{upiAmount}</span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={upiAmount}
                  placeholder="0"
                  onChange={(e) => {
                    setIsSplitEdited(true);
                    const val = e.target.value;
                    setUpiAmount(val === "" ? "" : Math.max(0, Number(val)));
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              {/* Card Input */}
              <label className="block">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-stone-600">Card Amount</span>
                  {cardAmount !== "" && Number(cardAmount) > 0 && (
                    <span className="text-[10px] text-stone-400 font-medium">₹{cardAmount}</span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={cardAmount}
                  placeholder="0"
                  onChange={(e) => {
                    setIsSplitEdited(true);
                    const val = e.target.value;
                    setCardAmount(val === "" ? "" : Math.max(0, Number(val)));
                  }}
                  className="mt-1 h-10 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              {/* Live Status and Calculations */}
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

                {/* Validation messages */}
                {totals.grandTotal > 0 && (
                  <div className="text-xs font-semibold text-right">
                    {isPaymentValid ? (
                      <span className="text-emerald-600">Payment matches bill total</span>
                    ) : paymentDiff > 0 ? (
                      <span className="text-amber-600">Remaining amount {formatCurrency(paymentDiff)}</span>
                    ) : (
                      <span className="text-red-600">Amount exceeds bill total by {formatCurrency(Math.abs(paymentDiff))}</span>
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
