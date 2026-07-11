# app/core/mix_pipeline.py
"""
Pipeline de calcul des mélanges — convention "Intra 2017".

Réplique exacte de la feuille de référence du professeur
« Feuille calculs mélanges_tonne (Intra 2017).xlsx », feuille
« calculs cremblai-granulats » (cellules citées en commentaire).

Ce module est de la mathématique pure (pas de Pydantic, pas d'I/O) et il est
partagé par rpc_solver.py et rpg_solver.py : après correction, le calcul RPC
est exactement le cas particulier Xg = 0 du calcul RPG/PAF.

Conventions:
  - fractions 0-1 en interne (Cw, Sr, Bw, Xg, w0) ;
  - masses en kg, volumes en m3, densité de l'eau en kg/m3 ;
  - la feuille Excel n'a pas d'entrée Sr (pâte saturée par construction) :
    à Sr = 1 ce pipeline reproduit la feuille à ~1e-15 ; Sr < 1 est la
    généralisation naturelle (e = w*Gs/Sr, Ms = rho_d*VT).

Décision utilisateur (2026-07-06) : ESSAI_GS_CONVENTION = "base"
(les formules e/Sr/rho_s/Bv de l'essai-erreur gardent le Gs de la composition
de BASE, comme les cellules D34/D36 figées de la feuille). Mettre "recalcule"
pour la variante rigoureuse (Gs recalculé avec la proportion de granulat
ajustée) — écarts <= 0.4 % sur e, rho_s, n lors d'ajouts de granulat.
"""

from __future__ import annotations

from dataclasses import dataclass

# Repli des appels DIRECTS au pipeline (tests unitaires qui monkeypatchent cet
# attribut). Les solveurs, eux, passent la valeur résolue des constantes en
# paramètre explicite (essai_gs_convention=...), ce qui ignore ce global.
ESSAI_GS_CONVENTION = "base"  # "base" (fidèle Excel) | "recalcule" (rigoureux)


# ======================================================================
#  Gs équivalents
# ======================================================================

def gs_nonbinder_eff(gs_r: float, xg_frac: float = 0.0, gs_g: float | None = None) -> float:
    """
    Gs équivalent des solides hors liant (résidus + granulat).  [D34]
        Gs_eff = 1 / (Xg/Gs_g + (1-Xg)/Gs_r)
    """
    if xg_frac <= 0.0 or not gs_g or gs_g <= 0.0:
        return float(gs_r)
    denom = xg_frac / gs_g + (1.0 - xg_frac) / gs_r
    return 1.0 / denom if denom > 0.0 else 0.0


def gs_backfill_eff(gs_r: float, xg_frac: float, gs_g: float | None,
                    bw_frac: float, gs_binder: float) -> float:
    """
    Gs équivalent de la pâte (résidus + granulat + liant).  [D36]
        Gs_pate = (1+Bw) / ((1-Xg)/Gs_r + Xg/Gs_g + Bw/Gs_liant)
    """
    gs_nb = gs_nonbinder_eff(gs_r, xg_frac, gs_g)
    if gs_nb <= 0.0 or gs_binder <= 0.0:
        return 0.0
    denom = 1.0 / gs_nb + bw_frac / gs_binder
    return (1.0 + bw_frac) / denom if denom > 0.0 else 0.0


def cw_from_wc(bw_frac: float, wc: float) -> float:
    """
    Cw impliqué par (Bw, W/C).  [inverse de D26 : wc = (1/Cw - 1)(1+Bw)/Bw]
        Cw = (1+Bw) / (1 + Bw + wc*Bw)
    """
    if bw_frac <= 0.0 or wc <= 0.0:
        return 0.0
    return (1.0 + bw_frac) / (1.0 + bw_frac + wc * bw_frac)


# ======================================================================
#  Recette de base (méthodes Cw, W/C, Slump)
# ======================================================================

