# -*- coding: utf-8 -*-
"""
Exact Python replica of the prof's sheet 'calculs cremblai-granulats'
(Data/Feuille calculs mélanges_tonne (Intra 2017).xlsx).

TEST ORACLE — DO NOT EDIT TO MAKE TESTS PASS.
This file is the reference the solvers are tested against. It is validated
against 38 cached cell values of the actual workbook (CACHED / self_validate());
it may only change if the professor's workbook itself changes.

Every formula transcribed 1:1 from the extracted cells (D34..D96 chain).
Units: t, m3, rho_w = 1 t/m3 (as in the sheet).

Inputs:
  Gs_r, Gs_g          : specific gravities residue / granulat  (C10, E10)
  w0                  : residue water content, fraction         (C11)
  Cw                  : initial solid mass fraction WITH granulat (D21)
  Bw                  : binder fraction of non-binder solids     (D22)  e.g. 0.045
  Xg                  : granulat mass fraction of non-binder dry solids (D23)
  FS                  : safety factor, additive fraction         (D27)  VT = V*(1+FS)
  binders             : list of (fraction, Gs) — fractions sum to 1 (D28..D33 / C28..C33)
  V_cont              : container volume m3                      (D37)
  nb                  : number of containers (sheet hardcodes 1 in D38; kept general)
  adj = dict(water=D57, granulat=D58, wet_residue=D59)  : adjustment masses (t)
"""

def run(Gs_r, Gs_g, w0, Cw, Bw, Xg, FS, binders, V_cont, nb=1.0,
        adj=None):
    adj = adj or {}
    D57 = float(adj.get("water", 0.0))
    D58 = float(adj.get("granulat", 0.0))
    D59 = float(adj.get("wet_residue", 0.0))

    C12 = 1.0 / (1.0 + w0)                                     # % solide résidu humide

    D34 = 1.0 / (Xg / Gs_g + (1.0 - Xg) / Gs_r)                # Gs résidus+granulat
    D35 = 1.0 / sum(f / gs for f, gs in binders)               # Gs liant composé
    D36 = (1.0 + Bw) / (((1.0 - Xg) / Gs_r + Xg / Gs_g) + Bw / D35)  # Gs pâte

    D37 = V_cont
    D38 = D37 * nb * (1.0 + FS)                                # VT

    D39 = (Cw * D38) / (Cw / D36 + (1.0 - Cw) / 1.0)           # Md solides secs
    D40 = (D36 * (1.0 / Cw - 1.0)) / ((D38 * D36) / D39 - 1.0) # Sr initial

    D41 = (1.0 - Xg) * (D39 / (1.0 + Bw))                      # Mr sec
    D42 = Xg * (D39 / (1.0 + Bw))                              # Mg sec
    D43 = Bw * (D41 + D42)                                     # Mb
    D44 = D39 * (1.0 / Cw - 1.0)                               # Mw
    D45 = D41 * w0                                             # eau dans résidus
    D46 = D41 + D42 + D43 + D44                                # tonnage total
    D26 = D44 / D43 if D43 else 0.0                            # W/C initial
    D49 = D41 / C12                                            # Mr humide
    D50 = D44 - D45                                            # eau à ajouter (peut être <0)
    D5x = [D43 * f for f, gs in binders]                       # masses par liant (D51..)

    # ---- initial-state geotech (side cells) ----
    F30 = 1.0 / (Cw / D36 + (1.0 - Cw) / 1.0)                  # rho_h initial
    F32 = F30 * Cw                                             # rho_d initial (=F30/(1/Cw))
    E30 = D36 / F32 - 1.0                                      # e initial
    n0  = E30 / (1.0 + E30)
    Cv0 = 1.0 / (1.0 + E30)

    # ---- Adjustments ----
    D60 = D59 * C12                                            # résidu sec corresp.
    D61 = D60 / Gs_r                                           # vol résidu ajouté
    D62 = D58 / Gs_g                                           # vol granulat ajouté
    D65 = (D60 + D58) * Bw                                     # liant à ajouter
    D63 = D65 / D35                                            # vol liant ajouté
    D64 = D57 + (D59 - D60)                                    # eau corresp. (m3 = t)
    D6x = [D65 * f for f, gs in binders]                       # liants à ajouter (D66..)

    Vadd = D61 + D62 + D63 + D64

    # ---- Final geotech ----
    D78 = (D44 + D64) / (D43 + D65) if (D43 + D65) else 0.0    # W/C final
    D79 = (D44 + D64) / (D41 + D42 + D43 + D58 + D60 + D65)    # w final
    D81 = 1.0 / (1.0 + D79)                                    # Cw final
    D80 = (D79 * (D41 + D42 + D43 + D44 + D57 + D58 + D59 + D65) * D81) / (D38 + Vadd)  # theta
    D82 = (D41 / Gs_r + D42 / Gs_g + D43 / D35 + D61 + D62 + D63) / (D38 + Vadd)        # Cv final
    D83 = (D42 + D58) / (D41 + D60 + D42 + D58) if (D41 + D60 + D42 + D58) else 0.0     # %m granulat final
    D84den = (D42 / Gs_g + D41 / Gs_r + D61 + D62)
    D84 = (D42 / Gs_g + D62) / D84den if D84den else 0.0        # %vol granulat p/r résidus
    D85 = (D42 / Gs_g + D62) / (D38 + Vadd)                     # %vol granulat p/r remblai
    D86 = (D36 * (D38 + Vadd) / (D39 + D58 + D60 + D65)) - 1.0  # e final
    D87 = D36 * D79 / D86 if D86 else 0.0                       # Sr final
    D88 = D86 / (1.0 + D86)                                     # n final
    D89 = (D43 + D65) / (D41 + D42 + D58 + D60)                 # Bw final
    D90 = D89 * (D34 / D35)                                     # Bv final
    D95 = (1.0 + D89) / (1.0 / D34 + D89 / D35)                 # rho_s final
    D93 = D95 / (1.0 + D86)                                     # rho_d final
    D91 = D93 * (1.0 + D79)                                     # rho_h final
    D92 = D91 * 9.81
    D94 = D93 * 9.81
    D96 = D95 * 9.81

    # our-app-style "eau à ajouter" after adjustment (not a sheet cell):
    Mr_sec_tot = D41 + D60
    eau_a_ajouter_finale = (D44 + D64) - w0 * Mr_sec_tot

    return {
        # inputs echo
        "VT": D38, "Gs_rg": D34, "Gs_liant": D35, "Gs_pate": D36,
        # base state
        "Md": D39, "Sr0": D40, "Mr_sec": D41, "Mg_sec": D42, "Mb": D43,
        "Mw": D44, "Mw_res": D45, "tonnage": D46, "WC0": D26,
        "Mr_hum": D49, "Mw_add": D50, "Mliants": D5x,
        "rho_h0": F30, "rho_d0": F32, "e0": E30, "n0": n0, "Cv0": Cv0,
        # adjustment intermediates
        "adj_res_sec": D60, "adj_liant": D65, "adj_eau": D64,
        "adj_liants": D6x, "Vadd": Vadd,
        # final state
        "WCf": D78, "wf": D79, "thetaf": D80, "Cwf": D81, "Cvf": D82,
        "Xg_m_f": D83, "Xg_v_res_f": D84, "Xg_v_remb_f": D85,
        "ef": D86, "Srf": D87, "nf": D88, "Bwf": D89, "Bvf": D90,
        "rho_hf": D91, "gamma_hf": D92, "rho_df": D93, "gamma_df": D94,
        "rho_sf": D95, "gamma_sf": D96,
        # totals after adjustment (préparation view)
        "Mr_sec_tot": Mr_sec_tot, "Mg_tot": D42 + D58, "Mb_tot": D43 + D65,
        "Mw_tot": D44 + D64, "Mr_hum_tot": Mr_sec_tot * (1.0 + w0),
        "eau_a_ajouter_finale": eau_a_ajouter_finale,
    }


