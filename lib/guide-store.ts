import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado de la GUÍA del catálogo.
 *
 * Dos cosas viven aquí:
 *
 * - El TUTORIAL (`components/tutorial/TutorialModal.tsx`): modal de slides con
 *   maquetas. Se abre solo en la primera visita y se puede reabrir cuando sea
 *   desde "Ayuda" en el header.
 * - Los HINTS descartables (`dismissedHints`): hoy solo queda el de deslizar la
 *   foto en el detalle (`TelaImageCarousel`), que no es tutorial sino un aviso
 *   de que existe un gesto invisible; se auto-descarta al primer swipe.
 *
 * Persistimos en localStorage para no volver a molestar a quien ya vio el
 * tutorial. Mismo patrón que `lib/store.ts` (el carrito).
 */
type GuideState = {
  tutorialSeen: boolean;
  tutorialOpen: boolean;
  dismissedHints: string[];
  openTutorial: () => void;
  closeTutorial: () => void;
  markTutorialSeen: () => void;
  dismissHint: (id: string) => void;
  isHintDismissed: (id: string) => boolean;
  resetGuide: () => void;
};

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
      tutorialSeen: false,
      tutorialOpen: false,
      dismissedHints: [],
      openTutorial: () => set({ tutorialOpen: true }),
      // Cerrar (por donde sea: Saltar, ¡Listo!, Esc, clic fuera) cuenta como
      // visto: no queremos perseguir a nadie con el tutorial en cada visita.
      closeTutorial: () => set({ tutorialOpen: false, tutorialSeen: true }),
      // Quien ya empezó a moverse por el catálogo no necesita el tutorial: lo
      // damos por visto para que el temporizador no se vuelva a armar en la
      // siguiente página y le salte encima a media navegación.
      markTutorialSeen: () => set({ tutorialSeen: true }),
      dismissHint: (id) =>
        set((state) =>
          state.dismissedHints.includes(id)
            ? state
            : { dismissedHints: [...state.dismissedHints, id] }
        ),
      isHintDismissed: (id) => get().dismissedHints.includes(id),
      resetGuide: () =>
        set({ tutorialSeen: false, tutorialOpen: true, dismissedHints: [] }),
    }),
    {
      name: "guide-storage",
      version: 2,
      // No persistimos `tutorialOpen` (es estado efímero de UI).
      partialize: (state) => ({
        tutorialSeen: state.tutorialSeen,
        dismissedHints: state.dismissedHints,
      }),
      // v1 → v2: `welcomeSeen` pasó a llamarse `tutorialSeen` al cambiar el
      // modal de bienvenida por el tutorial de slides. Sin esta migración, todo
      // cliente recurrente volvería a ver el tutorial una vez más.
      migrate: (persisted, version) => {
        const estado = (persisted ?? {}) as {
          welcomeSeen?: boolean;
          tutorialSeen?: boolean;
          dismissedHints?: string[];
        };
        return {
          tutorialSeen:
            (version < 2 ? estado.welcomeSeen : estado.tutorialSeen) ?? false,
          dismissedHints: estado.dismissedHints ?? [],
        };
      },
    }
  )
);
