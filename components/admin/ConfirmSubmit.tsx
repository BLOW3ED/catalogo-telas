"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit destructivo con confirmación nativa. Debe vivir DENTRO del <form>
 * cuya action dispara (usa useFormStatus, igual que SubmitButton).
 */
export function ConfirmSubmit({
  label,
  pendingLabel,
  mensaje,
  size = "md",
}: {
  label: string;
  pendingLabel: string;
  mensaje: string;
  size?: "md" | "xs";
}) {
  const { pending } = useFormStatus();

  const sizeClasses = size === "md" ? "h-10 px-4 text-sm" : "h-7 px-2 text-xs";

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(mensaje)) e.preventDefault();
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-surface font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60 ${sizeClasses}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
