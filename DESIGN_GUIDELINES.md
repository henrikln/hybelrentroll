# EstateLab Design Guidelines

Designpakke for cowork-agenter og utviklere. Basert på det eksisterende designsystemet i Hybel.no Rent Roll Viewer (app.estatelab.no).

---

## Brand

- **Produktnavn**: EstateLab
- **Tagline**: Skybasert eiendomsforvaltning for naringseiendom
- **Spraak**: Norsk (bokmal), teknisk men tilgjengelig

## Logo

SVG-logo ligger i `/public/estatelab-logo.svg`. Vises i sidebar-headeren med `h-5`.

Logo-gradient (chat-bubble icon): `linear-gradient(135deg, #A635FF, #6A35FF)` — lilla til dyp lilla. Tre hvite prikker inne i bobla.

Favicon: Lilla prateboble-ikon i PNG-format (`/src/app/icon.png`, 64x64).

## Fargepalett

### Primaerfarger (brand)
| Farge | Hex | Bruksomrade |
|-------|-----|-------------|
| Purple-600 | `#9333ea` | Aktiv sidebar-tekst, fokus-ringer, primaerhandlinger |
| Purple-50 | `#faf5ff` | Aktiv sidebar-bakgrunn |
| Purple-400 | `#c084fc` | Fokus-border pa input/select |
| Teal-500 | `#14b8a6` | Avatar-bakgrunn (initialer) |

### Semantiske farger
| Farge | Tailwind-klasse | Bruksomrade |
|-------|-----------------|-------------|
| Emerald-600 / Emerald-100 | `text-emerald-600`, `bg-emerald-100` | Positivt: utleid, inntekt, opp-trend |
| Emerald-50 / Emerald-600 | `bg-emerald-50`, `text-emerald-600` | Status-badge "aktiv" |
| Amber-500 / Amber-100 | `text-amber-500`, `bg-amber-100` | Advarsel: ledig, varsler |
| Amber-50 / Amber-600 | `bg-amber-50`, `text-amber-600` | Status-badge "ledig" |
| Red-500 / Red-100 | `text-red-500`, `bg-red-100` | Negativt: oppsagt, ned-trend |
| Red-50 / Red-600 | `bg-red-50`, `text-red-600` | Status-badge "oppsagt" |
| Blue-600 / Blue-100 | `text-blue-600`, `bg-blue-100` | Informasjon: areal, enheter |

### Noytraale farger
| Farge | Tailwind-klasse | Bruksomrade |
|-------|-----------------|-------------|
| Gray-900 | `text-gray-900` | Primaertekst, overskrifter |
| Gray-700 | `text-gray-700` | Sekundaertekst, tabellverdier |
| Gray-600 | `text-gray-600` | Sidebar-tekst (inaktiv) |
| Gray-500 | `text-gray-500` | KPI-label, metadata |
| Gray-400 | `text-gray-400` | Tertiaaertekst, section-titler, ikoner |
| Gray-200 | `border-gray-200` | Input-borders |
| Gray-100 | `border-gray-100` | Kort/tabell-borders, sidebar-border |
| Gray-50 | `bg-gray-50` | Hover-bakgrunn, rad-separatorer |
| White | `bg-white` | Kort, sidebar, header, tabeller |

### CSS-variabler (shadcn/ui)
Definert i `globals.css` med oklch-farger. Viktige:
```css
--primary: oklch(0.205 0 0);       /* Naesten svart */
--primary-foreground: oklch(0.985 0 0); /* Naesten hvit */
--muted: oklch(0.97 0 0);          /* Lys gra */
--muted-foreground: oklch(0.556 0 0);   /* Medium gra */
--destructive: oklch(0.577 0.245 27.325); /* Rod */
--border: oklch(0.922 0 0);        /* Lys border */
--radius: 0.625rem;                /* Base radius (10px) */
```

## Typografi

### Font
- **Primaer**: Inter (via `next/font/google`)
- CSS-variabel: `--font-sans`
- Alternativ fra estatelab.no: Satoshi, Switzer (Fontshare)

### Tekststoorrelser (Tailwind)
| Element | Klasser |
|---------|---------|
| Sidetittel (h1) | `text-xl font-semibold text-gray-900` |
| Seksjonstittel (h2) | `text-sm font-semibold text-gray-700` |
| Kort-tittel (h3) | `text-base font-semibold text-gray-900` |
| KPI-verdi | `text-2xl font-bold text-gray-900` |
| KPI-label | `text-sm text-gray-500` |
| Trend-tekst | `text-xs font-medium` + fargeklasse |
| Tabellheader | `text-xs font-medium uppercase tracking-wider text-gray-400` |
| Tabellcelle | `text-sm text-gray-700` eller `text-sm text-gray-600` |
| Sidebar nav-item | `text-sm font-medium` |
| Sidebar section-tittel | `text-xs font-medium uppercase tracking-wider text-gray-400` |
| Broodtekst | `text-sm text-gray-400` |

