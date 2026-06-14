"use client";

import { useEffect, useMemo, useState } from "react";
import * as expensesService from "@/services/expenses";
import type { Expense } from "@/types/expense";
import { Plus, Search, Edit2, Trash2, X, Receipt } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const [typeFilter, setTypeFilter] = useState<"all" | "daily" | "monthly">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    category: "Rent",
    type: "monthly" as "daily" | "monthly",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const data = await expensesService.getAll();
      setExpenses(data);
    } catch (error) {
      console.error("Failed to load expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("add") === "true") {
        handleOpenAdd();
        const cleanUrl = window.location.pathname;
        window.history.replaceState({ path: cleanUrl }, "", cleanUrl);
      }
    }
  }, []);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      category: "Rent",
      type: "monthly",
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    setFormData({
      description: e.description,
      amount: e.amount,
      date: e.date,
      category: e.category || "Rent",
      type: e.type || "monthly",
    });
    setModalOpen(true);
  };

  const handleDeleteTrigger = (id: string) => {
    setIdToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!idToDelete) return;
    try {
      await expensesService.delete(idToDelete);
      setDeleteConfirmOpen(false);
      setIdToDelete(null);
      loadExpenses();
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingExpense?.id) {
        await expensesService.update(editingExpense.id, formData);
      } else {
        await expensesService.create(formData);
      }
      setModalOpen(false);
      loadExpenses();
    } catch (error) {
      console.error("Failed to save expense:", error);
    }
  };

  // ── Summary card calculations ─────────────────────────────────────────────
  const summary = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let todayDaily = 0;
    let monthFixed = 0;

    expenses.forEach((exp) => {
      if (exp.type === "daily" && exp.date === todayStr) {
        todayDaily += exp.amount;
      }
      if (exp.type === "monthly") {
        const d = new Date(exp.date);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          monthFixed += exp.amount;
        }
      }
    });

    return { todayDaily, monthFixed, total: todayDaily + monthFixed };
  }, [expenses]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch =
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === "all" || e.type === typeFilter;

      const matchesFrom = !dateFrom || e.date >= dateFrom;
      const matchesTo = !dateTo || e.date <= dateTo;

      return matchesSearch && matchesType && matchesFrom && matchesTo;
    });
  }, [expenses, searchQuery, typeFilter, dateFrom, dateTo]);

  return (
    <div className="w-full text-stone-900">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            Finance
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            Expenses Tracker
          </h1>
        </div>
        {!loading && expenses.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-800"
          >
            <Plus size={18} />
            Log Expense
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-stone-100 text-stone-900 mb-4">
            <Receipt size={32} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">No Expenses Found</h2>
          <p className="mt-2 max-w-sm text-sm text-stone-500">
            Log utility bills, stylist wages, and salon rent to calculate monthly net profits accurately.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-800"
          >
            <Plus size={18} />
            Log Expense
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary cards ──────────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Today's Daily Expenses
              </p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                -{formatCurrency(summary.todayDaily)}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Tiffin, fuel, misc logged today
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                This Month's Fixed Costs
              </p>
              <p className="mt-2 text-2xl font-bold text-red-600">
                -{formatCurrency(summary.monthFixed)}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Rent, electricity, salaries
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-900 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Total Expenses
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                -{formatCurrency(summary.total)}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Today's daily + month's fixed
              </p>
            </div>
          </div>

          {/* ── Filters row ────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex flex-1 min-w-[220px] max-w-xs items-center rounded-2xl border border-stone-200 bg-white px-4 h-11 shadow-sm focus-within:border-black">
              <Search size={16} className="text-stone-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
              />
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "daily" | "monthly")}
              className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-800 shadow-sm outline-none focus:border-black"
            >
              <option value="all">All types</option>
              <option value="daily">Daily only</option>
              <option value="monthly">Monthly only</option>
            </select>

            {/* Date range */}
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-800 shadow-sm outline-none focus:border-black"
            />
            <span className="text-xs text-stone-400 font-medium">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-800 shadow-sm outline-none focus:border-black"
            />

            {/* Clear filters */}
            {(typeFilter !== "all" || dateFrom || dateTo) && (
              <button
                onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-600 shadow-sm hover:bg-stone-50 transition"
              >
                Clear
              </button>
            )}
          </div>

          {/* ── Table ──────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-md">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm text-stone-600">
              <thead className="bg-stone-50 text-xs uppercase tracking-[0.2em] text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="px-6 py-4 font-bold">Description</th>
                  <th className="px-6 py-4 font-bold">Type</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-stone-400 italic">
                      No expenses match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-stone-50 transition bg-white text-stone-900"
                    >
                      <td className="px-6 py-4 font-semibold text-stone-900">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${expense.type === "daily"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                        >
                          {expense.type === "daily" ? "Daily" : "Monthly"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded-full bg-stone-50 border border-stone-200 px-3 py-1 text-xs text-stone-700">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">{expense.date}</td>
                      <td className="px-6 py-4 font-bold text-red-600">
                        -{formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(expense)}
                            className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-black hover:border-black transition"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => expense.id && handleDeleteTrigger(expense.id)}
                            className="grid size-10 place-items-center rounded-xl border border-stone-200 text-stone-400 hover:text-red-600 hover:border-red-500 hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl text-stone-900">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-black"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-stone-900 mb-4">
              {editingExpense ? "Edit Expense Log" : "Log Business Expense"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Expense Description
                </span>
                <input
                  required
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                  placeholder="e.g. Electricity bill (May 2026)"
                />
              </label>

              {/* Type selector */}
              <label className="block">
                <span className="text-sm font-semibold text-stone-700">
                  Expense Type
                </span>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      type: e.target.value as "daily" | "monthly",
                    })
                  }
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
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
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
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
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
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: Number(e.target.value) })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-black"
                />
              </label>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-black px-6 text-sm font-semibold text-white hover:bg-stone-800 transition"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl text-stone-900 z-10">
            <h3 className="text-lg font-bold text-stone-900">
              Are you sure you want to delete this record?
            </h3>
            <p className="mt-2 text-sm text-stone-500">
              This action cannot be undone and will remove the record immediately.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-10 rounded-xl border border-stone-200 px-4 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="h-10 rounded-xl bg-red-600 hover:bg-red-700 px-4 text-xs font-semibold text-white shadow-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}