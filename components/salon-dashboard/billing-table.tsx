"use client";

import { Plus, Trash2, X, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { ServiceRow } from "./types";
import { formatCurrency } from "./types";
import { ClearableNumberInput } from "../ui/ClearableNumberInput";

interface BillingTableProps {
  rows: ServiceRow[];
  onRowsChange: (rows: ServiceRow[]) => void;
  serviceOptions?: { name: string; price: number; category?: string }[];
  staffOptions?: string[];
  disabled?: boolean;
  serviceProductOptions?: { id: string; name: string; noOfServings: number }[];
}

export function BillingTable({
  rows,
  onRowsChange,
  serviceOptions = [],
  staffOptions = [],
  disabled = false,
  serviceProductOptions = [],
}: BillingTableProps) {
  const [showModal, setShowModal] = useState(false);
  const [selectedCat, setSelectedCat] = useState("All");
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Redesign flow states
  const [selectedServices, setSelectedServices] = useState<{ name: string; price: number; category?: string }[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [assignedProducts, setAssignedProducts] = useState<({ id: string; name: string; noOfServings: number } | null)[]>([]);

  // Staff Assignment redesign states
  const [showStaffDialog, setShowStaffDialog] = useState(false);
  const [assignedStaff, setAssignedStaff] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset search when modal opens or closes
  useEffect(() => {
    if (!showModal) {
      setSearchQuery("");
      setSelectedCat("All");
    }
  }, [showModal]);

  const updateRow = (id: number, patch: Partial<ServiceRow>) => {
    onRowsChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const handleSelectService = (svc: { name: string; price: number; category?: string }) => {
    setSelectedServices((prev) => [...prev, svc]);
  };

  const handleRemoveServiceByIndex = (indexToRemove: number) => {
    setSelectedServices((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearAll = () => {
    setSelectedServices([]);
  };

  const handleCancelSelection = () => {
    setSelectedServices([]);
    setShowModal(false);
  };

  const handleDoneSelection = () => {
    if (selectedServices.length === 0) {
      setShowModal(false);
      return;
    }
    setAssignedProducts(new Array(selectedServices.length).fill(null));
    setAssignedStaff(new Array(selectedServices.length).fill(""));
    setShowModal(false);
    setShowStaffDialog(true);
  };

  const handleSelectProduct = (index: number, product: { id: string; name: string; noOfServings: number } | null) => {
    setAssignedProducts((prev) => {
      const next = [...prev];
      next[index] = product;
      return next;
    });
  };

  const handleProductBack = () => {
    setShowProductDialog(false);
    setShowStaffDialog(true);
  };

  const handleSelectStaff = (index: number, staffName: string) => {
    setAssignedStaff((prev) => {
      const next = [...prev];
      next[index] = staffName;
      return next;
    });
  };

  const handleStaffBack = () => {
    setShowStaffDialog(false);
    setShowModal(true);
  };

  const handleStaffContinue = () => {
    setShowStaffDialog(false);
    setShowProductDialog(true);
  };

  const handleProductAndStaffFinish = () => {
    const newRows = selectedServices.map((svc, index) => {
      const assignedProd = assignedProducts[index];
      const assignedStf = assignedStaff[index] || "";
      return {
        id: Math.max(0, ...rows.map((row) => row.id)) + index + 1,
        service: svc.name,
        staff: assignedStf,
        price: svc.price,
        quantity: 1,
        discount: 0,
        usedProductId: assignedProd?.id || undefined,
        usedProductName: assignedProd?.name || undefined,
      };
    });
    onRowsChange([...rows, ...newRows]);

    // Close and reset states
    setShowProductDialog(false);
    setSelectedServices([]);
    setAssignedProducts([]);
    setAssignedStaff([]);
  };

  const handleCancelProductDialog = () => {
    setShowProductDialog(false);
    setSelectedServices([]);
    setAssignedProducts([]);
    setAssignedStaff([]);
  };

  const handleCancelStaffDialog = () => {
    setShowStaffDialog(false);
    setSelectedServices([]);
    setAssignedProducts([]);
    setAssignedStaff([]);
  };

  const categories = ["All", ...Array.from(new Set(serviceOptions.map((s) => s.category || "General")))];

  const filteredServices = serviceOptions.filter((s) => {
    const matchesCategory = selectedCat === "All" || (s.category || "General") === selectedCat;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group services by category and sort categories alphabetically
  const serviceGroups: Record<string, typeof serviceOptions> = {};
  filteredServices.forEach((s) => {
    const cat = s.category || "General";
    if (!serviceGroups[cat]) {
      serviceGroups[cat] = [];
    }
    serviceGroups[cat].push(s);
  });

  const sortedCategories = Object.keys(serviceGroups).sort((a, b) => a.localeCompare(b));

  // Sort services alphabetically within each category group
  sortedCategories.forEach((cat) => {
    serviceGroups[cat].sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#F5F0E8]">Services</h2>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setSelectedServices([]);
            setShowModal(true);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] transition hover:-translate-y-0.5 hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          <Plus size={17} />
          Add Service
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#2E2B24] bg-[#1C1A16]">
        <table className="w-full min-w-[700px] table-fixed border-collapse text-left text-sm text-[#A89F8C]">
          <thead className="bg-[#131210] text-xs uppercase tracking-[0.2em] text-[#6B6358] border-b border-[#2E2B24]">
            <tr>
              <th className="px-2 py-3 font-bold">Service</th>
              <th className="px-2 py-3 font-bold w-[130px]">Staff</th>
              <th className="px-2 py-3 font-bold w-[160px]">Used Product</th>
              <th className="px-2 py-3 font-bold w-[90px]">Price</th>
              <th className="px-2 py-3 font-bold w-[90px]">Discount</th>
              <th className="px-2 py-3 font-bold w-[90px]">Amount</th>
              <th className="px-2 py-3 font-bold w-[50px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2E2B24]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-transparent transition hover:bg-[#1F1A0F]">
                <td className="px-2 py-2 font-bold text-[#F5F0E8] truncate" title={row.service}>
                  {row.service}
                </td>
                <td className="px-2 py-2 w-[130px]">
                  <select
                    value={row.staff}
                    disabled={disabled || row.isCreditSettle}
                    onChange={(event) => updateRow(row.id, { staff: event.target.value })}
                    className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2.5 text-[#F5F0E8] outline-none transition focus:border-[#B8962E] disabled:bg-[#0E0D0B] disabled:text-[#6B6358] text-xs font-semibold cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#131210] text-[#F5F0E8]">Select Staff</option>
                    {staffOptions.length === 0 && !row.isCreditSettle && <option value="">No Options</option>}
                    {(row.isCreditSettle || row.staff === "System") && (
                      <option value="System" className="bg-[#131210] text-[#F5F0E8]">
                        System
                      </option>
                    )}
                    {row.isCreditSettle && row.staff && row.staff !== "System" && !staffOptions.includes(row.staff) && (
                      <option value={row.staff} className="bg-[#131210] text-[#F5F0E8]">
                        {row.staff}
                      </option>
                    )}
                    {staffOptions.map((option) => (
                      <option key={option} value={option} className="bg-[#131210] text-[#F5F0E8]">
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 w-[160px]">
                  <select
                    value={row.usedProductId || ""}
                    disabled={disabled || row.isCreditSettle}
                    onChange={(event) => {
                      const val = event.target.value;
                      const matched = serviceProductOptions.find((p) => p.id === val);
                      updateRow(row.id, {
                        usedProductId: val || undefined,
                        usedProductName: matched?.name || undefined,
                      });
                    }}
                    className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2.5 text-[#F5F0E8] outline-none transition focus:border-[#B8962E] disabled:bg-[#0E0D0B] disabled:text-[#6B6358] text-xs font-semibold cursor-pointer appearance-none"
                  >
                    <option value="" className="bg-[#131210] text-[#F5F0E8]">No Product</option>
                    {serviceProductOptions.map((option) => (
                      <option key={option.id} value={option.id} disabled={option.noOfServings <= 0} className="bg-[#131210] text-[#F5F0E8]">
                        {option.name} ({option.noOfServings} left)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 w-[90px]">
                  <div className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2 flex items-center transition focus-within:border-[#B8962E] disabled:bg-[#0E0D0B]">
                    <ClearableNumberInput
                      min="0"
                      disabled={disabled || row.isCreditSettle}
                      value={row.price}
                      onChange={(val) => updateRow(row.id, { price: val })}
                      className="text-[#F5F0E8] text-xs font-semibold disabled:text-[#6B6358]"
                    />
                  </div>
                </td>
                <td className="px-2 py-2 w-[90px]">
                  <div className="h-10 w-full rounded-xl border border-[#2E2B24] bg-[#131210] px-2 flex items-center transition focus-within:border-[#B8962E] disabled:bg-[#0E0D0B]">
                    <ClearableNumberInput
                      min="0"
                      disabled={disabled || row.isCreditSettle}
                      value={row.discount}
                      onChange={(val) => updateRow(row.id, { discount: val })}
                      className="text-[#F5F0E8] text-xs font-semibold disabled:text-[#6B6358]"
                    />
                  </div>
                </td>
                <td className="px-2 py-2 font-bold text-[#F5F0E8] text-xs w-[90px]">
                  {formatCurrency(Math.max((Number(row.price) || 0) - (Number(row.discount) || 0), 0))}
                </td>
                <td className="px-2 py-2 text-right w-[50px]">
                  <button
                    aria-label="Delete row"
                    type="button"
                    disabled={disabled}
                    onClick={() => onRowsChange(rows.filter((item) => item.id !== row.id))}
                    className="grid size-9 place-items-center rounded-xl border border-[#5C2424] text-[#E57373] bg-[#2E1616] transition hover:bg-[#471C1C] disabled:opacity-50 disabled:pointer-events-none mx-auto cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Select Service Modal Overlay */}
      {showModal && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCancelSelection} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8] flex flex-col max-h-[85vh]">
            <button
              onClick={handleCancelSelection}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-bold text-[#F5F0E8] mb-4">Select Service Menu</h2>

            {/* Search Input */}
            <div className="mb-4 flex items-center rounded-xl border border-[#2E2B24] bg-[#131210] px-3 h-11 shadow-sm focus-within:border-[#B8962E] transition">
              <input
                type="text"
                placeholder="Search services by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-[#F5F0E8] outline-none placeholder:text-[#6B6358]"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
                    selectedCat === cat
                      ? "bg-[#B8962E] text-[#0E0D0B] border-[#B8962E]"
                      : "bg-[#131210] border-[#2E2B24] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Service Cards Grouped Grid */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-6">
              {sortedCategories.length === 0 ? (
                <p className="text-sm text-[#6B6358] italic text-center py-8">No services found matching the criteria.</p>
              ) : (
                sortedCategories.map((catName) => (
                  <div key={catName} className="space-y-3">
                    {/* Visual Category Header/Divider */}
                    <div className="flex items-center gap-3">
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#B8962E]">
                        {catName}
                      </h4>
                      <div className="h-px flex-1 bg-[#2E2B24]" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                      {serviceGroups[catName].map((svc) => {
                        const selectionCount = selectedServices.filter((s) => s.name === svc.name).length;
                        const isSelected = selectionCount > 0;
                        return (
                          <div
                            key={svc.name}
                            onClick={() => handleSelectService(svc)}
                            className={`relative cursor-pointer rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 ${
                              isSelected
                                ? "border-[#B8962E] bg-[#1F1A0F] shadow-[0_4px_16px_rgba(184,150,46,0.18)]"
                                : "border-[#2E2B24] bg-[#131210] hover:border-[#B8962E] hover:shadow-[0_4px_16px_rgba(184,150,46,0.12)]"
                            }`}
                          >
                            <h3 className="text-sm font-bold text-[#F5F0E8] pr-10 truncate" title={svc.name}>
                              {svc.name}
                            </h3>
                            <p className="mt-1 text-sm font-bold text-[#B8962E]">
                              {formatCurrency(svc.price)}
                            </p>
                            {isSelected && (
                              <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-[#B8962E] text-[#0E0D0B] text-[10px] font-black rounded-full px-2 py-0.5 shadow-md">
                                <Check size={10} strokeWidth={4} />
                                <span>{selectionCount}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Selected Counter & Chips */}
            {selectedServices.length > 0 && (
              <div className="mt-4 border-t border-[#2E2B24] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#B8962E]">
                    Selected Services ({selectedServices.length}):
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                  {selectedServices.map((svc, index) => (
                    <span
                      key={`${svc.name}-${index}`}
                      onClick={() => handleRemoveServiceByIndex(index)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#2A2310] border border-[#4A3A10] px-2.5 py-1 text-xs font-semibold text-[#D4A935] hover:bg-[#3E3318] cursor-pointer transition"
                    >
                      {svc.name}
                      <X size={12} className="text-[#B8962E] hover:text-[#D4A935]" />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Controls */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#2E2B24] pt-4">
              <button
                type="button"
                onClick={handleCancelSelection}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {selectedServices.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-red-950 bg-red-950/20 px-4 text-sm font-semibold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDoneSelection}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-[#B8962E] px-5 text-sm font-extrabold tracking-wide uppercase text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.3)] transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Guided Staff Assignment dialog */}
      {showStaffDialog && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCancelStaffDialog} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8] flex flex-col max-h-[85vh]">
            <button
              onClick={handleCancelStaffDialog}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B8962E]">
                Staff Assignment
              </span>
              <h2 className="text-lg font-bold text-[#F5F0E8] mt-1">
                Assign staff to all selected services
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 py-2 divide-y divide-[#2E2B24]">
              {selectedServices.map((svc, serviceIndex) => (
                <div key={serviceIndex} className={serviceIndex > 0 ? "pt-6" : ""}>
                  <div className="flex flex-col">
                    <p className="text-base font-extrabold text-[#F5F0E8]">
                      {svc.name}
                    </p>
                    <p className="text-xs font-semibold text-[#B8962E] mt-0.5">
                      Base Price: {formatCurrency(svc.price)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold text-[#6B6358] uppercase tracking-wider mb-2">Select Staff</p>
                    {staffOptions.length === 0 ? (
                      <p className="text-sm text-[#6B6358] italic py-2">No active staff members on duty.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {staffOptions.map((staffName) => {
                          const isSelected = assignedStaff[serviceIndex] === staffName;
                          return (
                            <div
                              key={staffName}
                              onClick={() => handleSelectStaff(serviceIndex, staffName)}
                              className={`flex items-center gap-2 cursor-pointer border px-4 py-2.5 rounded-xl transition select-none ${
                                isSelected
                                  ? "border-[#B8962E] bg-[#1F1A0F] text-[#B8962E]"
                                  : "border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#F5F0E8]"
                              }`}
                            >
                              <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected ? "border-[#B8962E]" : "border-[#6B6358]"
                              }`}>
                                {isSelected && (
                                  <div className="size-2 rounded-full bg-[#B8962E]" />
                                )}
                              </div>
                              <span className="text-sm font-semibold">{staffName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#2E2B24] pt-4">
              <button
                type="button"
                onClick={handleStaffBack}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                disabled={assignedStaff.some(s => !s) || assignedStaff.length !== selectedServices.length}
                onClick={handleStaffContinue}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#B8962E] px-5 text-sm font-extrabold tracking-wide uppercase text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.3)] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
              >
                Continue
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Guided Used Products dialog */}
      {showProductDialog && mounted && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={handleCancelProductDialog} />
          <div className="relative w-full max-w-2xl rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-6 shadow-2xl text-[#F5F0E8] flex flex-col max-h-[85vh]">
            <button
              onClick={handleCancelProductDialog}
              className="absolute top-4 right-4 text-[#A89F8C] hover:text-[#B8962E] transition"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#B8962E]">
                USED PRODUCT ASSIGNMENT
              </span>
              <h2 className="text-lg font-bold text-[#F5F0E8] mt-1">
                Assign used products
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-1 py-2 divide-y divide-[#2E2B24]">
              {selectedServices.map((svc, serviceIndex) => (
                <div key={serviceIndex} className={serviceIndex > 0 ? "pt-6" : ""}>
                  <div className="flex flex-col">
                    <p className="text-base font-extrabold text-[#F5F0E8]">
                      {svc.name}
                    </p>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-semibold text-[#6B6358] uppercase tracking-wider mb-2">Select Product</p>
                    <div className="flex flex-wrap gap-2.5">
                      {/* Option for No Product */}
                      <div
                        onClick={() => handleSelectProduct(serviceIndex, null)}
                        className={`flex items-center gap-2 cursor-pointer border px-4 py-2.5 rounded-xl transition select-none ${
                          assignedProducts[serviceIndex] === null
                            ? "border-[#B8962E] bg-[#1F1A0F] text-[#B8962E]"
                            : "border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#F5F0E8]"
                        }`}
                      >
                        <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          assignedProducts[serviceIndex] === null ? "border-[#B8962E]" : "border-[#6B6358]"
                        }`}>
                          {assignedProducts[serviceIndex] === null && (
                            <div className="size-2 rounded-full bg-[#B8962E]" />
                          )}
                        </div>
                        <span className="text-sm font-semibold">No Product</span>
                      </div>

                      {/* Options from serviceProductOptions */}
                      {serviceProductOptions.map((option) => {
                        const isSelected = assignedProducts[serviceIndex]?.id === option.id;
                        const isOutOfStock = option.noOfServings <= 0;

                        return (
                          <div
                            key={option.id}
                            onClick={() => !isOutOfStock && handleSelectProduct(serviceIndex, option)}
                            className={`flex items-center gap-2 border px-4 py-2.5 rounded-xl transition select-none ${
                              isOutOfStock
                                ? "opacity-40 cursor-not-allowed border-[#2E2B24] bg-[#0E0D0B] text-[#6B6358]"
                                : "cursor-pointer hover:border-[#B8962E] hover:text-[#F5F0E8]"
                            } ${
                              isSelected
                                ? "border-[#B8962E] bg-[#1F1A0F] text-[#B8962E]"
                                : isOutOfStock
                                  ? ""
                                  : "border-[#2E2B24] bg-[#131210] text-[#A89F8C]"
                            }`}
                          >
                            <div className={`size-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? "border-[#B8962E]" : "border-[#6B6358]"
                            }`}>
                              {isSelected && (
                                <div className="size-2 rounded-full bg-[#B8962E]" />
                              )}
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-sm font-semibold leading-tight">{option.name}</span>
                              <span className="text-[10px] text-[#6B6358] font-medium leading-none mt-0.5">
                                {isOutOfStock ? "Out of Stock" : `${option.noOfServings} left`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#2E2B24] pt-4">
              <button
                type="button"
                onClick={handleProductBack}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2E2B24] bg-[#131210] px-4 text-sm font-semibold text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F] transition cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handleProductAndStaffFinish}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-extrabold tracking-wide uppercase text-white hover:bg-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition cursor-pointer"
              >
                Finish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}