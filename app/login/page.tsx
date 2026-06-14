"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, X, Calendar, BarChart2, Users, Star } from "lucide-react";
import { toast } from "react-hot-toast";

export default function LoginPage() {
  const { user, loading, login, resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#F0F0F0]">
        <div className="size-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email and password.");
      return;
    }
    setLoggingIn(true);
    try {
      await login(email.trim(), password);
      toast.success("Successfully logged in!");
      router.replace("/dashboard");
    } catch (err: any) {
      console.error("Login failed:", err);
      let msg = "Failed to sign in. Please check your credentials.";
      if (
        err?.code === "auth/invalid-credential" ||
        err?.code === "auth/wrong-password" ||
        err?.code === "auth/user-not-found"
      ) {
        msg = "Incorrect email or password.";
      } else if (err?.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err?.code === "auth/too-many-requests") {
        msg = "Too many login attempts. Access has been temporarily locked. Please reset your password or try again later.";
      } else if (err?.code === "auth/user-disabled") {
        msg = "This account has been disabled.";
      } else if (err?.message?.includes("network")) {
        msg = "Network error. Please check your internet connection.";
      }
      toast.error(msg);
    } finally {
      setLoggingIn(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setSendingReset(true);
    try {
      await resetPassword(resetEmail.trim());
      toast.success("Password reset email sent. Please check your inbox.");
      setForgotModalOpen(false);
      setResetEmail("");
    } catch (err: any) {
      console.error("Password reset failed:", err);
      let msg = "Failed to send password reset email.";
      if (err?.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      } else if (err?.code === "auth/user-not-found") {
        msg = "No user found with this email address.";
      } else if (err?.message?.includes("network")) {
        msg = "Network error. Please check your internet connection.";
      }
      toast.error(msg);
    } finally {
      setSendingReset(false);
    }
  };

  const features = [
    { icon: Calendar, label: "Smart scheduling" },
    { icon: BarChart2, label: "Revenue insights" },
    { icon: Users, label: "Staff management" },
    { icon: Star, label: "Client profiles" },
  ];

  /* ── Salon SVG icons ── rendered as inline SVG, positioned fixed to viewport, desktop only */
  const iconStyle = (top?: string, bottom?: string, left?: string, right?: string, rotate?: string, opacity?: number): React.CSSProperties => ({
    position: "fixed",
    ...(top && { top }),
    ...(bottom && { bottom }),
    ...(left && { left }),
    ...(right && { right }),
    transform: `rotate(${rotate ?? "0deg"})`,
    opacity: opacity ?? 0.15,
    pointerEvents: "none",
    zIndex: 0,
  });

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#F0F0F0] p-4 font-sans">

      {/* ── Floating salon icons — desktop only ── */}
      <div className="hidden md:block" aria-hidden="true">

        {/* Scissors — top left */}
        <svg style={iconStyle("7%", undefined, "3%", undefined, "-25deg", 0.18)} width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>

        {/* Comb — top right */}
        <svg style={iconStyle("5%", undefined, undefined, "4%", "20deg", 0.15)} width="96" height="96" viewBox="0 0 24 24" fill="#000">
          <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5zm1 5h2v9H4v-9zm3 0h2v7H7v-7zm3 0h2v9h-2v-9zm3 0h2v7h-2v-7zm3 0h2v9h-2v-9z" />
        </svg>

        {/* Trimmer — bottom left */}
        <svg style={iconStyle(undefined, "9%", "3%", undefined, "15deg", 0.15)} width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2" width="10" height="6" rx="1" />
          <rect x="8" y="8" width="8" height="13" rx="1" />
          <line x1="10" y1="11" x2="14" y2="11" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>

        {/* Hair dryer — bottom right */}
        <svg style={iconStyle(undefined, "7%", undefined, "3%", "-20deg", 0.15)} width="110" height="110" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4a5 5 0 0 1 5 5v2l4 4H7a5 5 0 0 1 0-10z" />
          <line x1="16" y1="15" x2="20" y2="19" />
          <circle cx="9" cy="7" r="1" fill="#000" />
        </svg>

        {/* Scissors small — left middle */}
        <svg style={iconStyle("45%", undefined, "2%", undefined, "40deg", 0.1)} width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
          <line x1="20" y1="4" x2="8.12" y2="15.88" />
          <line x1="14.47" y1="14.48" x2="20" y2="20" />
          <line x1="8.12" y1="8.12" x2="12" y2="12" />
        </svg>

        {/* Comb small — right middle */}
        <svg style={iconStyle("52%", undefined, undefined, "2%", "-15deg", 0.1)} width="72" height="72" viewBox="0 0 24 24" fill="#000">
          <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5zm1 5h2v9H4v-9zm3 0h2v7H7v-7zm3 0h2v9h-2v-9zm3 0h2v7h-2v-7zm3 0h2v9h-2v-9z" />
        </svg>

        {/* Trimmer tiny — upper left inner */}
        <svg style={iconStyle("28%", undefined, "7%", undefined, "-10deg", 0.08)} width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="7" y="2" width="10" height="6" rx="1" />
          <rect x="8" y="8" width="8" height="13" rx="1" />
          <line x1="10" y1="11" x2="14" y2="11" />
          <line x1="10" y1="14" x2="14" y2="14" />
        </svg>

        {/* Hair dryer tiny — upper right inner */}
        <svg style={iconStyle("22%", undefined, undefined, "7%", "30deg", 0.08)} width="66" height="66" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4a5 5 0 0 1 5 5v2l4 4H7a5 5 0 0 1 0-10z" />
          <line x1="16" y1="15" x2="20" y2="19" />
          <circle cx="9" cy="7" r="1" fill="#000" />
        </svg>

      </div>

      {/* ── Main card ── */}
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-stone-200 shadow-2xl shadow-black/10 md:grid-cols-2">

        {/* ── Left panel ── */}
        <div className="flex flex-col justify-between bg-[#0a0a0a] p-12">
          <div>
            {/* Live badge */}
            <div className="mb-8 flex w-fit items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 py-1.5">
              <span className="size-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-[#666]">Explore Salon — Management Suite</span>
            </div>

            {/* Hero headline */}
            <h1 className="text-[2rem] font-semibold leading-snug text-white">
              Manage your SALON
              <br />
              <span className="text-[#444]">like a</span> PRO.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#555]">
              Everything you need to run your business — appointments, staff, revenue, and clients — all in one place.
            </p>

            {/* Feature pills */}
            <div className="mt-6 flex flex-wrap gap-2">
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-full border border-[#222] bg-[#141414] px-3 py-1.5"
                >
                  <Icon size={13} className="text-[#444]" />
                  <span className="text-xs text-[#666]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="mt-10 text-xs tracking-widest text-[#2a2a2a]">
            Built by <span className="text-[#444]">Thrivex Labs</span>
          </p>
        </div>

        {/* ── Right panel ── */}
        <div className="flex flex-col justify-center bg-white px-12 py-16">
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-stone-900">Welcome back</h2>
            <p className="mt-1 text-sm text-stone-400">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Email address
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@exploresalon.com"
                className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Password
              </span>
              <div className="relative mt-2">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 pl-4 pr-11 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-300 transition hover:text-stone-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs text-stone-400 underline underline-offset-2 transition hover:text-stone-700"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-[#0a0a0a] text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              {loggingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setForgotModalOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl">
            <button
              onClick={() => setForgotModalOpen(false)}
              className="absolute right-4 top-4 text-stone-300 transition hover:text-stone-700"
            >
              <X size={18} />
            </button>
            <h2 className="mb-1 text-lg font-semibold text-stone-900">Reset password</h2>
            <p className="mb-5 text-xs text-stone-400">
              Enter your registered email address. We'll send you a secure link to reset your password.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Email address
                </span>
                <input
                  required
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="owner@exploresalon.com"
                  className="mt-2 h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:bg-white"
                />
              </label>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setForgotModalOpen(false)}
                  className="h-10 rounded-xl border border-stone-200 px-4 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReset}
                  className="h-10 rounded-xl bg-[#0a0a0a] px-5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {sendingReset ? "Sending..." : "Send reset link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}