# ----------------------------------------------------------------------
# Self-validation against the cached values of the workbook (Mélange 1)
# ----------------------------------------------------------------------
CACHED = {
    "Gs_rg": 3.05, "Gs_liant": 2.946774193548387, "Gs_pate": 3.0454060859946805,
    "VT": 11000.0, "Md": 14532.294052577276, "Sr0": 0.9999999999999997,
    "Mr_sec": 13906.501485719882, "Mg_sec": 0.0, "Mb": 625.7925668573947,
    "Mw": 6228.126022533119, "Mw_res": 4391.526784964175,
    "tonnage": 20760.420075110396, "WC0": 9.952380952380953,
    "Mr_hum": 18298.02827068406, "Mw_add": 1836.5992375689439,
    "rho_h0": 1.887310915919127, "rho_d0": 1.321117641143389,
    "e0": 1.3051740368548632,
    "WCf": 9.953179939180222, "wf": 0.4286058347015407,
    "thetaf": 0.5662129923669942, "Cwf": 0.6999831414022725,
    "Cvf": 0.43378700763300565, "ef": 1.3052788174929026,
    "Srf": 0.9999999999999994, "nf": 0.5662129923669943,
    "Bwf": 0.045, "Bvf": 0.04657635467980295,
    "rho_hf": 1.8872705854379703, "gamma_hf": 18.51412444314649,
    "rho_df": 1.3210575930709763, "gamma_df": 12.959574988026278,
    "rho_sf": 3.0454060859946805, "gamma_sf": 29.87543370360782,
    "Xg_m_f": 0.0, "Xg_v_remb_f": 0.0,
}

def self_validate(verbose=True):
    w0 = 1.0 / 0.76 - 1.0
    out = run(
        Gs_r=3.05, Gs_g=2.8, w0=w0, Cw=0.70, Bw=0.045, Xg=0.0, FS=0.0,
        binders=[(0.2, 3.15), (0.8, 2.9)],  # GU, Slag
        V_cont=55.0 * 20.0 * 10.0, nb=1.0,
        adj={"water": 0.5},
    )
    worst = 0.0
    fails = []
    for k, exp in CACHED.items():
        got = out[k]
        if exp == 0.0:
            d = abs(got)
        else:
            d = abs(got / exp - 1.0)
        worst = max(worst, d)
        if d > 1e-9:
            fails.append((k, exp, got, d))
    # per-binder masses D51 (GU), D54 (Slag)
    for got, exp, name in [(out["Mliants"][0], 125.15851337147895, "M_GU"),
                           (out["Mliants"][1], 500.6340534859158, "M_Slag")]:
        d = abs(got / exp - 1.0)
        worst = max(worst, d)
        if d > 1e-9:
            fails.append((name, exp, got, d))
    if verbose:
        print(f"[excel_twin] self-validation vs {len(CACHED)+2} cached workbook values: "
              f"worst rel diff = {worst:.2e} -> {'PASS' if not fails else 'FAIL'}")
        for k, exp, got, d in fails:
            print(f"   FAIL {k}: excel={exp!r} twin={got!r} rel={d:.2e}")
    return not fails

if __name__ == "__main__":
    import sys
    ok = self_validate()
    sys.exit(0 if ok else 1)
