"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Compartir el catálogo (cierra el "camino de venta": el vendedor manda el
 * enlace y el cliente responde su pedido por el mismo WhatsApp).
 *
 * - En móvil con soporte, usa la Web Share API nativa (WhatsApp, mensajes, etc.).
 * - Fallback universal: abre WhatsApp con el enlace listo para reenviar.
 *
 * La URL base se toma de `window.location.origin` para funcionar igual en
 * local, preview y producción sin configurar nada.
 */

const MENSAJE =
  "Mira el catálogo de Telas La Jalisciense 👉 {url}\n\nElige tus telas y mándame por aquí tu pedido. 🧵";

export function ShareCatalog({
  variant = "secondary",
  size = "md",
  label = "Compartir",
  className,
}: {
  variant?: "primary" | "whatsapp" | "secondary" | "ghost";
  size?: "md" | "lg";
  label?: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    // El catálogo se comparte siempre desde el inicio.
    setUrl(window.location.origin);
  }, []);

  const compartir = async () => {
    const texto = MENSAJE.replace("{url}", url);

    // Web Share API nativa (principalmente móvil).
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Telas La Jalisciense",
          text: "Mira el catálogo de Telas La Jalisciense y arma tu pedido:",
          url,
        });
        return;
      } catch {
        // El usuario canceló o no se pudo: caemos al fallback de WhatsApp.
      }
    }

    // Fallback: WhatsApp sin número → deja elegir contacto.
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={compartir}
      className={className}
      aria-label="Compartir el catálogo"
    >
      <Share2 className="h-5 w-5" aria-hidden />
      {label}
    </Button>
  );
}
