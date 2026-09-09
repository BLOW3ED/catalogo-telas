import { defineConfig, defaultExclude } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // `exclude` REEMPLAZA los defaults de vitest, no los agrega: por eso se hace
    // spread de `defaultExclude` (hoy node_modules y .git) en vez de copiarlos a
    // mano, que dejaría una lista fósil el día que vitest los cambie.
    // `.claude/` guarda los git worktrees de otras ramas, con sus propios .test.ts
    // apuntando a código a medio implementar: sin esta línea `pnpm test` reporta
    // fallas que no son de este árbol de trabajo.
    exclude: [...defaultExclude, "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
