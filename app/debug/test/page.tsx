"use client";

import { useEffect, useMemo, useState } from "react";
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface CreditBalance {
    id: string;
    invoiceNumber?: string;
    customerName?: string;
    creditAmount?: number;
    remainingAmount?: number;
    status?: string;
    createdAt?: any;
    settledAt?: any;
    [key: string]: any;
}

export default function CreditBalancesDebugPage() {
    const [records, setRecords] = useState<CreditBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<{
        creditAmount: string;
        remainingAmount: string;
    }>({ creditAmount: "", remainingAmount: "" });

    useEffect(() => {
        loadCredits();
    }, []);

    async function loadCredits() {
        setLoading(true);
        try {
            const q = query(
                collection(db, "credit_balances"),
                orderBy("createdAt", "desc")
            );
            const snap = await getDocs(q);
            const docs = snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            })) as CreditBalance[];
            setRecords(docs);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function deleteRecord(id: string) {
        if (!window.confirm("Delete this record?")) return;
        try {
            await deleteDoc(doc(db, "credit_balances", id));
            setRecords((prev) => prev.filter((r) => r.id !== id));
        } catch (err) {
            console.error(err);
            alert("Failed to delete.");
        }
    }

    async function deleteInvoice(invoiceNumber: string) {
        const docs = records.filter((r) => r.invoiceNumber === invoiceNumber);
        if (!window.confirm(`Delete ${docs.length} record(s) for ${invoiceNumber}?`))
            return;
        try {
            await Promise.all(
                docs.map((r) => deleteDoc(doc(db, "credit_balances", r.id)))
            );
            setRecords((prev) =>
                prev.filter((r) => r.invoiceNumber !== invoiceNumber)
            );
        } catch (err) {
            console.error(err);
            alert("Delete failed.");
        }
    }

    async function updateRecord(id: string, values: { creditAmount?: number; remainingAmount?: number }) {
        try {
            await updateDoc(doc(db, "credit_balances", id), values);
            setRecords((prev) =>
                prev.map((r) =>
                    r.id === id ? { ...r, ...values } : r
                )
            );
        } catch (err) {
            console.error(err);
            alert("Failed to update.");
        }
    }

    function startEdit(record: CreditBalance) {
        setEditingId(record.id);
        setEditValues({
            creditAmount: String(record.creditAmount ?? 0),
            remainingAmount: String(record.remainingAmount ?? 0),
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditValues({ creditAmount: "", remainingAmount: "" });
    }

    async function saveEdit(id: string) {
        const credit = parseFloat(editValues.creditAmount);
        const remaining = parseFloat(editValues.remainingAmount);
        if (isNaN(credit) || isNaN(remaining)) {
            alert("Please enter valid numbers.");
            return;
        }
        await updateRecord(id, {
            creditAmount: credit,
            remainingAmount: remaining,
        });
        setEditingId(null);
    }

    const grouped = useMemo(() => {
        const map: Record<string, CreditBalance[]> = {};
        records.forEach((record) => {
            const key = record.invoiceNumber || "Unknown";
            if (!map[key]) map[key] = [];
            map[key].push(record);
        });
        return map;
    }, [records]);

    function formatDate(date: any) {
        if (!date) return "-";
        try {
            if (date.toDate) {
                return date.toDate().toLocaleString();
            }
            return new Date(date).toLocaleString();
        } catch {
            return "-";
        }
    }

    if (loading) {
        return <div className="p-8 text-lg">Loading...</div>;
    }

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Credit Balance Debug</h1>
                    <p className="text-gray-600 mt-2">
                        Total Records : <b>{records.length}</b>
                    </p>
                    <p className="text-gray-600">
                        Total Invoices : <b>{Object.keys(grouped).length}</b>
                    </p>
                </div>
                <button
                    onClick={loadCredits}
                    className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
                >
                    Refresh
                </button>
            </div>

            <div className="space-y-5">
                {Object.entries(grouped).map(([invoiceNumber, docs]) => {
                    const first = docs[0];
                    const isEditing = editingId === first.id;

                    return (
                        <div
                            key={invoiceNumber}
                            className="border rounded-xl bg-white shadow p-5"
                        >
                            <div className="flex justify-between">
                                <div className="space-y-2">
                                    <h2 className="text-xl font-bold">
                                        {invoiceNumber}
                                    </h2>
                                    <p>
                                        <b>Customer :</b> {first.customerName}
                                    </p>

                                    {isEditing ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <b>Credit :</b> ₹
                                                <input
                                                    type="number"
                                                    value={editValues.creditAmount}
                                                    onChange={(e) =>
                                                        setEditValues((prev) => ({
                                                            ...prev,
                                                            creditAmount: e.target.value,
                                                        }))
                                                    }
                                                    className="border rounded px-2 py-1 w-32"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <b>Remaining :</b> ₹
                                                <input
                                                    type="number"
                                                    value={editValues.remainingAmount}
                                                    onChange={(e) =>
                                                        setEditValues((prev) => ({
                                                            ...prev,
                                                            remainingAmount: e.target.value,
                                                        }))
                                                    }
                                                    className="border rounded px-2 py-1 w-32"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p>
                                                <b>Credit :</b> ₹{first.creditAmount ?? 0}
                                            </p>
                                            <p>
                                                <b>Remaining :</b> ₹{first.remainingAmount ?? 0}
                                            </p>
                                        </>
                                    )}

                                    <p>
                                        <b>Status :</b> {first.status}
                                    </p>
                                    <p>
                                        <b>Created :</b> {formatDate(first.createdAt)}
                                    </p>
                                    <p>
                                        <b>Settled :</b> {formatDate(first.settledAt)}
                                    </p>
                                    <p>
                                        <b>Records :</b> {docs.length}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={() => saveEdit(first.id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => startEdit(first)}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                                        >
                                            Edit
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteInvoice(invoiceNumber)}
                                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                    >
                                        Delete Invoice
                                    </button>
                                </div>
                            </div>

                            {docs.length > 1 && (
                                <div className="mt-6">
                                    <h3 className="font-semibold mb-3 text-red-600">
                                        Duplicate Records
                                    </h3>
                                    <table className="w-full border text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="border p-2">Document ID</th>
                                                <th className="border p-2">Credit</th>
                                                <th className="border p-2">Remaining</th>
                                                <th className="border p-2">Status</th>
                                                <th className="border p-2">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {docs.map((docItem) => {
                                                const editingDup = editingId === docItem.id;
                                                return (
                                                    <tr key={docItem.id}>
                                                        <td className="border p-2">{docItem.id}</td>
                                                        <td className="border p-2">
                                                            {editingDup ? (
                                                                <input
                                                                    type="number"
                                                                    value={editValues.creditAmount}
                                                                    onChange={(e) =>
                                                                        setEditValues((prev) => ({
                                                                            ...prev,
                                                                            creditAmount: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="border rounded px-1 py-0.5 w-24"
                                                                />
                                                            ) : (
                                                                <>₹{docItem.creditAmount}</>
                                                            )}
                                                        </td>
                                                        <td className="border p-2">
                                                            {editingDup ? (
                                                                <input
                                                                    type="number"
                                                                    value={editValues.remainingAmount}
                                                                    onChange={(e) =>
                                                                        setEditValues((prev) => ({
                                                                            ...prev,
                                                                            remainingAmount: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="border rounded px-1 py-0.5 w-24"
                                                                />
                                                            ) : (
                                                                <>₹{docItem.remainingAmount}</>
                                                            )}
                                                        </td>
                                                        <td className="border p-2">{docItem.status}</td>
                                                        <td className="border p-2">
                                                            {editingDup ? (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => saveEdit(docItem.id)}
                                                                        className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                                                    >
                                                                        Save
                                                                    </button>
                                                                    <button
                                                                        onClick={cancelEdit}
                                                                        className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-1">
                                                                    <button
                                                                        onClick={() => startEdit(docItem)}
                                                                        className="bg-indigo-500 text-white px-2 py-1 rounded text-xs hover:bg-indigo-600"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => deleteRecord(docItem.id)}
                                                                        className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            )}
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
                })}
            </div>
        </div>
    );
}