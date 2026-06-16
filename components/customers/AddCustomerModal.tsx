"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as customerService from "@/services/customers";
import * as invoicesService from "@/services/invoices";

interface AddCustomerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCustomerModal({ onClose, onSuccess }: AddCustomerModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"regular" | "membership">("regular");
  const [membershipAmount, setMembershipAmount] = useState("");
  const [membershipDuration, setMembershipDuration] = useState("");
  const [membershipStart, setMembershipStart] = useState(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "Cash" | "Card">("UPI");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const calculateMembershipEnd = (start: string, months: number): string => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    if (customerType === "membership" && (!membershipAmount || !membershipDuration)) {
      setError("Please fill out all membership fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const customerId = await customerService.create({
        name: name.trim(),
        phone: phone.trim(),
        customerType,
        ...(customerType === "membership" ? {
          membershipAmount: parseFloat(membershipAmount),
          membershipDuration: parseInt(membershipDuration),
          membershipStart: new Date(membershipStart).toISOString(),
          membershipEnd: calculateMembershipEnd(membershipStart, parseInt(membershipDuration)),
        } : {})
      });

      if (customerType === "membership") {
        await invoicesService.createMembershipInvoice({
          customerId,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          membershipAmount: parseFloat(membershipAmount),
          paymentMethod,
          dateString: membershipStart,
        });
      }

      onSuccess();
    } catch (err) {
      console.error("Failed to add customer:", err);
      setError("Failed to create customer profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl text-stone-900 my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-black cursor-pointer"
          title="Close Modal (ESC)"
        >
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold text-stone-900 mb-4">Add Customer</h2>
        
        {error && (
          <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Name</span>
              <input
                required
                autoFocus
                type="text"
                placeholder="Customer's full name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Phone Number</span>
              <input
                required
                type="text"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-stone-700">Customer Type</span>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as "regular" | "membership")}
              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
            >
              <option value="regular">Regular</option>
              <option value="membership">Membership</option>
            </select>
          </label>

          {customerType === "membership" && (
            <div className="space-y-4 border-l-2 border-stone-200 pl-3 mt-3 animate-in slide-in-from-left-2 duration-200">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Membership Amount (₹)</span>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 5000"
                    value={membershipAmount}
                    onChange={(e) => setMembershipAmount(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-stone-700">Duration (months)</span>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 3"
                    value={membershipDuration}
                    onChange={(e) => setMembershipDuration(e.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Start Date</span>
                <input
                  required
                  type="date"
                  value={membershipStart}
                  onChange={(e) => setMembershipStart(e.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-stone-700">Payment Method</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "UPI" | "Cash" | "Card")}
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </label>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-850 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
