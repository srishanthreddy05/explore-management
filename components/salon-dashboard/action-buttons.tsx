import { MessageCircle, Save, X } from "lucide-react";

interface ActionButtonsProps {
  onSave?: () => void;
  onClose?: () => void;
  onWhatsApp?: () => void;
  disabled?: boolean;
  saved?: boolean;
}

export function ActionButtons({
  onSave,
  onClose,
  onWhatsApp,
  disabled,
  saved,
}: ActionButtonsProps) {
  const handleActionClick = (label: string) => {
    if ((label === "Save Bill" || label === "Saved ✓") && onSave) {
      onSave();
    } else if (label === "Send on WhatsApp" && onWhatsApp) {
      onWhatsApp();
    } else if (label === "Close" && onClose) {
      onClose();
    }
  };

  const actions = [
    { label: saved ? "Saved ✓" : "Save Bill", icon: Save, tone: "primary" },
    { label: "Send on WhatsApp", icon: MessageCircle, tone: "success" },
    { label: "Close", icon: X, tone: "neutral" },
  ] as const;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-md text-stone-900">
      <div className="grid gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isPrimary = action.tone === "primary";
          const className =
            action.tone === "primary"
              ? "border-black bg-black text-white hover:bg-stone-800"
              : action.tone === "success"
                ? "border-emerald-250 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/50"
                : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100";

          return (
            <button
              key={action.label}
              disabled={isPrimary && disabled}
              type="button"
              onClick={() => handleActionClick(action.label)}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 ${className}`}
            >
              <Icon size={18} />
              {action.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
