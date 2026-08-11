"use client";

import { useEffect, useState } from "react";
import {
    collection,
    getDocs,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEBUG_DATE = "2026-08-08";

type ServiceResult = {
    service: string;
    staff: string;
    role: string;
    price: number;
    storedAmount: number;
    productCost: number;

    ownerDirect: number;
    stylistBase: number;
    stylistNet: number;
    ownerFromStylist: number;
    ownerTotal: number;
};

type InvoiceResult = {
    id: string;
    invoiceNumber: string;
    customer: string;

    grandTotal: number;
    subtotal: number;

    serviceRevenue: number;
    ownerDirect: number;
    stylistBase: number;
    stylistProductCost: number;
    ownerFromStylists: number;
    ownerServiceShare: number;

    retailRaw: number;
    retailDiscount: number;
    retailSales: number;
    membership: number;

    expectedOwnerGross: number;

    services: ServiceResult[];
    products: any[];
};

function money(value: number | null | undefined) {
    const numericValue = Number(value ?? 0);

    // Prevent the debug page from crashing if an optional/legacy
    // Firestore field is missing or undefined.
    if (!Number.isFinite(numericValue)) {
        return "₹0.00";
    }

    return `₹${numericValue.toFixed(2)}`;
}

export default function SettlementDebugPage() {
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState<InvoiceResult[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                setLoading(true);

                /*
                 * Fetch invoices for the entire August range,
                 * then STRICTLY filter to 8 August.
                 */
                const q = query(
                    collection(db, "invoices"),
                    where("dateKey", ">=", "2026-08-08"),
                    where("dateKey", "<=", "2026-08-08")
                );

                const snap = await getDocs(q);

                const results: InvoiceResult[] = [];

                snap.forEach((docSnap) => {
                    const inv = docSnap.data() as any;

                    /*
                     * Extra safety:
                     * absolutely reject anything that isn't 8 Aug.
                     */
                    if (inv.dateKey !== DEBUG_DATE) {
                        return;
                    }

                    let serviceRevenue = 0;
                    let ownerDirect = 0;
                    let stylistBase = 0;
                    let stylistProductCost = 0;
                    let ownerFromStylists = 0;

                    const services: ServiceResult[] = [];

                    for (const s of inv.services || []) {
                        const role =
                            s.staffRole ||
                            (s.staffName === "Sai Kiran" ? "Owner" : "Stylist");

                        const amount =
                            s.amount !== undefined && s.amount !== null
                                ? Number(s.amount)
                                : Math.max(
                                    Number(s.price || 0) -
                                    Number(s.discount || 0),
                                    0
                                );

                        const productCost = Number(
                            s.usedProductCost || 0
                        );

                        serviceRevenue += amount;

                        if (role === "Owner") {
                            /*
                             * Owner-served:
                             * 100% Owner
                             */
                            ownerDirect += amount;

                            services.push({
                                service: s.serviceName || s.serviceId || "Unknown",
                                staff: s.staffName || "Unknown",
                                role,
                                price: Number(s.price || 0),
                                storedAmount: amount,
                                productCost,

                                ownerDirect: amount,
                                stylistBase: 0,
                                stylistNet: 0,
                                ownerFromStylist: 0,
                                ownerTotal: amount,
                            });
                        } else {
                            /*
                             * Stylist-served:
                             *
                             * 50% stylist
                             * 50% owner
                             *
                             * Product cost:
                             * - stylist loses product cost
                             * - owner receives product cost
                             */
                            const baseShare = amount * 0.5;

                            const stylistNet =
                                baseShare - productCost;

                            const ownerFromStylist =
                                baseShare + productCost;

                            stylistBase += baseShare;
                            stylistProductCost += productCost;
                            ownerFromStylists += ownerFromStylist;

                            services.push({
                                service: s.serviceName || s.serviceId || "Unknown",
                                staff: s.staffName || "Unknown",
                                role,
                                price: Number(s.price || 0),
                                storedAmount: amount,
                                productCost,

                                ownerDirect: 0,
                                stylistBase: baseShare,
                                stylistNet,
                                ownerFromStylist,
                                ownerTotal: ownerFromStylist,
                            });
                        }
                    }

                    /*
                     * Retail products belong 100% to Owner.
                     *
                     * IMPORTANT:
                     * inv.totalProducts may represent the RAW/catalog
                     * product value (for example ₹357), while the
                     * customer may actually be charged a discounted
                     * amount (for example ₹300 after a ₹57 discount).
                     *
                     * Settlement must use the ACTUAL product amount
                     * charged to the customer, not the raw catalog price.
                     *
                     * Preferred source:
                     *   product.amount
                     *
                     * Legacy fallback:
                     *   (price × quantity) - discount
                     */
                    let retailRaw = 0;
                    let retailDiscount = 0;
                    let retailSales = 0;

                    for (const p of inv.products || []) {
                        const quantity = Math.max(
                            Number(p.quantity ?? 1),
                            0
                        );
                        const price = Number(p.price || 0);
                        const discount = Math.max(
                            Number(p.discount || 0),
                            0
                        );

                        const rawAmount =
                            price * quantity;

                        const storedAmount =
                            p.amount !== undefined &&
                                p.amount !== null
                                ? Number(p.amount)
                                : Math.max(
                                    rawAmount - discount,
                                    0
                                );

                        retailRaw += rawAmount;
                        retailDiscount += discount;
                        retailSales += Math.max(
                            storedAmount,
                            0
                        );
                    }

                    /*
                     * Membership is kept separate.
                     */
                    const membership = Number(
                        inv.membershipAmount || 0
                    );

                    const ownerServiceShare =
                        ownerDirect + ownerFromStylists;

                    const expectedOwnerGross =
                        ownerServiceShare +
                        retailSales +
                        membership;

                    results.push({
                        id: docSnap.id,
                        invoiceNumber:
                            inv.invoiceNumber || docSnap.id,
                        customer:
                            inv.customerName || "Unknown",

                        grandTotal: Number(
                            inv.grandTotal || 0
                        ),

                        subtotal: Number(
                            inv.subtotal || 0
                        ),

                        serviceRevenue,
                        ownerDirect,
                        stylistBase,
                        stylistProductCost,
                        ownerFromStylists,
                        ownerServiceShare,

                        retailRaw,
                        retailDiscount,
                        retailSales,
                        membership,

                        expectedOwnerGross,

                        services,
                        products: Array.isArray(inv.products)
                            ? inv.products
                            : [],
                    });
                });

                results.sort((a, b) =>
                    a.invoiceNumber.localeCompare(
                        b.invoiceNumber
                    )
                );

                setInvoices(results);
            } catch (e: any) {
                console.error(e);
                setError(e.message || String(e));
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-white">
                Loading Aug 8 settlement debug...
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-red-400">
                Error: {error}
            </div>
        );
    }

    /*
     * AUG 8 TOTALS
     */
    const totals = invoices.reduce(
        (acc, inv) => {
            acc.serviceRevenue += inv.serviceRevenue;
            acc.ownerDirect += inv.ownerDirect;
            acc.stylistBase += inv.stylistBase;
            acc.stylistProductCost +=
                inv.stylistProductCost;
            acc.ownerFromStylists +=
                inv.ownerFromStylists;
            acc.ownerServiceShare +=
                inv.ownerServiceShare;
            acc.retailRaw += inv.retailRaw;
            acc.retailDiscount += inv.retailDiscount;
            acc.retailSales += inv.retailSales;
            acc.membership += inv.membership;
            acc.expectedOwnerGross +=
                inv.expectedOwnerGross;

            return acc;
        },
        {
            serviceRevenue: 0,
            ownerDirect: 0,
            stylistBase: 0,
            stylistProductCost: 0,
            ownerFromStylists: 0,
            ownerServiceShare: 0,
            retailRaw: 0,
            retailDiscount: 0,
            retailSales: 0,
            membership: 0,
            expectedOwnerGross: 0,
        }
    );

    /*
     * Service reconciliation.
     */
    const totalStylistNet =
        totals.stylistBase -
        totals.stylistProductCost;

    const ownerPlusStylist =
        totals.ownerServiceShare +
        totalStylistNet;

    const serviceDifference =
        totals.serviceRevenue -
        ownerPlusStylist;

    return (
        <div className="min-h-screen bg-black text-white p-6 space-y-8">

            <div>
                <h1 className="text-2xl font-bold text-yellow-400">
                    Settlement Debug — 08 Aug 2026
                </h1>

                <p className="text-gray-400 mt-2">
                    Independent calculation. This page does NOT
                    modify settlements or stats.
                </p>

                <p className="text-yellow-400 mt-2">
                    Retail settlement uses the actual discounted product amount
                    charged to the customer (product.amount), not the raw catalog
                    price or invoice.totalProducts when that field contains the
                    pre-discount value.
                </p>
            </div>

            {/* SUMMARY */}

            <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">

                <h2 className="text-xl font-bold mb-5">
                    August 8 Summary
                </h2>

                <div className="grid md:grid-cols-3 gap-4">

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Invoices
                        </div>
                        <div className="text-2xl font-bold">
                            {invoices.length}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Service Revenue
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totals.serviceRevenue)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Owner Service Share
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totals.ownerServiceShare)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Stylist Base 50%
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totals.stylistBase)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Stylist Product Costs
                        </div>
                        <div className="text-2xl font-bold">
                            {money(
                                totals.stylistProductCost
                            )}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Stylist Net
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totalStylistNet)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Retail Raw / Catalog
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totals.retailRaw)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg">
                        <div className="text-gray-400">
                            Retail Discounts
                        </div>
                        <div className="text-2xl font-bold">
                            {money(totals.retailDiscount)}
                        </div>
                    </div>

                    <div className="bg-black p-4 rounded-lg border border-yellow-700">
                        <div className="text-gray-400">
                            Retail Actual / Charged
                        </div>
                        <div className="text-2xl font-bold text-yellow-400">
                            {money(totals.retailSales)}
                        </div>
                    </div>

                </div>
            </section>

            {/* RECONCILIATION */}

            <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">

                <h2 className="text-xl font-bold mb-5">
                    Service Split Reconciliation
                </h2>

                <div className="space-y-3">

                    <Row
                        label="Service Revenue"
                        value={totals.serviceRevenue}
                    />

                    <Row
                        label="Owner Service Share"
                        value={totals.ownerServiceShare}
                    />

                    <Row
                        label="Stylist Net Share"
                        value={totalStylistNet}
                    />

                    <Row
                        label="Owner + Stylist"
                        value={ownerPlusStylist}
                    />

                    <Row
                        label="Reconciliation Difference"
                        value={serviceDifference}
                        danger={
                            Math.abs(serviceDifference) > 0.01
                        }
                    />

                </div>

            </section>

            {/* OWNER CALCULATION */}

            <section className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">

                <h2 className="text-xl font-bold mb-5">
                    Owner Calculation
                </h2>

                <div className="space-y-3">

                    <Row
                        label="Owner Direct Services"
                        value={totals.ownerDirect}
                    />

                    <Row
                        label="Stylists 50% Base"
                        value={totals.stylistBase}
                    />

                    <Row
                        label="Product Costs Added to Owner"
                        value={totals.stylistProductCost}
                    />

                    <Row
                        label="Owner Share From Stylists"
                        value={totals.ownerFromStylists}
                    />

                    <Row
                        label="Owner Service Share"
                        value={totals.ownerServiceShare}
                    />

                    <Row
                        label="Retail Raw / Catalog Value"
                        value={totals.retailRaw}
                    />

                    <Row
                        label="Retail Product Discounts"
                        value={totals.retailDiscount}
                    />

                    <Row
                        label="Retail Product Sales (Actual Charged)"
                        value={totals.retailSales}
                        highlight
                    />

                    <Row
                        label="Membership"
                        value={totals.membership}
                    />

                    <div className="border-t border-zinc-700 pt-4 mt-4">

                        <Row
                            label="EXPECTED OWNER GROSS"
                            value={totals.expectedOwnerGross}
                            highlight
                        />

                    </div>

                </div>

            </section>

            {/* INVOICE BREAKDOWN */}

            <section className="space-y-6">

                <h2 className="text-xl font-bold">
                    Invoice-by-Invoice Breakdown
                </h2>

                {invoices.map((inv) => (

                    <div
                        key={inv.id}
                        className="bg-zinc-900 rounded-xl p-6 border border-zinc-700"
                    >

                        <div className="mb-5">

                            <h3 className="text-lg font-bold text-yellow-400">
                                {inv.invoiceNumber}
                            </h3>

                            <div className="text-gray-400">
                                Customer: {inv.customer}
                            </div>

                            <div className="text-gray-400">
                                Grand Total:{" "}
                                {money(inv.grandTotal)}
                            </div>

                            <div className="text-gray-400">
                                Subtotal:{" "}
                                {money(inv.subtotal)}
                            </div>

                        </div>

                        {/* RETAIL PRODUCT RECONCILIATION */}

                        {(inv.products || []).length > 0 && (
                            <div className="mb-6 bg-black rounded-lg p-4 border border-zinc-800">
                                <h4 className="font-bold text-yellow-400 mb-3">
                                    Retail Product Reconciliation
                                </h4>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-zinc-700 text-gray-400">
                                                <th className="text-left p-2">Product</th>
                                                <th className="text-right p-2">Qty</th>
                                                <th className="text-right p-2">Price</th>
                                                <th className="text-right p-2">Discount</th>
                                                <th className="text-right p-2">Actual Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(inv.products || []).map((p: any, index: number) => {
                                                const qty = Math.max(Number(p.quantity ?? 1), 0);
                                                const price = Number(p.price || 0);
                                                const discount = Math.max(Number(p.discount || 0), 0);
                                                const raw = price * qty;
                                                const amount =
                                                    p.amount !== undefined && p.amount !== null
                                                        ? Number(p.amount)
                                                        : Math.max(raw - discount, 0);

                                                return (
                                                    <tr
                                                        key={index}
                                                        className="border-b border-zinc-800"
                                                    >
                                                        <td className="p-2">
                                                            {p.productName || p.name || p.productId || "Unknown"}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {qty}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {money(price)}
                                                        </td>
                                                        <td className="p-2 text-right">
                                                            {money(discount)}
                                                        </td>
                                                        <td className="p-2 text-right text-yellow-400 font-bold">
                                                            {money(amount)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-4 space-y-2">
                                    <Row
                                        label="Raw Product Value"
                                        value={inv.retailRaw}
                                    />
                                    <Row
                                        label="Product Discount"
                                        value={inv.retailDiscount}
                                    />
                                    <Row
                                        label="Actual Product Revenue"
                                        value={inv.retailSales}
                                        highlight
                                    />
                                </div>
                            </div>
                        )}

                        <div className="overflow-x-auto">

                            <table className="w-full text-sm">

                                <thead>
                                    <tr className="border-b border-zinc-700 text-gray-400">

                                        <th className="text-left p-2">
                                            Service
                                        </th>

                                        <th className="text-left p-2">
                                            Staff
                                        </th>

                                        <th className="text-left p-2">
                                            Role
                                        </th>

                                        <th className="text-right p-2">
                                            Amount
                                        </th>

                                        <th className="text-right p-2">
                                            Product
                                        </th>

                                        <th className="text-right p-2">
                                            Stylist Net
                                        </th>

                                        <th className="text-right p-2">
                                            Owner Share
                                        </th>

                                    </tr>
                                </thead>

                                <tbody>

                                    {inv.services.map((s, index) => (

                                        <tr
                                            key={index}
                                            className="border-b border-zinc-800"
                                        >

                                            <td className="p-2">
                                                {s.service}
                                            </td>

                                            <td className="p-2">
                                                {s.staff}
                                            </td>

                                            <td className="p-2">
                                                {s.role}
                                            </td>

                                            <td className="p-2 text-right">
                                                {money(s.storedAmount)}
                                            </td>

                                            <td className="p-2 text-right">
                                                {money(s.productCost)}
                                            </td>

                                            <td className="p-2 text-right">
                                                {money(s.stylistNet)}
                                            </td>

                                            <td className="p-2 text-right">
                                                {money(s.ownerTotal)}
                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                        <div className="mt-5 space-y-2">

                            <Row
                                label="Service Revenue"
                                value={inv.serviceRevenue}
                            />

                            <Row
                                label="Owner Direct"
                                value={inv.ownerDirect}
                            />

                            <Row
                                label="Owner From Stylists"
                                value={inv.ownerFromStylists}
                            />

                            <Row
                                label="Owner Service Share"
                                value={inv.ownerServiceShare}
                            />

                            <Row
                                label="Retail Raw / Catalog"
                                value={inv.retailRaw}
                            />

                            <Row
                                label="Retail Discount"
                                value={inv.retailDiscount}
                            />

                            <Row
                                label="Retail Actual / Charged"
                                value={inv.retailSales}
                                highlight
                            />

                            <Row
                                label="Expected Owner Gross"
                                value={inv.expectedOwnerGross}
                                highlight
                            />

                        </div>

                    </div>

                ))}

            </section>

            {/* FINAL */}

            <section className="bg-yellow-950 rounded-xl p-6 border border-yellow-700">

                <h2 className="text-xl font-bold text-yellow-400">
                    FINAL DEBUG RESULT
                </h2>

                <div className="mt-4 text-lg space-y-2">

                    <div>
                        Correct Owner Service Share:
                        <strong className="ml-2">
                            {money(
                                totals.ownerServiceShare
                            )}
                        </strong>
                    </div>

                    <div>
                        Retail Raw / Catalog:
                        <strong className="ml-2">
                            {money(totals.retailRaw)}
                        </strong>
                    </div>

                    <div>
                        Retail Discounts:
                        <strong className="ml-2">
                            {money(totals.retailDiscount)}
                        </strong>
                    </div>

                    <div>
                        Retail Actual / Charged:
                        <strong className="ml-2 text-yellow-400">
                            {money(totals.retailSales)}
                        </strong>
                    </div>

                    <div>
                        Expected Owner Gross:
                        <strong className="ml-2">
                            {money(
                                totals.expectedOwnerGross
                            )}
                        </strong>
                    </div>

                    <div className="border-t border-yellow-800 pt-3 mt-3">

                        <strong>
                            Owner + Stylist =
                            Service Revenue
                        </strong>

                        <div>
                            {money(ownerPlusStylist)}
                            {" = "}
                            {money(totals.serviceRevenue)}
                        </div>

                    </div>

                </div>

            </section>

        </div>
    );
}

function Row({
    label,
    value,
    danger = false,
    highlight = false,
}: {
    label: string;
    value: number;
    danger?: boolean;
    highlight?: boolean;
}) {
    return (
        <div
            className={`flex justify-between items-center p-3 rounded-lg ${highlight
                ? "bg-yellow-900/30 border border-yellow-700"
                : "bg-black"
                }`}
        >
            <span
                className={
                    danger
                        ? "text-red-400 font-bold"
                        : "text-gray-300"
                }
            >
                {label}
            </span>

            <span
                className={
                    danger
                        ? "text-red-400 font-bold"
                        : highlight
                            ? "text-yellow-400 font-bold"
                            : "font-bold"
                }
            >
                {money(value)}
            </span>
        </div>
    );
}