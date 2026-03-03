# Codex Task — Verify & Complete the Formula Library

## Context

This is a Next.js 16 / TypeScript app called **MineBackfill**, an engineering tool for
computing cemented mine backfill mixtures.

A "Formula Library" page was recently added. All formula data lives in a single TypeScript
file. The formulas were extracted from a course PDF using pdfplumber (text layer only — no
OCR). The extraction is **incomplete**: approximately 26 formulas documented in the TODO
file are still missing.

Your job:
1. **Read the PDF** (using pdfplumber — it is already installed in the Python venv).
2. **Verify every existing formula** in `formulas-data.ts` against the PDF pages cited.
   Fix any LaTeX expression, variable list, keyword, or derivation link that is wrong.
3. **Add every missing formula** listed in the TODO file and any others you find in the PDF
   that are not yet present. Do not invent formulas — every entry must trace back to a
   specific page in the PDF.
4. **Update `derivationLinks`** so parent↔child relationships are consistent in both
   directions (if F005 says `derivesInto: ["F031"]`, then F031 must say
   `derivedFrom: ["F005"]`).
5. **Update `formulas-TODO.md`** by checking off completed items and adding any newly
   discovered gaps.

---

## File locations

```
minebackfill/
├── S5_Chap4_GNM1002-H2026_Calculs des mélanges de remblais miniers cimentés.pdf  ← SOURCE OF TRUTH
├── frontend/src/lib/
│   ├── formulas-data.ts     ← EDIT THIS — TypeScript array of Formula objects
│   ├── formula-search.ts    ← do not edit (search/normalisation utilities)
│   └── formulas-TODO.md     ← UPDATE THIS — track progress
└── CODEX_PROMPT_formulas.md ← this file
```

---

## TypeScript schema (do not change the interfaces)

```typescript
export interface FormulaVariable {
  symbol: string;        // valid KaTeX — e.g. "\\rho_h", "C_w", "G_s"
  description: string;   // plain French/English text
  unit: string | null;   // e.g. "kg/m³", "%", null
}

export interface DerivationLinks {
  derivedFrom: string[];      // IDs of parent formulas, e.g. ["F009", "F016"]
  derivesInto: string[];      // IDs of child formulas
  derivationNote: string | null;  // short explanation of algebraic step, or null
}

export interface Formula {
  id: string;               // stable, e.g. "F070" — never reuse or renumber existing IDs
  title: string;            // short descriptive title in French
  subtitle: string;         // subsection label
  section: string;          // one of the existing section strings (see §Section names below)
  chapter: string;          // always "Chapitre 4 — Calculs des mélanges"
  pageNumber: number;       // PDF page where the formula appears
  equationLatex: string;    // valid KaTeX string — will be rendered with displayMode: true
  equationPlainText: string;// ASCII-safe version for search indexing
  variables: FormulaVariable[];
  keywords: string[];       // French + English terms users might search for
  contextSnippet: string;   // 1–3 sentence explanation from surrounding text
  derivationLinks: DerivationLinks;
}
```

---

## Allowed `section` strings

Use **exactly** one of these values (copy-paste):

```
"Description des remblais miniers"
"Description des remblais miniers — Quantité de liant"
"Calculs des mélanges au laboratoire"
"Impact du Gs des résidus sur le dosage de liant"
"Calculs des mélanges de remblais mixtes"
"Calculs des mélanges des remblais rocheux"
"Calculs des mélanges à l'usine de remblai"
```

If a formula belongs to a section not in this list, add the new section string and use it
consistently for all formulas in that section.

---

## ID assignment rules

- Existing IDs F001–F069 are frozen — do not renumber or delete them.
- New formulas start at **F070** and increment by 1.
- IDs must be unique across the entire `FORMULAS` array.
- If you are unsure whether a formula is a duplicate of an existing one, keep both and add
  a `derivationNote` explaining the relationship.

---

## Missing formulas to add (from formulas-TODO.md)

Work through these in order. For each group, open the PDF at the cited pages, read the
exact expressions, and create Formula objects with accurate LaTeX.

### Group 1 — F070–F074: Method 2 lab ingredients (p. 45–46, Dias. 45–46)

The PDF shows a second method for computing ingredient masses from known parameters
`Cwf` (final %solid of backfill), `Cwt` (tailings %solid), `Bw`, and total volume `VT`.

Expected formulas to extract:
- `Mt = Cwf * MT / (1 + Bw)` — dry tailings mass
- `Mth = Mt / Cwt` — wet tailings mass (required input)
- `Mb = Bw * Mt` — binder mass
- `Mw = MT * (1 - Cwf)` — total water mass
- `Mw-aj = ρhf*VT*(1-Cwf) - Mt*((1-Cwt)/Cwt)` — water to add to mixer

Set `derivedFrom` referencing the relevant Méthode 1 formulas (F037–F043) and each other
where algebraically derived.

### Group 2 — F075–F082: BF worksheet formulas (p. 48, Dia. 48)

