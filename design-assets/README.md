# EstateLab Design Assets

Designpakke for bruk av cowork-agenter og eksterne designere. Inneholder brand-elementer, fargepalett, typografi og komponentreferanser fra EstateLab Rent Roll Viewer (app.estatelab.no).

## Innhold

### Logofiler
| Fil | Format | Storrelse | Beskrivelse |
|-----|--------|-----------|-------------|
| `estatelab-logo.svg` | SVG | 107x28 | Hovedlogo med prateboble-ikon og "estatelab" tekst. Mork tekst (#111928), lilla gradient-ikon (#A635FF til #6A35FF) |
| `favicon.png` | PNG | 64x64 | Favicon — lilla prateboble med tre hvite prikker |
| `apple-touch-icon.png` | PNG | 180x180 | Apple-touch-icon for iOS-bokmerker |

### Brand-bilder
| Fil | Beskrivelse |
|-----|-------------|
| `estatelab-og-image.png` | Open Graph / social media-bilde. Mork lilla gradient-bakgrunn, hvit tekst, EstateLab-logo |
| `estatelab-feature-1.png` | Partnerlogo: integrert tjeneste |
| `estatelab-feature-2.png` | Partnerlogo: integrert tjeneste |
| `estatelab-feature-3.png` | Partnerlogo: integrert tjeneste |
| `estatelab-feature-4.png` | Partnerlogo: PowerOffice Go |

### Designguide
Se `DESIGN_GUIDELINES.md` i rotmappen for komplett spesifikasjon av:
- Fargepalett (brand, semantisk, noytral)
- Typografi (font, storrelser, vekter)
- Komponentmoenstre (KPI-kort, tabeller, sidebar, badges)
- Layout-regler (spacing, border-radius, grid)
- Ikonbibliotek (Lucide React)

## Brand-farger (hurtigreferanse)

```
Primaer lilla gradient:  #A635FF -> #6A35FF
Logo-tekst:              #111928
Emerald (positivt):      #10B981
Amber (advarsel):        #F59E0B
Rod (negativt):          #EF4444
Bakgrunn:                #FFFFFF
Border:                  #F3F4F6
Tekst primaer:           #111928
Tekst sekundaer:         #6B7280
```

## Font

**Inter** — lastet via Google Fonts / next/font. Brukes som `--font-sans`.

Alternativt fra brand-siden: Satoshi og Switzer (Fontshare).

## Bruk

Gi denne mappen + `DESIGN_GUIDELINES.md` til en cowork-agent med instruksjonen:

> Bruk filene i design-assets/ og DESIGN_GUIDELINES.md som referanse for farger, typografi, komponentstil og brand-identitet. Folg eksisterende moenstre fra dashboardet.
