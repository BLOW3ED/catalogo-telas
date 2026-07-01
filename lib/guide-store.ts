import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado de la GUÍA (onboarding + coach-marks).
 *
 * Persistimos en localStorage para no volver a molestar a quien ya vio la
 * bienvenida o descartó una pista. Mismo patrón que `lib/store.ts` (el carrito).
 *
 * - `welcomeSeen`: si el modal de bienvenida ya se mostró/cerró.
 * - `welcomeOpen`: control efímero del modal (no se persiste).
 * - `dismissedHints`: ids de coach-marks que el usuario ya cerró.
 */
type GuideState = {
  welcomeSeen: boolean;
  welcomeOpen: boolean;
  dismissedHints: string[];
  openWelcome: () => void;
  closeWelcome: () => void;
  markWelcomeSeen: () => void;
  dismissHint: (id: string) => void;
  isHintDismissed: (id: string) => boolean;
  resetGuide: () => void;
};

export const useGuideStore = create<GuideState>()(
  persist(
    (set, get) => ({
      welcomeSeen: false,
      welcomeOpen: false,
      dismissedHints: [],
      openWelcome: () => set({ welcomeOpen: true }),
      closeWelcome: () => set({ welcomeOpen: false, welcomeSeen: true }),
      markWelcomeSeen: () => set({ welcomeSeen: true }),
      dismissHint: (id) =>
        set((state) =>
          state.dismissedHints.includes(id)
            ? state
            : { dismissedHints: [...state.dismissedHints, id] }
        ),
      isHintDismissed: (id) => get().dismissedHints.includes(id),
      resetGuide: () =>
        set({ welcomeSeen: false, welcomeOpen: true, dismissedHints: [] }),
    }),
    {
      name: "guide-storage",
      // No persistimos `welcomeOpen` (es estado efímero de UI).
      partialize: (state) => ({
        welcomeSeen: state.welcomeSeen,
        dismissedHints: state.dismissedHints,
      }),
    }
  )
);
