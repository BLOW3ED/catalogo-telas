"use client";

import { useEffect, useState } from "react";
import { X, Trash2, MessageCircle, ArrowLeft } from "lucide-react";
import { useCartStore } from "@/lib/store";
import { publicImageUrl } from "@/lib/supabase/storage";
import { buildQuoteMessage, pesos } from "@/lib/whatsapp-message";
import { unidadDe, cantidadCorta } from "@/lib/unidades";
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

  const haySinPrecio = items.some((item) => item.precio == null);
  const hayReferencia = items.some((item) => item.precio_referencia);

  const numero = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || "";
  const waHref = `https://wa.me/${numero}?text=${encodeURIComponent(buildQuoteMessage(items))}`;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-heritage-navy/50 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Drawer */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col bg-sand-bg border-l border-line/60 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between border-b border-line/60 p-4 sm:p-6 bg-surface-container-low/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-accent-copper">shopping_bag</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-copper">
                Cotización de Telas
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-heritage-navy mt-1">Tu Cesta</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              Revisa tus metros seleccionados y envíalos por WhatsApp sin compromiso.
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="-mr-1 shrink-0 rounded-full p-2 text-ink-soft transition-colors hover:bg-surface-container hover:text-heritage-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-heritage-navy"
            aria-label="Cerrar cotización"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-accent-copper">
                <span className="material-symbols-outlined text-[32px]">shopping_basket</span>
              </div>
              <p className="font-display text-xl font-bold text-heritage-navy">Tu cesta está vacía</p>
              <p className="mt-2 max-w-xs text-sm text-ink-soft">
                Explora el catálogo, elige tus metros favoritos y agrégalos aquí.
              </p>
              <Button
                variant="primary"
                size="md"
                className="mt-6"
                onClick={() => setIsOpen(false)}
              >
                Explorar catálogo
              </Button>
              <div className="mt-3">
                <ShareCatalog variant="ghost" size="md" label="Compartir catálogo" />
              </div>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {items.map((item) => (
                <li key={item.id} className="flex gap-3.5 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-3.5 shadow-2xs">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low">
                    <TelaImage
                      src={publicImageUrl(item.foto_principal)}
                      derivados={item.foto_derivados}
                      sizes="80px"
                      alt={item.tela_nombre}
                      aspecto="cuadrado"
                    />
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="font-display font-bold leading-tight text-heritage-navy">{item.tela_nombre}</h3>
                      <p className="text-xs text-ink-soft mt-0.5">
                        {item.color_nombre} {item.sku && `· SKU: ${item.sku}`}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="flex items-center rounded-xl border border-outline-variant/30 bg-surface-container p-0.5">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.id,
                              Math.max(
                                unidadDe(item.unidad_venta).minimo,
                                item.cantidad - unidadDe(item.unidad_venta).paso
                              )
                            )
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-lowest text-xs font-bold text-heritage-navy shadow-2xs transition-all hover:bg-surface-container-high active:scale-95"
                          aria-label={`Disminuir ${unidadDe(item.unidad_venta).singular} de ${item.tela_nombre}`}
                        >
                          -
                        </button>
                        <span className="w-10 text-center text-xs font-bold text-heritage-navy">
                          {cantidadCorta(item.cantidad, item.unidad_venta)}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.id, item.cantidad + unidadDe(item.unidad_venta).paso)
                          }
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-lowest text-xs font-bold text-heritage-navy shadow-2xs transition-all hover:bg-surface-container-high active:scale-95"
                          aria-label={`Aumentar ${unidadDe(item.unidad_venta).singular} de ${item.tela_nombre}`}
                        >
                          +
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-accent-copper">
                          {item.precio != null ? pesos.format(item.precio * item.cantidad) : "Consultar"}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="rounded-full p-1.5 text-ink-soft transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none"
                          aria-label="Eliminar artículo"
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
          <div className="border-t border-line/60 bg-surface-container-lowest p-5 sm:p-6 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-ink-soft">
                {haySinPrecio ? "Total parcial" : "Total estimado"}
              </span>
              <span className="font-display text-2xl sm:text-3xl font-bold text-accent-copper">
                {pesos.format(total)}
              </span>
            </div>
            <p className="mb-4 text-xs text-ink-soft leading-relaxed">
              {hayReferencia
                ? "Incluye precios de referencia. Confirmamos precio final y disponibilidad por WhatsApp."
                : haySinPrecio
                  ? "Algunos artículos se cotizan por WhatsApp; no están en el total."
                  : "Es una estimación. Confirmamos disponibilidad y apartado por WhatsApp."}
            </p>
            <Button
              variant="whatsapp"
              size="lg"
              fullWidth
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="h-14"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Enviar pedido por WhatsApp
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              className="mt-2.5"
              onClick={() => setIsOpen(false)}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Seguir explorando
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

