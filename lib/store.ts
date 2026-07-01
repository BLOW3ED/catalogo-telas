import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CatalogoTela } from './types';

export type CartItem = {
  id: string; // variante_id
  tela_nombre: string;
  color_nombre: string | null;
  sku: string | null;
  precio: number | null;
  cantidad: number;
  foto_principal: string | null;
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
                cantidad,
                foto_principal: variante.foto_principal,
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
