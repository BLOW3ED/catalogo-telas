# Export de Stitch — "Artisanal Modernity"

Exportado del proyecto de Stitch **Atelier Textil Selecto** (`projects/6466335250001674428`),
asset de design system `assets/9f8dd70e8b7f474d8d53583a639e9611`, el 2026-08-20.
Verificado ese mismo día contra la UI de Stitch (panel Theme + pestaña DESIGN.md):
colores, fuentes, `rounded` y `spacing` coinciden línea por línea con este export.

- `artisanal-modernity.design.md` — el design.md completo (frontmatter YAML con colores,
  tipografía, radios y espaciado + guía de estilo en prosa).
- `artisanal-modernity.theme.json` — el theme crudo del asset (namedColors Material,
  overrides, roundness, escala tipográfica).

## Qué se aplica y qué no (decisión de la tienda, 2026-08-20)

**Tipografía y border-radius de este export SON la norma vigente** — se aplicaron
a `app/globals.css` tal como los declara el design.md:

- **Tipografía**: Hanken Grotesk en TODA la jerarquía (400/600/700). Los tokens
  `--font-display`/`--font-body`/`--font-serif` se conservan por historia y todos
  apuntan a ella.
- **Border-radius**: la escala del frontmatter (`sm` 2px · `DEFAULT` **4px** ·
  `md` 6px · `lg` 8px · `xl` 12px · `full` 9999px — es la escala default de
  Tailwind). `rounded-2xl` se fija en 12px (Stitch no define 2xl) para los
  modales y `rounded-3xl` (24px) queda para bottom-sheets, fuera del vocabulario
  Stitch. Nota: el Tailwind config inline de las pantallas GENERADAS comprimía
  la escala (base 2px); manda el design.md, no el codegen.

**Los colores de este export NO se aplican.** Son de la era navy y la tienda ya
decidió otra paleta:

| Color | Este export (Stitch) | Vigente en el repo |
|---|---|---|
| Primario | Heritage Navy `#0D1B2A` | **Púrpura `#6E4B7A`** (token `heritage-navy`, nombre legado) |
| Acento | Copper `#B07D62` | **Mostaza `#7A4E0D`** |
| Fondo | Sand `#EAE3D2` / surface `#FFF9ED` | Arena `#F1EDE2` / crema `#FFF9ED` (coincide la crema) |

También siguen vigentes (y de aquí salieron): **espaciado** (base 8px, gutter
24px, max-width 1280px, márgenes 64/20px, section-gap 96/48px) y **elevación**
(capas tonales + bordes hairline, sin sombras pesadas).

## Iconos

Las pantallas de Stitch usan **Material Symbols Outlined** (opsz 24, wght 400, FILL 0):
`arrow_forward`, `auto_awesome`, `grid_view`, `person`, `search`, `shopping_bag`, `tune`.
El repo usa **lucide-react**; equivalencias aproximadas: `ArrowRight`, `Sparkles`,
`LayoutGrid`, `User`, `Search`, `ShoppingBag`, `SlidersHorizontal`.

Otros design systems del mismo proyecto (no exportados): Modern Heritage ×2,
Artisanal Heritage, Midnight Heritage.
