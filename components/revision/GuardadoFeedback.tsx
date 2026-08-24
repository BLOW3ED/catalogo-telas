"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { EstadoGuardado } from "@/app/revision/actions";

/**
 * Confirmación de guardado para un `useActionState`: sin esto, un guardado
 * exitoso no daba ninguna señal (el revisor no sabía si su cambio quedó) y
 * uno fallido no tenía dónde mostrarse — antes de existir `EstadoGuardado`
 * el error se lanzaba y terminaba en `app/error.tsx`, el boundary de TODO
 * el sitio, tapando la pantalla completa del producto que se revisaba.
 *
 * El "Guardado" se autooculta a los pocos segundos; el error se queda fijo
 * junto al campo hasta el siguiente intento.
 */
export function GuardadoFeedback({ estado }: { estado: EstadoGuardado | null }) {
  const [mostrarExito, setMostrarExito] = useState(false);

  useEffect(() => {
    if (!estado?.ok) return;
    setMostrarExito(true);
    const t = setTimeout(() => setMostrarExito(false), 2500);
    return () => clearTimeout(t);
  }, [estado]);

  return (
    <p className="min-h-[1rem] text-xs" aria-live="polite">
      {mostrarExito && (
        <span className="inline-flex items-center gap-1 font-medium text-success">
          <Check className="h-3.5 w-3.5" aria-hidden />
          Guardado
        </span>
      )}
      {estado && !estado.ok && <span className="text-amber">{estado.error}</span>}
    </p>
  );
}
