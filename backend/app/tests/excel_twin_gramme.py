# -*- coding: utf-8 -*-
"""
Exact Python replica of the prof's sheet 'Calculs ingredients (en gr)'
(Data/Feuille calculs remblais_TBelem_en gramme (1).xlsx) — RPC/RPCg lab sheet,
(c) Tikou Belem 2016.

TEST ORACLE — DO NOT EDIT TO MAKE TESTS PASS.
This file is the reference the solvers are tested against under the « gramme »
convention. It is validated against 28 cached cell values of the actual
workbook (CACHED / self_validate()); it may only change if that workbook does.

Structural clone of excel_twin.py (the tonne / Intra 2017 sheet). The base
recipe chain (D34..D50, D78..D90) is IDENTICAL. The ONLY divergence is the
essai binder rule at D65 (see Issues.md #4):

    Intra 2017:  D65 = (D60 + D58) * Bw   # liant ajouté = résidu + granulat
    Gramme:      D65 =  D60       * Bw     # liant ajouté = RÉSIDU ajouté seul

Units are the sheet's native grams / cm3 (rho_w = 1 g/cm3), exactly as the
tonne twin uses tonnes / m3 (rho_w = 1 t/m3). The golden test feeds the twin
and the solver the same physical scenario in consistent units and compares.
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
    F32 = F30 * Cw                                             # rho_d initial
    E30 = D36 / F32 - 1.0                                      # e initial
    n0  = E30 / (1.0 + E30)
    Cv0 = 1.0 / (1.0 + E30)

    # ---- Adjustments ----
    D60 = D59 * C12                                            # résidu sec corresp.
    D61 = D60 / Gs_r                                           # vol résidu ajouté
    D62 = D58 / Gs_g                                           # vol granulat ajouté
    D65 = D60 * Bw                                             # liant à ajouter (GRAMME : résidu seul)
    D63 = D65 / D35                                            # vol liant ajouté
    D64 = D57 + (D59 - D60)                                    # eau corresp. (cm3 = g)
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
    # rho/gamma (D91..D96) : absents de la feuille gramme mais calculables via
    # les mêmes formules qu'Intra 2017 (utiles au golden test, non épinglés).
    D95 = (1.0 + D89) / (1.0 / D34 + D89 / D35)                 # rho_s final
    D93 = D95 / (1.0 + D86)                                     # rho_d final
    D91 = D93 * (1.0 + D79)                                     # rho_h final
    D92 = D91 * 9.81
    D94 = D93 * 9.81
    D96 = D95 * 9.81

    Mr_sec_tot = D41 + D60
    eau_a_ajouter_finale = (D44 + D64) - w0 * Mr_sec_tot

    return {
        "VT": D38, "Gs_rg": D34, "Gs_liant": D35, "Gs_pate": D36,
        "Md": D39, "Sr0": D40, "Mr_sec": D41, "Mg_sec": D42, "Mb": D43,
        "Mw": D44, "Mw_res": D45, "tonnage": D46, "WC0": D26,
        "Mr_hum": D49, "Mw_add": D50, "Mliants": D5x,
        "rho_h0": F30, "rho_d0": F32, "e0": E30, "n0": n0, "Cv0": Cv0,
        "adj_res_sec": D60, "adj_liant": D65, "adj_eau": D64,
        "adj_liants": D6x, "Vadd": Vadd,
        "WCf": D78, "wf": D79, "thetaf": D80, "Cwf": D81, "Cvf": D82,
        "Xg_m_f": D83, "Xg_v_res_f": D84, "Xg_v_remb_f": D85,
        "ef": D86, "Srf": D87, "nf": D88, "Bwf": D89, "Bvf": D90,
        "rho_hf": D91, "gamma_hf": D92, "rho_df": D93, "gamma_df": D94,
        "rho_sf": D95, "gamma_sf": D96,
        "Mr_sec_tot": Mr_sec_tot, "Mg_tot": D42 + D58, "Mb_tot": D43 + D65,
        "Mw_tot": D44 + D64, "Mr_hum_tot": Mr_sec_tot * (1.0 + w0),
        "eau_a_ajouter_finale": eau_a_ajouter_finale,
    }


# ----------------------------------------------------------------------
# Self-validation vs cached values of the workbook (Recette 1, sans ajustement)
# Inputs : Cw=0.73, Bw=0.05, Gs_res=3.0, granulat=0, w0=0 (résidu sec),
# GU20/Slag80 -> Gs_liant=2.9468, moule Ø2"x4" x10 x(1+0.25) -> VT=2574.07 cm3.
# ----------------------------------------------------------------------
CACHED = {
    "Gs_rg": 3.0, "Gs_liant": 2.946774193548387, "Gs_pate": 2.997421875,
    "VT": 2574.0739938152888, "Md": 3659.0419447974487,
    "Sr0": 0.9999999999999996,
    "Mr_sec": 3484.8018521880463, "Mg_sec": 0.0, "Mb": 174.24009260940232,
    "Mw": 1353.3442809524806, "Mw_res": 0.0,
    "tonnage": 5012.3862257499295, "WC0": 7.767123287671231,
    "Mr_hum": 3484.8018521880463, "Mw_add": 1353.3442809524806,
    "WCf": 7.767123287671231, "wf": 0.36986301369863006,
    "thetaf": 0.5257596651083661, "Cwf": 0.7300000000000001,
    "Cvf": 0.47424033489163375, "ef": 1.1086354880136988,
    "Srf": 0.9999999999999996, "nf": 0.5257596651083662,
    "Bwf": 0.05, "Bvf": 0.05090311986863712,
    "Xg_m_f": 0.0, "Xg_v_res_f": 0.0, "Xg_v_remb_f": 0.0,
}


def self_validate(verbose=True):
    out = run(
        Gs_r=3.0, Gs_g=2.7, w0=0.0, Cw=0.73, Bw=0.05, Xg=0.0, FS=0.25,
        binders=[(0.2, 3.15), (0.8, 2.9)],  # GU, Slag
        V_cont=205.92591950522308, nb=10.0,
    )
    worst = 0.0
    fails = []
    for k, exp in CACHED.items():
        got = out[k]
        d = abs(got) if exp == 0.0 else abs(got / exp - 1.0)
        worst = max(worst, d)
        if d > 1e-9:
            fails.append((k, exp, got, d))
    # per-binder masses D51 (GU 20 %), D54 (Slag 80 %)
    for got, exp, name in [(out["Mliants"][0], 34.84801852188047, "M_GU"),
                           (out["Mliants"][1], 139.39207408752188, "M_Slag")]:
        d = abs(got / exp - 1.0)
        worst = max(worst, d)
        if d > 1e-9:
            fails.append((name, exp, got, d))
    if verbose:
        print(f"[excel_twin_gramme] self-validation vs {len(CACHED)+2} cached "
              f"values: worst rel diff = {worst:.2e} -> {'PASS' if not fails else 'FAIL'}")
        for k, exp, got, d in fails:
            print(f"   FAIL {k}: excel={exp!r} twin={got!r} rel={d:.2e}")
    return not fails


if __name__ == "__main__":
    import sys
    sys.exit(0 if self_validate() else 1)
