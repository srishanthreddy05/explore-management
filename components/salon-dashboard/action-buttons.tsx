import { Send, Save, X } from "lucide-react";

interface ActionButtonsProps {
  onSave?: () => void;
  onClose?: () => void;
  onWhatsApp?: () => void;
  disabled?: boolean;
  saved?: boolean;
  isEdit?: boolean;
}

export function ActionButtons({
  onSave,
  onClose,
  onWhatsApp,
  disabled,
  saved,
  isEdit,
}: ActionButtonsProps) {
  const handleActionClick = (label: string) => {
    if (
      (label === "Save Bill" ||
        label === "Saved ✓" ||
        label === "Update Invoice" ||
        label === "Updated ✓") &&
      onSave
    ) {
      onSave();
    } else if (label === "Send on WhatsApp" && onWhatsApp) {
      onWhatsApp();
    } else if (label === "Close" && onClose) {
      onClose();
    }
  };

  const actions = [
    {
      label: saved
        ? isEdit
          ? "Updated ✓"
          : "Saved ✓"
        : isEdit
          ? "Update Invoice"
          : "Save Bill",
      icon: Save,
      tone: "primary",
    },
    { label: "Send on WhatsApp", icon: Send, tone: "success" },
    { label: "Close", icon: X, tone: "neutral" },
  ] as const;

  return (
    <section className="rounded-2xl border border-[#2E2B24] bg-[#1C1A16] p-4 shadow-md text-[#A89F8C]">
      <div className="grid gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isPrimary = action.tone === "primary";
          const className =
            action.tone === "primary"
              ? "border-[#B8962E] bg-[#B8962E] text-[#0E0D0B] hover:bg-[#D4A935] shadow-[0_4px_16px_rgba(184,150,46,0.3)]"
              : action.tone === "success"
                ? "border-[#2E2B24] bg-[#1C1A16] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E]"
                : "border-[#2E2B24] bg-[#131210] text-[#A89F8C] hover:border-[#B8962E] hover:text-[#B8962E] hover:bg-[#1F1A0F]";

          return (
            <button
              key={action.label}
              disabled={isPrimary && disabled}
              type="button"
              onClick={() => handleActionClick(action.label)}
              className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-bold transition hover:-translate-y-0.5 disabled:opacity-50 ${className}`}
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

