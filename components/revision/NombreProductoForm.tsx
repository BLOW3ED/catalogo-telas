"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { GuardadoFeedback } from "@/components/revision/GuardadoFeedback";
import { actualizarNombreProducto, type EstadoGuardado } from "@/app/revision/actions";

function ajustarAltura(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Nombre del producto, editable in-line: se ve como un título hasta que se
 * enfoca, con su propio botón de guardar (más simple y más confiable en
 * tablet que un autosave silencioso al perder el foco).
 *
 * Es un `<textarea>` que crece con el contenido, no un `<input>` de una
 * línea: un nombre largo ("Aplicación de balconería con pedrería…") se
 * recortaba sin avisar y el revisor no podía ver ni corregir el nombre
 * completo.
 */
export function NombreProductoForm({ telaId, nombre }: { telaId: string; nombre: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [estado, setEstado] = useState<EstadoGuardado | null>(null);
  const [pendiente, startTransition] = useTransition();

  useEffect(() => {
    if (textareaRef.current) ajustarAltura(textareaRef.current);
  }, []);

  function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(async () => {
      setEstado(await actualizarNombreProducto(datos));
    });
  }

  return (
    <div>
      <form onSubmit={guardar} className="flex items-center gap-2">
        <input type="hidden" name="tela_id" value={telaId} />
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            name="nombre"
            defaultValue={nombre}
            required
            rows={1}
            aria-label="Nombre del producto"
            className="w-full resize-none overflow-hidden rounded-xl border border-transparent bg-transparent px-3 py-2 pr-8 font-display text-2xl leading-snug text-ink-display transition-colors focus-visible:border-line focus-visible:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            onInput={(e) => ajustarAltura(e.currentTarget)}
            onKeyDown={(e) => {
              // Enter guarda (como hacía el <input> de una línea); Shift+Enter
              // sigue insertando salto de línea por si algún nombre lo necesita.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Pencil
            className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-ink/30"
            aria-hidden
          />
        </div>
        <SubmitButton label="Guardar" pendingLabel="Guardando…" size="sm" pending={pendiente} />
      </form>
      <div className="px-3">
        <GuardadoFeedback estado={estado} />
      </div>
    </div>
  );
}
