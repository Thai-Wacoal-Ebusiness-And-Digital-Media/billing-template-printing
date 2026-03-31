# Billing Template Printing — Multi-Document PDF Generator

## Problem

Every month, credit-card charges (foreign subscriptions + Thai services) require a set of Thai accounting documents to be filled and submitted. The forms are always the same pre-printed physical paper but the variable data changes each month. This app automates filling in the variable data.

## Solution

A Next.js web app where the user enters charge records. The app generates a **text-only PDF** (white background) with all variable data placed at exact pixel positions matching the pre-printed physical form. The user loads the physical form into the printer and prints the text layer on top.

---

## Document Types

| Key | Name | Required for |
|---|---|---|
| `credit_card` | จ่ายบัตรเครดิต | All charges |
| `pnd54` | รายการนำส่งภาษีหัก ณ ที่จ่าย (ภ.ง.ด.54) *ภาษีออกให้* | Foreign (USD) only |
| `ppnd36` | รายการนำส่งภาษี (ภ.พ.36) | All charges |

## Charge Types

- **Foreign** (e.g. Claude.AI, USD) → generates: จ่ายบัตรเครดิต + ภ.ง.ด.54 + ภ.พ.36
- **Domestic** (Thai service, THB) → generates: จ่ายบัตรเครดิต + ภ.พ.36

Multiple charges on the same month share a single document page (multi-line).

---

## Tax Calculation

**WHT (Withholding Tax)** — gross-up formula (ภาษีออกให้):
```
wht = thb_amount × 5 / 95
```

All amounts are entered in THB by the user. For foreign services, the USD amount and exchange rate are entered for the formula display line in the document (audit trail only).

---

## Position Configuration

Field positions are defined in `config/templates.json`. Coordinates are in pixels, derived from `public/templates/credit_card.png` (1275×915 px — the variable text layer exported from the Photoshop PSD).

To adjust a misaligned field: edit the `x`/`y` values in `config/templates.json` — no code changes needed.

---

## Adding a New Template (ภ.ง.ด.54 / ภ.พ.36)

1. Export the PSD variable layer as PNG → place in `public/templates/<key>.png`
2. Open `config/templates.json`, find the document key (e.g. `pnd54`)
3. Set `pageWidth`, `pageHeight` to match the PNG dimensions
4. Add field `x`/`y` coordinates by inspecting pixel positions in the PNG
5. Set `lineItems.startY`, `lineItems.lineHeight`, etc.
6. Restart dev server — the template will be included in the generated PDF

---

## Tech Stack

- **Next.js 15** (App Router)
- **PDFKit** — server-side PDF generation
- **Tailwind CSS** — form UI
- **THSarabunNew** — Thai font for proper rendering

---

## File Structure

```
billing-template-printing/
├── app/
│   ├── page.tsx                     # Form UI
│   └── api/generate-pdf/route.ts   # POST → returns PDF buffer
├── config/
│   └── templates.json              # All field positions & charge type config
├── lib/
│   ├── pdf-generator.ts            # Core PDF generation logic
│   └── thai-number.ts              # Converts amount → Thai text (บาทถ้วน)
├── public/
│   ├── fonts/THSarabunNew.ttf
│   └── templates/credit_card.png   # Reference PNG for position calibration
└── docs/
    └── plan.md                     # This file
```
