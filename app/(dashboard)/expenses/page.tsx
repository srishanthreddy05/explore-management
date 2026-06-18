"use client";

import { useEffect, useMemo, useState } from "react";
import * as expensesService from "@/services/expenses";
import type { Expense } from "@/types/expense";
import { Plus, Search, Edit2, Trash2, X, Receipt, Calendar } from "lucide-react";
import { formatCurrency } from "@/components/salon-dashboard/types";
import { toLocalDateString } from "@/lib/utils/date";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Date range filters
  const now = new Date();
  const firstDayStr = toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  const todayStr = toLocalDateString(now);

  const [typeFilter, setTypeFilter] = useState<"all" | "daily" | "monthly">("all");
  const [dateFrom, setDateFrom] = useState(firstDayStr);
  const [dateTo, setDateTo] = useState(todayStr);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    date: toLocalDateString(new Date()),
    category: "Rent",
    type: "monthly" as "daily" | "monthly",
  });

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [idToDelete, setIdToDelete] = useState<string | null>(null);

  const loadExpenses = async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      const data = await expensesService.getByDateRange(start, end);
      setExpenses(data);
    } catch (error) {
      console.error("Failed to load expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [dateFrom, dateTo]);

  useEffect(() => {
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
      date: toLocalDateString(new Date()),
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
    const todayStr = toLocalDateString(new Date());
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
    <div className="w-full text-[#A89F8C]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
            Finance
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#F5F0E8]">
            Expenses Tracker
          </h1>
        </div>
        {!loading && expenses.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Log Expense
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center">
          <div className="size-10 animate-spin rounded-full border-4 border-[#B8962E] border-t-transparent" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#2E2B24] bg-[#131210] p-12 text-center shadow-md">
          <div className="grid size-16 place-items-center rounded-2xl bg-[#0E0D0B] text-[#B8962E] border border-[#2E2B24] mb-4">
            <Receipt size={32} />
          </div>
          <h2 className="text-xl font-bold text-[#F5F0E8]">No Expenses Found</h2>
          <p className="mt-2 max-w-sm text-sm text-[#A89F8C]">
            Log utility bills, stylist wages, and salon rent to calculate monthly net profits accurately.
          </p>
          <button
            onClick={handleOpenAdd}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border border-[#2E2B24] bg-[#131210] px-6 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition duration-150 cursor-pointer"
          >
            <Plus size={18} />
            Log Expense
          </button>
        </div>
      ) : (
        <>
          {/* ── Summary cards ──────────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
                Today's Daily Expenses
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#E57373]">
                {formatCurrency(summary.todayDaily)}
              </p>
              <p className="mt-1 text-xs text-[#6B6358]">
                Tiffin, fuel, misc logged today
              </p>
            </div>
            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
                This Month's Fixed Costs
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#E57373]">
                {formatCurrency(summary.monthFixed)}
              </p>
              <p className="mt-1 text-xs text-[#6B6358]">
                Rent, electricity, salaries
              </p>
            </div>
            <div className="rounded-2xl border border-[#2E2B24] bg-[#131210] p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C]">
                Total Expenses
              </p>
              <p className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[#F5F0E8]">
                {formatCurrency(summary.total)}
              </p>
              <p className="mt-1 text-xs text-[#6B6358]">
                Today's daily + month's fixed
              </p>
            </div>
          </div>

          {/* ── Filters row ────────────────────────────────────────────── */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex flex-1 min-w-[220px] max-w-xs items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 h-11 shadow-sm focus-within:border-[#B8962E] transition">
              <Search size={16} className="text-[#6B6358] mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
              />
            </div>

            {/* Type filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "all" | "daily" | "monthly")}
              className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] shadow-sm outline-none focus:border-[#B8962E] transition"
            >
              <option value="all">All types</option>
              <option value="daily">Daily only</option>
              <option value="monthly">Monthly only</option>
            </select>

            {/* Date Selector */}
            <div className="flex items-center gap-2 flex-wrap bg-[#131210] p-2 rounded-xl border border-[#2E2B24] shadow-sm">
              <Calendar size={16} className="text-[#6B6358] ml-1" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
              />
              <span className="text-xs text-[#A89F8C] font-semibold px-1">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 rounded-lg border border-[#2E2B24] bg-[#0E0D0B] px-3 text-sm font-medium text-[#F5F0E8] shadow-sm outline-none focus:border-[#B8962E] transition"
              />
            </div>

            {/* Clear filters */}
            {(typeFilter !== "all" || dateFrom !== firstDayStr || dateTo !== todayStr) && (
              <button
                onClick={() => { setTypeFilter("all"); setDateFrom(firstDayStr); setDateTo(todayStr); }}
                className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] shadow-sm transition cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* ── Table ──────────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#131210] shadow-md">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm text-[#A89F8C]">
              <thead className="bg-[#0E0D0B] text-[10px] font-bold uppercase tracking-[0.18em] text-[#A89F8C] border-b border-[#2E2B24]">
                <tr>
                  <th className="px-6 py-4 font-bold">Description</th>
                  <th className="px-6 py-4 font-bold">Type</th>
                  <th className="px-6 py-4 font-bold">Category</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold">Amount</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2E2B24]">
                {filteredExpenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[#6B6358] italic bg-transparent">
                      No expenses match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-[#1C1A16] transition bg-transparent text-[#A89F8C]"
                    >
                      <td className="px-6 py-4 font-semibold text-[#F5F0E8]">
                        {expense.description}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold border ${
                            expense.type === "daily"
                              ? "bg-[#1F1A0F] text-[#B8962E] border-[#B8962E]/20"
                              : "bg-[#1C1A16] text-[#A89F8C] border-[#2E2B24]"
                          }`}
                        >
                          {expense.type === "daily" ? "Daily" : "Monthly"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded-full bg-[#0E0D0B] border border-[#2E2B24] px-3 py-1 text-xs text-[#A89F8C]">
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">{expense.date}</td>
                      <td className="px-6 py-4 font-bold text-[#E57373]">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(expense)}
                            className="grid size-10 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#B8962E] hover:bg-[#1F1A0F] hover:border-[#B8962E] transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => expense.id && handleDeleteTrigger(expense.id)}
                            className="grid size-10 place-items-center rounded-xl bg-[#131210] border border-[#2E2B24] text-[#E57373] hover:bg-[#131210] hover:border-[#E57373] transition cursor-pointer"
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] animate-in zoom-in-95 duration-200 z-10">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition cursor-pointer"
            >
              <X size={20} />
            </button>
            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">
              {editingExpense ? "Edit Expense Log" : "Log Business Expense"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
                  Expense Description
                </span>
                <input
                  required
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E] placeholder-[#6B6358]"
                  placeholder="e.g. Electricity bill (May 2026)"
                />
              </label>

              {/* Type selector */}
              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">
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
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                >
                  <option value="daily">Daily — tiffin, fuel, misc</option>
                  <option value="monthly">Monthly — rent, electricity, salaries</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#A89F8C]">Category</span>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
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
                  <span className="text-sm font-semibold text-[#A89F8C]">Date</span>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-[#A89F8C]">Amount (INR)</span>
                <input
                  required
                  type="number"
                  min="1"
                  value={formData.amount === 0 ? "" : formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value === "" ? 0 : Number(e.target.value) })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#2E2B24] bg-[#0E0D0B] px-4 text-sm text-[#F5F0E8] outline-none focus:border-[#B8962E] focus:ring-1 focus:ring-[#B8962E]"
                />
              </label>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-11 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-11 rounded-xl bg-[#B8962E] px-6 text-sm font-bold text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.25)] transition disabled:opacity-50 cursor-pointer"
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDeleteConfirmOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#A89F8C] z-10 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-[#F5F0E8]">
              Are you sure you want to delete this record?
            </h3>
            <p className="mt-2 text-sm text-[#A89F8C]">
              This action cannot be undone and will remove the record immediately.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="h-10 rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-xs font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="h-10 rounded-xl bg-[#E57373] hover:bg-[#ef5350] px-4 text-xs font-bold text-[#0E0D0B] shadow-sm transition cursor-pointer"
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