"use client";

import { useEffect, useState } from "react";
import { X, Trash2, MessageCircle, ArrowLeft } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { publicImageUrl } from "@/lib/supabase/storage";
import { buildQuoteMessage, pesos } from "@/lib/whatsapp-message";
import { TelaImage } from "./TelaImage";
import { Button } from "@/components/ui/Button";
import { ShareCatalog } from "@/components/ShareCatalog";

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

  // Honestidad de precios: si hay artículos sin precio o con precio de
  // referencia (demo), el mensaje y el pie del carrito lo dicen explícito
  // para que el cliente no llegue citando un total que la tienda no fijó.
  const haySinPrecio = items.some((item) => item.precio == null);
  const hayReferencia = items.some((item) => item.precio_referencia);

  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "";
  const waHref = `https://wa.me/${numero}?text=${encodeURIComponent(buildQuoteMessage(items))}`;

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
        <div className="flex items-start justify-between border-b border-line p-4 sm:p-6">
          <div>
            <h2 className="font-display text-2xl text-ink">Tu cotización</h2>
            <p className="mt-0.5 text-sm text-ink-soft">
              Revísala y envíala por WhatsApp. Sin compromiso.
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="-mr-1 shrink-0 rounded-full p-2.5 text-ink-soft transition-colors hover:bg-line/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Cerrar cotización"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="font-display text-xl text-ink-soft">Aún no agregas telas</p>
              <p className="mt-2 max-w-xs text-sm text-ink-soft">
                Explora el catálogo, elige tus metros y agrégalos aquí. Luego lo
                envías por WhatsApp y te atendemos.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-6"
                onClick={() => setIsOpen(false)}
              >
                Explorar telas
              </Button>
              <div className="mt-3">
                <ShareCatalog variant="ghost" size="md" label="Compartir catálogo" />
              </div>
            </div>
          ) : (
            <ul className="space-y-6">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded border border-line-strong/30 bg-white p-px">
                    <TelaImage
                      src={publicImageUrl(item.foto_principal)}
                      derivados={item.foto_derivados}
                      sizes="80px"
                      alt={item.tela_nombre}
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="font-semibold leading-tight text-ink">{item.tela_nombre}</h3>
                      <p className="text-sm text-ink-soft">
                        {item.color_nombre} {item.sku && `(SKU: ${item.sku})`}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded border border-line-strong/30 bg-chip p-1">
                        <button
                          onClick={() => updateQuantity(item.id, Math.max(0.5, item.cantidad - 0.5))}
                          className="flex h-11 w-11 items-center justify-center rounded text-lg text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Disminuir medio metro"
                        >-</button>
                        <span className="w-12 text-center text-sm font-medium">{item.cantidad}m</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.cantidad + 0.5)}
                          className="flex h-11 w-11 items-center justify-center rounded text-lg text-ink-soft transition-colors hover:bg-surface-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Aumentar medio metro"
                        >+</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-amber">
                          {item.precio != null ? pesos.format(item.precio * item.cantidad) : "Consultar"}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="rounded-full p-2.5 text-ink-soft transition-colors hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-5 w-5" />
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
          <div className="border-t border-line bg-surface p-4 sm:p-6">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-lg font-medium text-ink">
                {haySinPrecio ? "Total parcial" : "Total estimado"}
              </span>
              <span className="font-display text-2xl text-amber">{pesos.format(total)}</span>
            </div>
            <p className="mb-4 text-sm text-ink-soft">
              {hayReferencia
                ? "Incluye precios de referencia. Confirmamos precio final y disponibilidad por WhatsApp."
                : haySinPrecio
                  ? "Algunos artículos se cotizan por WhatsApp; no están en el total."
                  : "Es una estimación. Confirmamos precio final y disponibilidad por WhatsApp."}
            </p>
            <Button
              variant="whatsapp"
              size="lg"
              fullWidth
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
            >
              <MessageCircle className="h-6 w-6" aria-hidden />
              Enviar pedido por WhatsApp
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              className="mt-2"
              onClick={() => setIsOpen(false)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Seguir comprando
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
