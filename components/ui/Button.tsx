import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";

/**
 * Botón/CTA reutilizable para todo el catálogo.
 *
 * - Polimórfico: si recibe `href` se renderiza como <a> (útil para los enlaces
 *   de WhatsApp), si no como <button>.
 * - Variantes de color y tamaños grandes para que los CTAs sean muy visibles
 *   y accesibles (importante para el rango de edad 20–80).
 *
 * Sin dependencias extra: solo utilidades de Tailwind y los tokens de marca.
 */

type Variant = "primary" | "whatsapp" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold " +
  "transition-all duration-200 active:scale-98 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 select-none cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-container hover:shadow-md focus-visible:ring-primary",
  whatsapp:
    "bg-whatsapp text-white shadow-sm hover:bg-whatsapp-dark hover:shadow-md focus-visible:ring-whatsapp",
  secondary:
    "border border-line bg-surface text-ink shadow-2xs hover:bg-surface-container hover:border-line-strong focus-visible:ring-primary",
  ghost:
    "text-ink-soft hover:bg-surface-container hover:text-ink focus-visible:ring-primary",
};

const sizes: Record<Size, string> = {
  md: "h-12 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    href?: undefined;
  };

type ButtonAsAnchor = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", fullWidth, children, className, ...rest },
    ref
  ) {
    const classes = cx(
      base,
      variants[variant],
      sizes[size],
      fullWidth && "w-full",
      className
    );

    if ("href" in rest && rest.href !== undefined) {
      const { href, ...anchorRest } = rest as ButtonAsAnchor;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={classes}
          {...anchorRest}
        >
          {children}
        </a>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...(rest as ButtonAsButton)}
      >
        {children}
      </button>
    );
  }
);
