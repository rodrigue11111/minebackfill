# Formula Library - TODO (mise a jour)

Source de verite:
- `S5_Chap4_GNM1002-H2026_Calculs des melanges de remblais miniers cimentes.pdf`

## 1. Avancement des groupes demandes dans `CODEX_PROMPT_formulas.md`

- [x] Groupe 1 - `F070` a `F074` (Methode 2 labo, p.45-46)
- [x] Groupe 2 - `F075` a `F082` (Formulaire BF, p.48)
- [x] Groupe 3 - `F083` a `F086` (PAF Av/Bv, p.60)
- [x] Groupe 4 - `F087` a `F089` (PAF Cv/rho_d/Sr, p.62)
- [x] Groupe 5 - `F090` a `F092` (CRF intermediaires, p.68-70)
- [x] Groupe 6 - `F093` a `F096` (utilitaires, p.32-34)
- [x] Groupe 7 - `F097` (usure conduite, p.81)

## 2. Corrections appliquees sur les formules existantes

- [x] `F012` simplifiee en relation cohérente `Cw = 1/(1+w) = rho_d/rho_s`.
- [x] `F022` texte brut aligne avec le ratio des densites residus/liant.
- [x] `F030` harmonisee avec la forme Dia.30 `W/C = ((1-Cw)/Cw)*(1/Bw + 1)`.
- [x] `F037` corrigee vers une forme dimensionnellement coherente de `rho_h`.

## 3. Liens de derivation

- [x] Mise a jour des liens parents/enfants pour les chaines impactees (`F007`, `F010`, `F022`, `F027`, `F032`, `F037`, `F043`, `F053`, `F054`, `F055`, `F056`, `F057`).
- [x] Ajout des references `derivedFrom` pour `F070` a `F097`.

## 4. Points a reverifier en lecture metier

- [ ] Verification finale metier de la convention d'unites de `D1`/`D2` (retardateur CRF) selon vos feuilles labo.
- [ ] Verification finale metier de la forme pratique de `F096` selon la convention `rho_w = 1 g/cm3`.

## 5. Ajouts complementaires (disponibilite/visibilite)

- [x] `F098` forme explicite `Cw% = f(W/C, Bw%)`.
- [x] `F099` forme explicite `W/C = f(Cw%, Bw%)`.
- [x] `F100` forme `rho_h = rho_s(1-n)(1+w)`.
- [x] `F101` volume solide `Vs = Cv*VT`.
- [x] `F102` volume des vides `Vv = VT - Vs = VT*(1-Cv)`.
- [x] `F103` modele predictif `Cw%` selon slump.
- [x] Alias `Cc/c_c` integres dans `F017`, `F018`, `F019` + nouvelle formule `F104` (Dia.14).

---

Derniere mise a jour: 2026-03-03