The PDF (Dia. 48) lists 8 numbered formulas [1]–[8] for computing geotechnical properties
of a cemented backfill (BF) sample. Extract each one individually.

From the partially-decoded text these appear to include:
- `[1]` Mass of BF mixture: `M_BF/Y = ρh_BF * V_BF`
- `[2]` Density of binder blend: `1/ρs-liant = Σ(xi / ρs-cem_i)`
- `[3]` water content: `w%_BF = (1/Cw_BF - 1) * 100`
- `[4]` Wet density: `ρh_BF = ρd_BF * (1 + w%_BF/100)`
- `[5]` Void ratio: `e0_BF = (w%_BF/100) * (Gs_BF / Sr)`
- `[6]` Dry density from void ratio: `ρd_BF = ρs_BF / (1 + e0_BF)`
- `[7]` Solid volume content: `Cv_BF = 1/(1 + e0_BF)`
- `[8]` Bulk density with water content: `ρh_BF = ρd_BF * (1 + w%_BF/100)`

**Important**: open the actual PDF page 48 and read the exact expressions — the list above
is a best-effort interpretation of garbled extraction text. Correct anything that does not
match the PDF.

### Group 3 — F083–F086: PAF aggregate volume content and binder volume (p. 60, Dia. 60)

- `Av = Am / (Am + (1-Am)*(ρs-ag/ρs-t))` — volumetric aggregate fraction
- `Bv = Bw * (ρs-t+ag_effective / ρs-b)` — volumetric binder ratio for PAF (full form
  with multi-component binder from Dia. 60)
- Relation `Av ↔ av` (analogous to Am↔am)

Set `derivedFrom: ["F054"]` (Am↔am) and `derivedFrom: ["F022"]` (Bv).

### Group 4 — F087–F089: PAF solid volume, dry density, degree of saturation (p. 62, Dia. 62)

- `Cv-PAF = 1/(1 + e_PAF)` where `e_PAF = Cw-PAF * ρbulk / ρs-PAF - 1` — solid volume
  content of PAF
- `ρd-PAF = Cw-PAF * ρbulk-PAF` — PAF dry density
- `Sr-PAF = ...` — degree of saturation of fresh PAF (extract exact form from Dia. 62)

Set `derivedFrom: ["F053"]` (ρs-PAF) and `derivedFrom: ["F025"]` (ρbulk pattern).

### Group 5 — F090–F092: CRF detailed intermediate masses (p. 68–70, Dias. 68–70)

- `M_SR = D1 * Mc` — mass of setting retarder (D1 in ml/g, Mc in g)
- `V_SR = D2 * Mc` — volume of setting retarder
- `V_c-slurry = M_CRF * Bw / (1+Bw*(1+W/C)) * (1/ρc + W/C/ρw + D2)` — volume of cement
  slurry (extract exact form from Dia. 70 — this expression is complex)

Set `derivedFrom: ["F055", "F056", "F057"]`.

### Group 6 — F093–F096: Short utility formulas (p. 32–34)

These are small but frequently needed:
- `ρd = ρh * Cw` — dry density directly from wet density (Dia. 33)
- `γd = ρd * g = 9.81 * ρd` — dry unit weight in kN/m³ (Dia. 33)
- `Cv = 1 - ρd/ρs` — volumetric solid content from dry density (Dia. 32)
- `Sr = (w * ρd) / ((ρs - ρd) * ρw / ρw)` — saturation from ρd, ρs, Dia. 34 form

Set `derivedFrom` referencing F007 (ρd), F027 (γh), F010 (Cv), F032 (Sr).

### Group 7 — F097: Pipeline wear formula (p. 81, Dia. 81) — low priority

- `Wear = c * V^p` (Archibald 2003) — pipe wear model

Add even though it is empirical. Set `section: "Calculs des mélanges à l'usine de remblai"`.

---

## Verification checklist for existing formulas

For each of F001–F069, verify:

| Check | What to look for |
|-------|-----------------|
| `equationLatex` | Must be valid KaTeX. Test mentally: fractions use `\frac{}{}`, subscripts `_{}`, superscripts `^{}`. Greek letters: `\rho`, `\gamma`, `\alpha`, `\theta`. |
| `pageNumber` | Must match a real page in the 83-page PDF |
| `variables` | Every symbol appearing in the equation must be listed. No orphan symbols. |
| `derivedFrom` / `derivesInto` | Must be consistent: if F005 lists F031 in `derivesInto`, then F031 must list F005 in `derivedFrom`. |
| `contextSnippet` | Must not contradict the PDF. |

Known issues to fix (found during initial extraction):
- F012 `equationLatex` contains a circular reference in the last term — simplify.
- F022 `equationPlainText` says `Bv = Vb/Vt = Bw * (rho_s-residus / rho_s-liant)` —
  verify this matches Dia. 16 exactly (the PDF shows `ρs_résidus / ρs_liant`).
- F030: check whether the formula `E/L = (1-Cw)/(Cw*Bw)` holds strictly for `Sr = 1`
  only or for any Sr. Add a note if Sr-dependent.
