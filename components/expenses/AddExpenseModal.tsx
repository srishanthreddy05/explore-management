"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as expensesService from "@/services/expenses";

interface AddExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddExpenseModal({ onClose, onSuccess }: AddExpenseModalProps) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("Rent");
  const [type, setType] = useState<"daily" | "monthly">("monthly");
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
    if (!description.trim() || amount === "" || amount <= 0) {
      setError("Please enter a description and valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await expensesService.create({
        description: description.trim(),
        amount: Number(amount),
        date,
        category,
        type,
      });
      onSuccess();
    } catch (err) {
      console.error("Failed to add expense:", err);
      setError("Failed to log business expense. Please try again.");
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
        <h2 className="text-xl font-bold text-stone-900 mb-4">Log Business Expense</h2>
        
        {error && (
          <div className="mb-4 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-stone-700">Expense Description</span>
            <input
              required
              autoFocus
              type="text"
              placeholder="e.g. Electricity bill (May 2026)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-stone-700">Expense Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "daily" | "monthly")}
              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
            >
              <option value="daily">Daily — tiffin, fuel, misc</option>
              <option value="monthly">Monthly — rent, electricity, salaries</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
              >
                <option value="Rent">Shop Rent</option>
                <option value="Utilities">Utilities (Power/Water)</option>
                <option value="Salaries">Staff Salaries</option>
                <option value="Inventory">Product Inventory Restock</option>
                <option value="Marketing">Marketing & Flyers</option>
                <option value="Food">Food & Refreshments</option>
                <option value="Transport">Transport & Fuel</option>
                <option value="Other">Other Expenses</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Date</span>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-stone-700">Amount (INR)</span>
            <input
              required
              type="number"
              min="1"
              placeholder="Enter amount..."
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
            />
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
              {saving ? "Logging..." : "Save Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
