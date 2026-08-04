import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CatalogoTela, DerivadosFoto } from './types';

export type CartItem = {
  id: string; // variante_id
  tela_nombre: string;
  color_nombre: string | null;
  sku: string | null;
  precio: number | null;
  /** true si `precio` es de referencia (demo), no capturado en la BD. */
  precio_referencia?: boolean;
  cantidad: number;
  foto_principal: string | null;
  /** Opcional: carritos persistidos antes del pipeline de derivados no lo traen. */
  foto_derivados?: DerivadosFoto | null;
  /**
   * En qué se cuenta `cantidad` (metro | pieza | bolsa | …). Opcional porque
   * el carrito se guarda en localStorage: los que ya estaban ahí antes de esta
   * columna no la traen y `unidadDe(undefined)` los deja en metro, que es
   * justo como se venían contando. Nadie ve cambiar su pedido.
   */
  unidad_venta?: string | null;
  /** Piezas por empaque, para que el mensaje de WhatsApp diga "(25 pz c/u)". */
  piezas_por_unidad?: number | null;
};

type CartState = {
  items: CartItem[];
  isOpen: boolean;
  addItem: (variante: CatalogoTela, cantidad: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, cantidad: number) => void;
  clearCart: () => void;
  setIsOpen: (isOpen: boolean) => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      addItem: (variante, cantidad) =>
        set((state) => {
          const existingItem = state.items.find((i) => i.id === variante.variante_id);
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === variante.variante_id ? { ...i, cantidad: i.cantidad + cantidad } : i
              ),
              isOpen: true,
            };
          }
          return {
            items: [
              ...state.items,
              {
                id: variante.variante_id,
                tela_nombre: variante.tela_nombre,
                color_nombre: variante.color_nombre,
                sku: variante.sku,
                precio: variante.precio_metro,
                precio_referencia: variante.precio_es_referencia ?? false,
                cantidad,
                foto_principal: variante.foto_principal,
                foto_derivados: variante.foto_principal_derivados ?? null,
                unidad_venta: variante.unidad_venta ?? null,
                piezas_por_unidad: variante.piezas_por_unidad ?? null,
              },
            ],
            isOpen: true,
          };
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      updateQuantity: (id, cantidad) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, cantidad } : i)),
        })),
      clearCart: () => set({ items: [] }),
      setIsOpen: (isOpen) => set({ isOpen }),
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({ items: state.items }),
    }
  )
);