- F037 `equationLatex` contains `ρh = ρs/(Cw + (1-Cw)*Gs/Sr)` — this is dimensionally
  inconsistent (ρs in numerator but Gs is dimensionless); verify against p. 41 and fix.
- F069: the formula `Mw-aj` on p. 83 — confirm coefficient order from Dia. 83 solution table.

---

## LaTeX formatting rules

```
✅ Correct                         ❌ Wrong
\frac{M_w}{M_s}                   Mw/Ms  (use \frac for fractions)
\rho_h                             ρ_h or rho_h
G_s                               Gs  (subscripts always in braces when > 1 char)
C_{w\text{-PAF}}                   C_w-PAF
\left(\frac{a}{b}\right)          (\frac{a}{b})  (use \left \right for tall fractions)
1 - C_w                           (1-Cw)
\sum_{i=1}^{N}                    Σ
^{-1}                             ^(-1) or ⁻¹
\cdot                             · or *  (use \cdot for multiplication dots)
\text{rés}                        rés  (use \text{} for non-math words in subscripts)
```

For display-mode equations (the default), you can use `\\` for line breaks and `\\quad`
for spacing. Keep each `equationLatex` to a single conceptual equation. If a slide shows
two equivalent forms separated by `=`, you may include both joined by `\\quad \\Leftrightarrow \\quad`
(see F011 as an example).

---

## PDF reading instructions

```python
import pdfplumber

PDF = "S5_Chap4_GNM1002-H2026_Calculs des mélanges de remblais miniers cimentés.pdf"

with pdfplumber.open(PDF) as pdf:
    # text extraction (most pages)
    page = pdf.pages[PAGE_INDEX]   # 0-indexed, so Dia. 45 = page index 44
    text = page.extract_text()

    # table extraction (Dias. 48, 63, 71)
    tables = page.extract_tables()

    # image-based pages: render and inspect visually
    img = page.to_image(resolution=200)
    img.save(f"page_{PAGE_INDEX+1}.png")
```

The PDF has encoding issues with accented characters (`é` → `?`, `è` → `?`). This is
expected — use context to reconstruct meaning. Mathematical symbols are sometimes rendered
as private-use unicode (e.g. `\uf0b3`); cross-check with the surrounding equation structure.

Pages to prioritize: **11, 25, 31, 32, 33, 34, 45, 46, 48, 60, 61, 62, 68, 69, 70, 83**.

---

## Output expectations

1. **Edit `frontend/src/lib/formulas-data.ts`** in place:
   - Keep all existing F001–F069 objects (modify only if verification reveals an error).
   - Append new Formula objects after F069 in ID order.
   - Maintain the section grouping comments (`// ============ SECTION X ...`).
   - The file must compile with `pnpm exec next build` from the `frontend/` directory.

2. **Edit `frontend/src/lib/formulas-TODO.md`** in place:
   - Check off completed items with `[x]`.
   - Add a new section `## 5. Corrections made` listing any errors found and fixed in
     F001–F069.
   - If any formula from the TODO list could not be extracted confidently, leave its
     checkbox unchecked and add a note explaining why (e.g., "image-rendered, OCR needed").

3. **Do not modify** any other file (especially `formula-search.ts`, `page.tsx`, or
   `KaTeXRenderer.tsx`).

4. **Do not hallucinate formulas.** If a page is unreadable or a formula is ambiguous,
   set `equationLatex: "\\text{[extraction incertaine — voir p.XX]}"` and add an honest
   `contextSnippet` explaining the uncertainty.

---

## Validation before finishing

Run these checks before submitting:

```bash
# 1. TypeScript compile
cd frontend && pnpm exec next build

# 2. Check for duplicate IDs
node -e "
const {FORMULAS} = require('./src/lib/formulas-data.ts');  // or use tsx
const ids = FORMULAS.map(f => f.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) console.error('Duplicate IDs:', dupes);
else console.log('All IDs unique ✓', ids.length, 'formulas total');
"

# 3. Check derivation link consistency
node -e "
const {FORMULAS, FORMULA_MAP} = require('./src/lib/formulas-data.ts');
let errors = 0;
for (const f of FORMULAS) {
  for (const pid of f.derivationLinks.derivedFrom) {
    const parent = FORMULA_MAP.get(pid);
    if (!parent) { console.error(f.id, 'derivedFrom unknown ID', pid); errors++; }
    else if (!parent.derivationLinks.derivesInto.includes(f.id)) {
      console.warn(f.id, 'missing in', pid, 'derivesInto');
    }
  }
}
if (!errors) console.log('Derivation links consistent ✓');
"
```

The build must pass with zero TypeScript errors. Warnings from `baseline-browser-mapping`
are expected and can be ignored.

---

## Priority order

1. ✅ Must complete: Groups 1, 2, 6 (Method 2, BF worksheet, utility formulas) — these are
   the most commonly needed formulas and their pages have readable text.
2. Should complete: Groups 3, 4, 5 (PAF volume, CRF intermediates).
3. Nice to have: Group 7 (pipeline wear).
4. If time allows: re-check the F001–F069 verification list.
