"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as customerService from "@/services/customers";

interface AddCustomerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCustomerModal({ onClose, onSuccess }: AddCustomerModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerType, setCustomerType] = useState<"regular" | "membership">("regular");
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError("Please fill out all fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await customerService.create({
        name: name.trim(),
        phone: phone.trim(),
        customerType,
      });
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
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
              className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-800 transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