## Komponentbibliotek

### Ikoner
- **Lucide React** — konsekvent brukt overalt
- Stoorrelser: `h-4 w-4` (inline), `h-5 w-5` (knapper), `h-6 w-6` (KPI-kort)
- Brukte ikoner: `LayoutGrid`, `Building`, `Building2`, `Users`, `Banknote`, `Ruler`, `CalendarClock`, `BarChart3`, `KeyRound`, `Upload`, `Mail`, `Home`, `Maximize`, `History`, `TrendingUp`, `TrendingDown`, `ChevronUp`, `ChevronDown`, `X`, `Plus`, `UserPlus`, `UserMinus`, `RefreshCw`, `ArrowUpDown`, `Shield`, `AlertCircle`

### UI-primitiver (shadcn/ui)
Installerte komponenter i `src/components/ui/`:
- `button`, `card`, `table`, `badge`, `separator`, `avatar`
- `dropdown-menu`, `input`, `scroll-area`, `tooltip`, `sheet`

### Egenutviklede dashboard-komponenter
Alle i `src/components/dashboard/`:

#### KpiCard
```
Hvitt kort med avrundede hjoerner, skygge, border.
Venstre: Farget ikon-boks (12x12, rounded-xl).
Hoeyre: Label + stor verdi + valgfri trend-pil.
Farger: green, blue, purple, amber.
```

#### PropertyList
```
Tabell med sortbare kolonner. Rad-klikk aapner popup.
Farget ikon per eiendom (roterende palette).
Ikoner inline med verdier (Home, Banknote, Maximize).
```

#### TenantTable / UnitTable
```
Sortbare tabeller med klikk-paa-header.
Status-badges med fargekodede piller (rounded-full).
Trend-piler paa leie (TrendingUp/TrendingDown).
Utloepdato i roedt hvis < 3 maaneder.
Ledige enheter: siste leie i kursiv graa.
```

#### Sidebar
```
Fast venstremarg, w-60, full hoyde.
Logo oeverst med "Hybel.no Viewer" tag.
Nav-seksjoner med uppercase titler.
Aktiv: bg-purple-50 text-purple-600.
Inaktiv: text-gray-600 hover:bg-gray-50.
```

#### Topbar
```
Sticky top, h-16, hvit med border-b.
Periodeselektor til venstre.
Brukerinfo + avatar til hoeyre.
```

#### PeriodSelector
```
Kalender-ikon + native <select>.
Border-gray-200, focus:border-purple-400.
Norsk datoformat (2-sifret dag, lang maaned, aar).
```

## Layout-moenster

### Generelle regler
- **Border-radius**: `rounded-xl` (kort, tabeller, modaler), `rounded-lg` (nav-items, ikon-bokser), `rounded-full` (badges, avatarer)
- **Skygge**: `shadow-sm` paa kort, `shadow-lg` paa modaler
- **Border**: `border border-gray-100` paa kort/tabeller
- **Spacing**: `p-5` inne i kort, `gap-4` mellom elementer, `mb-6` mellom seksjoner
- **Grid**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` for KPI-kort

### Sidestruktur
```
<Sidebar w-60 fixed left>
<main ml-60>
  <Topbar sticky>
  <content px-6 py-6>
    <h1 mb-6>
    <KPI-grid mb-6>
    <Tabell/kort>
    <Tilleggsseksjoner i 2-kolonne grid>
  </content>
</main>
```

### Tabellstil
```
- Hvit bakgrunn, rounded-xl, border, shadow-sm
- Header: border-b border-gray-100, text-xs uppercase tracking-wider text-gray-400
- Rader: border-b border-gray-50, hover:bg-gray-50
- Celler: px-4 py-3 (eller px-5 py-3)
- Tall: text-right, font-medium for viktige verdier
```

## Farger fra estatelab.no (brand-side)

Farger hentet direkte fra estatelab.no-kilden:
```
Primaer lilla:     #7335ff / #9c35ff / #A635FF / #6A35FF
Sekundaer lilla:   #8B5CF6 / #9C3AF0 / #A855F7 / #B23BF4 / #C084FC
Emerald:           #10B981
Bakgrunner:        #fafafa / #f5f5f5 / #FAF5FF (lilla tint)
Moerke:            #0a0a0a / #121217 / #030504
Noeytral lys:      #E5E7EB / #F3F4F6
```

Font-familier fra estatelab.no: **Satoshi**, **Switzer**, **Inter**, **Figtree**
(Rent roll-appen bruker Inter via Next.js)
