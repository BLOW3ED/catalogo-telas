import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Lock } from "lucide-react";
import { getSesionAdmin } from "@/lib/admin-auth";
import { login } from "@/app/admin/actions";
import { SubmitButton } from "@/components/admin/SubmitButton";

export const metadata: Metadata = {
  title: "Entrar — Admin Telas La Jalisciense",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Con sesión activa no tiene sentido ver el login.
  const { user } = await getSesionAdmin();
  if (user) redirect("/admin");

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16 sm:py-24">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/10 text-amber">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="font-display text-2xl text-ink">Administración</h1>
            <p className="text-sm text-ink/60">Solo personal de la tienda.</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber/30 bg-amber/5 p-3 text-sm text-ink/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />
            Correo o contraseña incorrectos.
          </div>
        )}

        <form action={login} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Correo
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="h-12 rounded-xl border border-line bg-white px-4 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
            Contraseña
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="h-12 rounded-xl border border-line bg-white px-4 text-base font-normal text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
            />
          </label>
          <SubmitButton label="Entrar" pendingLabel="Entrando…" />
        </form>
      </div>
    </main>
  );
}
