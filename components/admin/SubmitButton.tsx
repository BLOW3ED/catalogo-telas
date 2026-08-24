"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón de submit con estado "guardando…". Por default lo lee de
 * useFormStatus (vive DENTRO del <form> cuya action quiere observar), pero
 * acepta `pending` explícito para forms que se envían a mano con
 * `onSubmit` + `startTransition` en vez de `<form action={...}>` —
 * useFormStatus solo reacciona a ese segundo mecanismo.
 */
export function SubmitButton({
  label,
  pendingLabel,
  size = "lg",
  pending: pendienteExterno,
}: {
  label: string;
  pendingLabel: string;
  size?: "sm" | "lg";
  pending?: boolean;
}) {
  const { pending: pendienteFormStatus } = useFormStatus();
  const pending = pendienteExterno ?? pendienteFormStatus;

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
