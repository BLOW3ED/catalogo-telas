"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit con estado "guardando…" vía useFormStatus.
 * Debe vivir DENTRO del <form> cuya action quiere observar.
 */
export function SubmitButton({
  label,
  pendingLabel,
  size = "lg",
}: {
  label: string;
  pendingLabel: string;
  size?: "sm" | "lg";
}) {
  const { pending } = useFormStatus();

  const sizeClasses =
    size === "lg" ? "h-12 px-5 text-sm w-full" : "h-10 px-4 text-sm";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-amber font-medium text-white shadow-sm transition-colors hover:bg-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${sizeClasses}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
