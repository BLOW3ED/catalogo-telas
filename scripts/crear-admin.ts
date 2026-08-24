#!/usr/bin/env tsx
/**
 * Alta de administradores y revisores — Telas La Jalisciense
 * ===========================================================================
 * Un "usuario admin" (o "revisor") en este proyecto son DOS cosas
 * independientes, y hacen falta las dos (ver `lib/admin-auth.ts` /
 * `lib/revisor-auth.ts`):
 *
 *   1. Una cuenta en Supabase Auth        → da SESIÓN (correo + contraseña).
 *   2. Ese correo en el allowlist del rol → da AUTORIZACIÓN
 *      (`ADMIN_EMAILS` para admin, `REVISOR_EMAILS` para revisor — mismo
 *      formato, `--rol` decide cuál).
 *
 * La sesión sola no sirve: Supabase permite sign-up público por default, así
 * que cualquiera podría crearse cuenta. El allowlist es la puerta real y vive
 * SOLO en el servidor. Por eso este script hace la mitad 1 y te dice, con el
 * texto ya listo para pegar, cómo cerrar la mitad 2 — no puede escribir él
 * mismo en `.env.local` de producción (Vercel), donde es donde importa.
 *
 * La cuenta de Auth es IDÉNTICA para ambos roles (correo + contraseña, sin
 * rol propio) — el rol lo decide solo a qué allowlist se agrega el correo.
 *
 * La contraseña NO se pide por argumento a propósito: quedaría escrita en el
 * historial del shell. El script la genera y la imprime UNA vez.
 *
 *   pnpm admin:crear --email=x@y.com                    → SIMULACRO, no escribe nada
 *   pnpm admin:crear --email=x@y.com --aplicar          → crea la cuenta (rol admin)
 *   pnpm admin:crear --email=x@y.com --rol=revisor --aplicar
 *                                                       → crea la cuenta (rol revisor)
 *   pnpm admin:crear --email=x@y.com --reset --aplicar
 *                                                       → repone la contraseña de
 *                                                         una cuenta que ya existe
 *   pnpm admin:crear --listar                           → quién tiene cuenta hoy
 *                                                         y para qué rol(es) está autorizado
 */
import { createClient, type User } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomInt } from "node:crypto";
import { isAllowedAdminEmail, isAllowedRevisorEmail } from "../lib/admin-allowlist";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// ---------------------------------------------------------------------------
// Contraseña
// ---------------------------------------------------------------------------
/**
 * Alfabeto SIN caracteres ambiguos (0/O, 1/l/I): esta contraseña se va a
 * dictar por teléfono y a teclear en una tablet, y un cero confundido con
 * una O es una llamada a soporte.
 *
 * `randomInt` (no `Math.random`) porque es del CSPRNG del sistema y además
 * no tiene el sesgo del módulo — cada carácter es equiprobable de verdad.
 */
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generarPassword(largo = 16): string {
  let salida = "";
  for (let i = 0; i < largo; i++) salida += ALFABETO[randomInt(ALFABETO.length)];
  return salida;
}

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const bandera = (nombre: string) => args.includes(`--${nombre}`);
const valor = (nombre: string) =>
  args.find((a) => a.startsWith(`--${nombre}=`))?.split("=").slice(1).join("=");

const APLICAR = bandera("aplicar");
const RESET = bandera("reset");
const LISTAR = bandera("listar");
const EMAIL = valor("email")?.trim().toLowerCase();

type Rol = "admin" | "revisor";

const ROL_RAW = valor("rol")?.trim().toLowerCase();
if (ROL_RAW && ROL_RAW !== "admin" && ROL_RAW !== "revisor") {
  console.error(`✖ --rol debe ser "admin" o "revisor" (recibido: "${ROL_RAW}")`);
  process.exit(1);
}
const ROL: Rol = (ROL_RAW as Rol) ?? "admin";
const ENV_VAR_DEL_ROL = ROL === "admin" ? "ADMIN_EMAILS" : "REVISOR_EMAILS";
const isAllowedDelRol = ROL === "admin" ? isAllowedAdminEmail : isAllowedRevisorEmail;

function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Sb = ReturnType<typeof crearClienteAdmin>;

const POR_PAGINA = 200;

/**
 * Una página de usuarios, ya destapada.
 *
 * `listUsers()` declara `data` como unión (`{users: User[]} | {users: []}`),
 * así que al descartar el error TS colapsa `users` a `never[]`. La aserción
 * vive AQUÍ y solo aquí, en vez de repetirse en cada llamada.
 */
async function paginaDeUsuarios(sb: Sb, page: number): Promise<User[]> {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: POR_PAGINA });
  if (error) throw new Error(error.message);
  return data.users as User[];
}

/**
 * `supabase-js` v2 no tiene `getUserByEmail`, así que hay que paginar.
 * Con un puñado de administradores esto es una sola página, pero paginar
 * evita el bug silencioso de "no lo encontré" cuando pasen de 50.
 */
