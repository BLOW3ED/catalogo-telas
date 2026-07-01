"use client";

import { useEffect, useState } from "react";
import { X, Trash2, MessageCircle } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { publicImageUrl } from "@/lib/supabase/storage";
import { TelaImage } from "./TelaImage";

const pesos = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity } = useCartStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const total = items.reduce(
    (acc, item) => acc + (item.precio ?? 0) * item.cantidad,
    0
  );

  const formatMessage = () => {
    let msg = "Hola, me interesa cotizar el siguiente pedido:\n\n";
    items.forEach((item) => {
      msg += `- ${item.cantidad}m de ${item.tela_nombre}`;
      if (item.color_nombre) msg += ` color ${item.color_nombre}`;
      if (item.sku) msg += ` (SKU: ${item.sku})`;
      msg += "\n";
    });
    msg += `\nTotal estimado: ${pesos.format(total)} MXN.\n¿Me confirman disponibilidad?`;
    return encodeURIComponent(msg);
  };

  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "";
  const waHref = `https://wa.me/${numero}?text=${formatMessage()}`;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Drawer */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col bg-bg shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line p-4 sm:p-6">
          <h2 className="font-display text-2xl text-ink">Cotización</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 text-ink/60 transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            aria-label="Cerrar carrito"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-xl text-ink/70">Carrito vacío</p>
              <p className="mt-2 text-sm text-ink/50">Agrega telas para solicitar una cotización por WhatsApp.</p>
              <button
                onClick={() => setIsOpen(false)}
                className="mt-6 rounded-xl border border-line bg-white px-5 py-2 text-sm font-medium transition-colors hover:bg-line/30"
              >
                Seguir explorando
              </button>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-white">
                    <TelaImage
                      src={publicImageUrl(item.foto_principal)}
                      alt={item.tela_nombre}
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="font-semibold leading-tight text-ink">{item.tela_nombre}</h3>
                      <p className="text-sm text-ink/60">
                        {item.color_nombre} {item.sku && `(SKU: ${item.sku})`}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-lg border border-line bg-white px-1 py-1">
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(0.5, item.cantidad - 0.5))}
                          className="px-2 text-ink/60 hover:text-amber"
                          aria-label="Disminuir"
                        >-</button>
                        <span className="w-10 text-center text-sm font-medium">{item.cantidad}m</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad + 0.5)}
                          className="px-2 text-ink/60 hover:text-amber"
                          aria-label="Aumentar"
                        >+</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-amber">
                          {item.precio != null ? pesos.format(item.precio * item.cantidad) : "Consultar"}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-ink/40 transition-colors hover:text-red-500"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-line bg-white p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-medium text-ink">Total estimado</span>
              <span className="font-display text-2xl text-amber">{pesos.format(total)}</span>
            </div>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber px-5 py-4 font-medium text-white shadow-sm transition-colors hover:bg-amber/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2"
              onClick={() => setIsOpen(false)}
            >
              <MessageCircle className="h-5 w-5" />
              Enviar pedido por WhatsApp
            </a>
          </div>
        )}
      </div>
    </>
  );
}