@dataclass(frozen=True)
class RecipeQuantities:
    """Toutes les grandeurs d'une recette. Masses kg, volumes m3."""
    gs_backfill: float
    gs_nonbinder: float
    w: float            # teneur en eau massique (fraction)
    e: float            # indice des vides
    n: float            # porosité
    cv: float           # fraction volumique de solides
    theta: float        # teneur en eau volumique (fraction)
    rho_d: float        # kg/m3
    rho_h: float        # kg/m3
    ms_total: float     # solides secs totaux (résidu + granulat + liant)
    mr_sec: float
    mg_sec: float
    mb: float
    mw_total: float
    mr_hum: float
    mw_in_residue: float
    mw_to_add: float    # peut être négatif (eau à retirer)  [D50]
    vr: float
    vg: float
    vb: float
    vw: float
    vs: float
    vv: float
    bv: float           # fraction volumique de liant  [D90]
    wc: float           # rapport eau/ciment massique


def solve_recipe(*,
                 cw_frac: float,
                 sr_frac: float,
                 bw_frac: float,
                 xg_frac: float,
                 gs_r: float,
                 gs_g: float | None,
                 gs_binder: float,
                 w0_frac: float,
                 v_total_m3: float,
                 water_density: float) -> RecipeQuantities:
    """
    Recette selon la convention Intra 2017 :
        Ms_total = rho_d * V_T   [D39]   puis répartition par (1+Bw)  [D41-D44].

    Remplace l'ancienne convention « Vr = Vs » (Modèle C1b 2005) qui gonflait
    toutes les masses d'un facteur exact (1+Bv).
    """
    rho_w = float(water_density)
    sr = max(sr_frac, 1e-9)
    cw = max(min(cw_frac, 1.0), 0.0)

    gs_nb = gs_nonbinder_eff(gs_r, xg_frac, gs_g)
    gs_bkf = gs_backfill_eff(gs_r, xg_frac, gs_g, bw_frac, gs_binder)

    w = (1.0 / cw - 1.0) if cw > 0.0 else 0.0

    e = w * gs_bkf / sr
    n = e / (1.0 + e) if e > -1.0 else 0.0
    cv = 1.0 / (1.0 + e) if e > -1.0 else 0.0
    theta = n * sr  # = Vw/VT ; à saturation theta = n

    rho_d = gs_bkf * rho_w / (1.0 + e) if e > -1.0 else 0.0
    rho_h = rho_d * (1.0 + w)

    # Masses  [D39, D41-D44]
    ms_total = rho_d * v_total_m3
    denom = 1.0 + bw_frac
    mr_sec = (1.0 - xg_frac) * ms_total / denom
    mg_sec = xg_frac * ms_total / denom
    mb = bw_frac * (mr_sec + mg_sec)
    mw_total = w * ms_total

    # Volumes composants (cohérents : Vs = Vr + Vg + Vb = Cv*VT)
    vr = mr_sec / (gs_r * rho_w) if gs_r > 0.0 else 0.0
    vg = mg_sec / (gs_g * rho_w) if (gs_g and gs_g > 0.0) else 0.0
    vb = mb / (gs_binder * rho_w) if gs_binder > 0.0 else 0.0
    vw = mw_total / rho_w
    vs = vr + vg + vb
    vv = v_total_m3 - vs

    # Résidu humide et eau à ajouter  [D49, D50 — sans borne : négatif = retirer]
    mr_hum = mr_sec * (1.0 + w0_frac)
    mw_in_residue = w0_frac * mr_sec
    mw_to_add = mw_total - mw_in_residue

    bv = bw_frac * gs_nb / gs_binder if gs_binder > 0.0 else 0.0   # [D90]
    wc = mw_total / mb if mb > 0.0 else 0.0

    return RecipeQuantities(
        gs_backfill=gs_bkf, gs_nonbinder=gs_nb,
        w=w, e=e, n=n, cv=cv, theta=theta,
        rho_d=rho_d, rho_h=rho_h,
        ms_total=ms_total, mr_sec=mr_sec, mg_sec=mg_sec, mb=mb,
        mw_total=mw_total, mr_hum=mr_hum,
        mw_in_residue=mw_in_residue, mw_to_add=mw_to_add,
        vr=vr, vg=vg, vb=vb, vw=vw, vs=vs, vv=vv,
        bv=bv, wc=wc,
    )


# ======================================================================
#  Essai-erreur (ajustements)  [D57-D96]
# ======================================================================