async function buscarPorEmail(sb: Sb, email: string) {
  for (let page = 1; ; page++) {
    const usuarios = await paginaDeUsuarios(sb, page);
    const hallado = usuarios.find((u) => u.email?.toLowerCase() === email);
    if (hallado) return hallado;
    if (usuarios.length < POR_PAGINA) return null;
  }
}

async function listarTodos(sb: Sb) {
  const todos: User[] = [];
  for (let page = 1; ; page++) {
    const usuarios = await paginaDeUsuarios(sb, page);
    todos.push(...usuarios);
    if (usuarios.length < POR_PAGINA) break;
  }
  return todos;
}

// ---------------------------------------------------------------------------
async function main() {
  const sb = crearClienteAdmin();
  const adminAllowlist = process.env.ADMIN_EMAILS;
  const revisorAllowlist = process.env.REVISOR_EMAILS;

  if (LISTAR) {
    const usuarios = await listarTodos(sb);
    console.log(`\nCuentas de Supabase Auth (${usuarios.length}):\n`);
    for (const u of usuarios) {
      const esAdmin = isAllowedAdminEmail(u.email, adminAllowlist);
      const esRevisor = isAllowedRevisorEmail(u.email, revisorAllowlist);
      const roles = [esAdmin && "admin", esRevisor && "revisor"].filter(Boolean).join(" + ");
      console.log(
        `  ${esAdmin || esRevisor ? "✔" : "·"} ${u.email}` +
          `  [${roles || "SIN autorización"}]` +
          `  último acceso: ${u.last_sign_in_at?.slice(0, 10) ?? "nunca"}`
      );
    }
    console.log(`\n  ADMIN_EMAILS local:   ${adminAllowlist || "(vacío — nadie entra)"}`);
    console.log(`  REVISOR_EMAILS local: ${revisorAllowlist || "(vacío — nadie entra)"}\n`);
    return;
  }

  if (!EMAIL || !EMAIL.includes("@")) {
    console.error("✖ Falta --email=correo@dominio.com   (o usa --listar)");
    process.exit(1);
  }

  const allowlist = ROL === "admin" ? adminAllowlist : revisorAllowlist;
  const existente = await buscarPorEmail(sb, EMAIL);
  const enAllowlist = isAllowedDelRol(EMAIL, allowlist);

  console.log(`\n${APLICAR ? "APLICANDO" : "SIMULACRO (no escribe nada)"}  —  rol: ${ROL}\n`);
  console.log(`  correo:      ${EMAIL}`);
  console.log(`  cuenta Auth: ${existente ? "YA EXISTE" : "no existe"}`);
  console.log(`  ${ENV_VAR_DEL_ROL} local: ${enAllowlist ? "✔ incluido" : "✖ NO incluido"}\n`);

  if (existente && !RESET) {
    console.log("→ La cuenta ya existe. No la toco.");
    console.log("  Si se les olvidó la contraseña:  --reset --aplicar\n");
    if (!enAllowlist) avisoAllowlist(EMAIL, allowlist);
    return;
  }

  const password = generarPassword();
  const accion = existente ? "REPONER la contraseña de" : "CREAR";

  if (!APLICAR) {
    console.log(`→ Con --aplicar voy a ${accion} esta cuenta y te doy la contraseña.\n`);
    if (!enAllowlist) avisoAllowlist(EMAIL, allowlist);
    return;
  }

  if (existente) {
    const { error } = await sb.auth.admin.updateUserById(existente.id, { password });
    if (error) {
      console.error(`✖ No se pudo reponer la contraseña: ${error.message}`);
      process.exit(1);
    }
    console.log("✔ Contraseña repuesta.");
  } else {
    const { error } = await sb.auth.admin.createUser({
      email: EMAIL,
      password,
      // Sin esto queda creado pero NO puede entrar hasta hacer clic en un
      // correo de confirmación. Quien administra es la tienda, en tablet.
      email_confirm: true,
    });
    if (error) {
      console.error(`✖ No se pudo crear la cuenta: ${error.message}`);
      process.exit(1);
    }
    console.log("✔ Cuenta creada.");
  }

  console.log("\n  ───────────────────────────────────────────");
  console.log(`   correo:      ${EMAIL}`);
  console.log(`   contraseña:  ${password}`);
  console.log("  ───────────────────────────────────────────");
  console.log("   Se muestra UNA sola vez. Que la cambien al entrar.\n");

  if (!enAllowlist) avisoAllowlist(EMAIL, allowlist);
  else console.log(`→ Ya está en ${ENV_VAR_DEL_ROL} local. Verifica que también esté en producción.\n`);
}

function avisoAllowlist(email: string, allowlist: string | undefined) {
  const actuales = (allowlist ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  const nuevo = [...actuales, email].join(",");
  console.log(`⚠  Este correo NO está en ${ENV_VAR_DEL_ROL}: puede iniciar sesión pero`);
  console.log(`   ${ROL === "admin" ? "/admin" : "/revision"} lo va a rechazar. Falta la mitad 2. Pon esto en .env.local`);
  console.log("   Y en las variables de entorno de producción (Vercel):\n");
  console.log(`   ${ENV_VAR_DEL_ROL}=${nuevo}\n`);
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
