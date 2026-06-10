"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/services/settings";
import type { Settings } from "@/types/settings";
import { Save, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    salonName: "",
    businessType: "",
    address: "",
    gstNumber: "",
    phoneNumber: "",
    logoUrl: "",
    whatsAppNumber: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (error) {
        console.error("Failed to load settings:", error);
        setMessage({ type: "error", text: "Failed to load salon settings." });
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateSettings(settings);
      setMessage({ type: "success", text: "Configuration saved successfully!" });
    } catch (error) {
      console.error("Failed to save settings:", error);
      setMessage({ type: "error", text: "Failed to save configuration." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl text-stone-900">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-stone-500">
            System
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
            System Settings
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-md sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-stone-100 pb-4 text-stone-900">
            <Sparkles size={20} />
            <h2 className="text-lg font-bold text-stone-900 font-sans">Business Settings</h2>
          </div>

          {message && (
            <div
              className={`mb-5 rounded-2xl border p-4 text-sm font-semibold ${
                message.type === "success"
                  ? "border-emerald-250 bg-emerald-55 text-emerald-800"
                  : "border-red-250 bg-red-55 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Salon Name</span>
              <input
                required
                type="text"
                name="salonName"
                value={settings.salonName}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. Explore Salon"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Business Type</span>
              <input
                required
                type="text"
                name="businessType"
                value={settings.businessType}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. Salon"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Phone Number</span>
              <input
                type="text"
                name="phoneNumber"
                value={settings.phoneNumber || ""}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. +91 98765 43210"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">WhatsApp Number</span>
              <input
                type="text"
                name="whatsAppNumber"
                value={settings.whatsAppNumber || ""}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. +91 98765 43210"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">GST Registration Number</span>
              <input
                type="text"
                name="gstNumber"
                value={settings.gstNumber || ""}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. 27AAAAA1111A1Z1"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-stone-700">Logo URL</span>
              <input
                type="url"
                name="logoUrl"
                value={settings.logoUrl || ""}
                onChange={handleChange}
                className="mt-2 h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="e.g. https://example.com/logo.png"
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold text-stone-700">Address</span>
              <textarea
                name="address"
                value={settings.address || ""}
                onChange={handleChange}
                className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none focus:border-black"
                placeholder="Salon physical address..."
              />
            </label>
          </div>

          <div className="mt-6 border-t border-stone-150 pt-4 flex justify-end">
            <button
              disabled={saving}
              type="submit"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-black px-6 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-stone-850 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? "Saving Changes..." : "Save Settings"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}