@dataclass(frozen=True)
class EssaiQuantities:
    """État d'une recette après ajustements. Masses kg, volumes m3."""
    gs_backfill: float   # Gs utilisé pour e/Sr/rho (selon ESSAI_GS_CONVENTION)
    gs_nonbinder: float
    w: float
    cw: float
    wc: float
    e: float
    sr: float            # fraction — vaut exactement Sr de base si rien d'incohérent
    n: float
    cv: float
    theta: float
    bv: float
    rho_d: float
    rho_h: float
    ms_total: float
    mr_sec_tot: float
    mg_sec_tot: float
    mb_tot: float
    mb_ad: float         # liant à ajouter/retirer (négatif possible)  [D65]
    mw_tot: float
    mr_hum_tot: float
    mw_to_add: float     # eau à ajouter/retirer (négatif possible)
    vt_new: float        # volume total après ajouts  [D38 + Vadd]
    vr_new: float
    vg_new: float
    vb_new: float
    vw_tot: float
    vs_new: float
    vv_new: float


def apply_essai_adjustments(*,
                            mr_sec_base: float,
                            mg_sec_base: float,
                            mb_base: float,
                            mw_base: float,
                            vt_base: float,
                            bw_target_frac: float,
                            gs_r: float,
                            gs_g: float | None,
                            gs_binder: float,
                            gs_backfill_base: float,
                            gs_nonbinder_base: float,
                            w0_frac: float,
                            delta_dry_residue: float = 0.0,
                            delta_wet_residue: float = 0.0,
                            delta_water: float = 0.0,
                            delta_aggregate: float = 0.0,
                            aggregate_w0_frac: float = 0.0,
                            water_density: float = 1000.0,
                            essai_gs_convention: str | None = None,
                            essai_binder_rule: str = "solides_totaux") -> EssaiQuantities:
    """
    Applique des ajustements de masses à une recette de base et recalcule
    l'état final selon la feuille Intra 2017 :

      - le liant est ajusté pour maintenir Bw% (négatif = à retirer)  [D65] ;
      - le volume total CROÎT du volume de chaque composant ajouté    [D61-D64] ;
      - e = Gs*rho_w*VT_new/Ms_tot - 1                                [D86] ;
      - Sr = Gs*w/e (reste exactement à la valeur de base)            [D87] ;
      - Cv, theta calculés sur les volumes réels                      [D82, D80].

    Notes de convention :
      - `delta_dry_residue` (entrée propre à l'application, absente de la
        feuille) apporte son eau naturelle w0, comme dans le C# historique ;
      - `delta_aggregate` est sec par défaut (w0_ag = 0, comme la feuille).
    """
    rho_w = float(water_density)

    # -- décomposition des ajouts  [D59-D60, 28]
    sec_from_wet = delta_wet_residue / (1.0 + w0_frac) if (1.0 + w0_frac) > 0.0 else 0.0
    eau_from_wet = delta_wet_residue - sec_from_wet
    eau_from_sec = delta_dry_residue * w0_frac
    eau_from_agr = delta_aggregate * aggregate_w0_frac
    delta_eau_tot = delta_water + eau_from_wet + eau_from_sec + eau_from_agr

    # -- nouvelles masses sèches  [23a]
    mr_sec_tot = mr_sec_base + delta_dry_residue + sec_from_wet
    mg_sec_tot = mg_sec_base + delta_aggregate
    solids_nb = mr_sec_tot + mg_sec_tot

    # -- liant : deux conventions (défaut = Intra 2017, sans borne à 0)
    if essai_binder_rule == "residu_ajoute":
        # Feuille « gramme » [D65] : le liant AJOUTÉ ne répond qu'au RÉSIDU
        # ajouté (pas au granulat, ni à l'eau). mb_tot = base + Bw·(résidu ajouté).
        mb_ad = bw_target_frac * (delta_dry_residue + sec_from_wet)
        mb_tot = mb_base + mb_ad
    else:
        # Intra 2017 : Bw maintenu sur TOUS les solides (résidu + granulat).
        mb_tot = bw_target_frac * solids_nb
        mb_ad = mb_tot - mb_base

    # -- eau totale  [29a]
    mw_tot = mw_base + delta_eau_tot

    # -- volumes ajoutés  [D61-D64]
    v_add = ((delta_dry_residue + sec_from_wet) / (gs_r * rho_w)
             + (delta_aggregate / (gs_g * rho_w) if (gs_g and gs_g > 0.0) else 0.0)
             + mb_ad / (gs_binder * rho_w)
             + delta_eau_tot / rho_w)
    vt_new = vt_base + v_add

    # -- Gs selon la convention choisie. None → lecture du global au moment de
    # l'appel (repli des appels directs monkeypatchés) ; les solveurs passent
    # la valeur résolue explicitement.
    conv = essai_gs_convention if essai_gs_convention is not None else ESSAI_GS_CONVENTION
    if conv == "recalcule":
        xg_new = mg_sec_tot / solids_nb if solids_nb > 0.0 else 0.0
        gs_nb_used = gs_nonbinder_eff(gs_r, xg_new, gs_g)
        gs_bkf_used = gs_backfill_eff(gs_r, xg_new, gs_g, bw_target_frac, gs_binder)
    else:
        gs_nb_used = gs_nonbinder_base
        gs_bkf_used = gs_backfill_base

    # -- paramètres finaux  [D78-D96]
    ms_tot = solids_nb + mb_tot
    w_aj = mw_tot / ms_tot if ms_tot > 0.0 else 0.0
    cw_aj = ms_tot / (ms_tot + mw_tot) if (ms_tot + mw_tot) > 0.0 else 0.0
    wc_aj = mw_tot / mb_tot if mb_tot > 0.0 else 0.0

    e_aj = (gs_bkf_used * rho_w * vt_new / ms_tot - 1.0) if ms_tot > 0.0 else 0.0   # [D86]
    sr_aj = gs_bkf_used * w_aj / e_aj if e_aj > 0.0 else 1.0                        # [D87]
    n_aj = e_aj / (1.0 + e_aj) if e_aj > -1.0 else 0.0                              # [D88]

    vr_new = mr_sec_tot / (gs_r * rho_w) if gs_r > 0.0 else 0.0
    vg_new = mg_sec_tot / (gs_g * rho_w) if (gs_g and gs_g > 0.0) else 0.0
    vb_new = mb_tot / (gs_binder * rho_w) if gs_binder > 0.0 else 0.0
    vs_new = vr_new + vg_new + vb_new
    vw_tot = mw_tot / rho_w
    vv_new = vt_new - vs_new

    cv_aj = vs_new / vt_new if vt_new > 0.0 else 0.0        # [D82]
    theta_aj = vw_tot / vt_new if vt_new > 0.0 else 0.0     # [D80]
    bv_aj = bw_target_frac * gs_nb_used / gs_binder if gs_binder > 0.0 else 0.0  # [D90]

    rho_d_aj = gs_bkf_used * rho_w / (1.0 + e_aj) if e_aj > -1.0 else 0.0  # [D93]
    rho_h_aj = rho_d_aj * (1.0 + w_aj)                                     # [D91]

    mr_hum_tot = mr_sec_tot * (1.0 + w0_frac)
    mw_to_add = mw_tot - w0_frac * mr_sec_tot   # négatif possible = retirer

    return EssaiQuantities(
        gs_backfill=gs_bkf_used, gs_nonbinder=gs_nb_used,
        w=w_aj, cw=cw_aj, wc=wc_aj,
        e=e_aj, sr=sr_aj, n=n_aj, cv=cv_aj, theta=theta_aj, bv=bv_aj,
        rho_d=rho_d_aj, rho_h=rho_h_aj,
        ms_total=ms_tot, mr_sec_tot=mr_sec_tot, mg_sec_tot=mg_sec_tot,
        mb_tot=mb_tot, mb_ad=mb_ad, mw_tot=mw_tot,
        mr_hum_tot=mr_hum_tot, mw_to_add=mw_to_add,
        vt_new=vt_new, vr_new=vr_new, vg_new=vg_new, vb_new=vb_new,
        vw_tot=vw_tot, vs_new=vs_new, vv_new=vv_new,
    )
