# app/core/models.py
"""
Domain models (inputs & outputs) for the mine backfill calculations.

- Written with Pydantic so FastAPI can validate HTTP payloads.
- Contains enums + data structures only (no math here).
- The math/physics is implemented in separate files, e.g. app/core/rpc_solver.py
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional, Literal

from pydantic import BaseModel, Field, confloat, conint


# ======================================================================
#  ENUMS
# ======================================================================

class ContainerType(str, Enum):
    """
    Type de gÃ©omÃ©trie du contenant de moulage.
    Le frontend envoie ces valeurs exactes dans 'general.container_type'.
    """
    SECTION_HEIGHT = "section_hauteur"                 # Section (cmÂ²) + hauteur (cm)
    RADIUS_HEIGHT = "rayon_hauteur"                    # Rayon (cm) + hauteur (cm)
    LENGTH_WIDTH_HEIGHT = "longueur_largeur_hauteur"   # L, l, H (cm)


class MixCategory(str, Enum):
    """
    CatÃ©gorie de remblai.
    - RPC : Remblai en pÃ¢te cimentÃ©
    - RPG : Remblai pÃ¢te granulaire
    - RRC : Remblai rocheux
    """
    RPC = "RPC"
    RPG = "RPG"
    RRC = "RRC"


class RpcMethod(str, Enum):
    """
    MÃ©thode de calcul pour la catÃ©gorie RPC (et plus tard RPG).
    Les valeurs correspondent Ã  ce que le frontend utilise dÃ©jÃ .
    """
    CW = "dosage_cw"   # Dosage selon Cw (% de solides massiques)
    WB = "wb"          # Rapport eau/ciment (W/C)
    SLUMP = "slump"    # Ajustement pour slump
    ESSAI = "essai"    # MÃ©thode essai-erreur



# ======================================================================
#  INFORMATIONS GÃ‰NÃ‰RALES (page "Informations")
# ======================================================================

class GeneralInfo(BaseModel):
    """
    Informations gÃ©nÃ©rales renseignÃ©es sur la page dâ€™accueil.
    Correspond Ã  useStore().general cÃ´tÃ© frontend.
    """

    # Informations de base
    operator_name: Optional[str] = Field(
        default=None,
        description="Nom de l'opÃ©rateur qui prÃ©pare la recette.",
    )
    project_name: Optional[str] = Field(
        default=None,
        description="Nom du projet / chantier.",
    )
    residue_id: Optional[str] = Field(
        default=None,
        description="Identifiant du rÃ©sidu (ex: code labo).",
    )
    mix_date: Optional[str] = Field(
        default=None,
        description="Date de mÃ©lange au format YYYY-MM-DD (on garde une string pour lâ€™instant).",
    )

    # ------------------ GÃ©omÃ©trie du contenant de moulage ------------------

    container_type: Optional[ContainerType] = Field(
        default=None,
        description="Type de contenant utilisÃ© pour le moulage.",
    )

    # Pour SECTION_HEIGHT : on utilise section + hauteur
    container_section: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Section du contenant en cmÂ² (si type 'section_hauteur').",
    )
    container_height: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Hauteur du contenant en cm.",
    )

    # Pour RADIUS_HEIGHT : on utilise rayon + hauteur
    container_radius: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Rayon du contenant en cm (si type 'rayon_hauteur').",
    )

    # Pour LENGTH_WIDTH_HEIGHT : on utilise longueur, largeur, hauteur
    container_length: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Longueur du contenant en cm (si type 'longueur_largeur_hauteur').",
    )
    container_width: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Largeur du contenant en cm (si type 'longueur_largeur_hauteur').",
    )

    # ------------------ Composition du liant (1 Ã  3 ciments) ---------------

    binder_count: Optional[conint(ge=1, le=3)] = Field(
        default=None,
        description="Nombre de ciments dans le liant (1 Ã  3).",
    )
    binder1_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 1 (CP50, CP10, etc.).",
    )
    binder2_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 2 (optionnel).",
    )
    binder3_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 3 (optionnel).",
    )


# ======================================================================
#  PROPRIÃ‰TÃ‰S DU RÃ‰SIDU ET DU LIANT
# ======================================================================

class ResidueProps(BaseModel):
    """
    PropriÃ©tÃ©s du rÃ©sidu.
    Tous les pourcentages ici sont des % massiques (0â€“100).
    """

    specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Poids spÃ©cifique (SG) du rÃ©sidu (sans unitÃ©).",
    )
    moisture_mass_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="Teneur en eau massique du rÃ©sidu humide, en % (ex: 20 pour 20%).",
    )


class BinderComponent(BaseModel):
    """
    Un composant de liant (un ciment) dans le systÃ¨me de liant.
    'mass_fraction' = fraction massique de ce ciment par rapport au liant total (0â€“1).
    """

    type: str
    specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Poids spÃ©cifique (SG) du ciment (sans unitÃ©).",
    )
    mass_fraction: confloat(ge=0, le=1) = Field(
        ...,
        description=(
            "Fraction massique du ciment dans le liant total (0â€“1). "
            "La somme de toutes les fractions doit Ãªtre Ã©gale Ã  1."
        ),
    )


class BinderSystem(BaseModel):
    """
    SystÃ¨me de liant contenant 1 Ã  3 composants (ciments).
    """

    components: List[BinderComponent]

    def validate_total_fraction(self) -> None:
        """
        VÃ©rifie que la somme des 'mass_fraction' vaut ~1.
        AppelÃ©e explicitement dans le solver (on pourrait aussi utiliser un validator).
        """
        total = sum(c.mass_fraction for c in self.components)
        # On tolÃ¨re une petite erreur numÃ©rique (par ex. 0.999999 au lieu de 1)
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Mass fractions must sum to 1. Got {total:.6f} for components."
            )


# ======================================================================
#  BASE COMMUNE Ã€ TOUS LES SCÃ‰NARIOS
# ======================================================================

class SolverConstants(BaseModel):
    """
    Constantes numeriques optionnelles pour le solveur.
    Si non fournies, le backend utilise ses valeurs par defaut.
    """

    water_density: confloat(gt=0) = Field(
        1000.0,
        description="Masse volumique de l'eau (kg/m3).",
    )
    gravity: confloat(gt=0) = Field(
        9.81,
        description="Acceleration de la gravite (m/s2).",
    )
    slump_small_to_large_factor: confloat(gt=0) = Field(
        2.335,
        description="Facteur de conversion du petit cone vers le grand cone.",
    )
    slump_model_coeff: confloat(gt=0) = Field(
        4.95e6,
        description="Coefficient du modele predictif du slump.",
    )
    slump_model_offset: float = Field(
        235.5122,
        description="Constante additive du modele predictif du slump.",
    )


class BaseMixDesignInput(BaseModel):
    """
    Champs communs pour tous les scÃ©narios de mÃ©lange
    (RPC Cw, RPC W/B, RPC Slump, Essai-erreur, plus tard RPG et RRC).
    """

    category: MixCategory = MixCategory.RPC
    general: GeneralInfo
    residue: ResidueProps
    binder_system: BinderSystem
    constants: Optional[SolverConstants] = Field(
        default=None,
        description="Constantes optionnelles pour personnaliser les calculs.",
    )

    num_recipes: conint(ge=1, le=4) = Field(
        1,
        description="Nombre de recettes Ã  calculer (1 Ã  4).",
    )
    containers_per_recipe: conint(ge=1) = Field(
        1,
        description="Nombre de contenants par recette.",
    )
    safety_factor: confloat(gt=0) = Field(
        1.0,
        description="Facteur de sÃ©curitÃ© appliquÃ© au volume total.",
    )


# ======================================================================
#  RPC: Dosage selon Cw (% de solides massiques)
# ======================================================================

class RpcCwInputs(BaseMixDesignInput):
    """
    EntrÃ©es pour la mÃ©thode RPC â€“ Dosage selon Cw%.
    """

    solids_mass_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="% massique de solides dans le remblai (Cw%).",
    )
    saturation_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="DegrÃ© de saturation S_r (%) du remblai.",
    )

    # Pourcentage massique de liant par recette (1 Ã  4)
    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description=(
            "Pourcentage massique de liant dans chaque recette (%). "
            "La liste doit contenir au moins num_recipes Ã©lÃ©ments (jusqu'Ã  4)."
        ),
    )

    # ParamÃ¨tres optionnels pour l'utilisation d'agrÃ©gats (A_m)
    aggregate_fraction_pct: Optional[confloat(ge=0, le=100)] = Field(
        default=0.0,
        description="Fraction massique d'agrÃ©gat co-mixing (%). Si 0 -> aucun agrÃ©gat.",
    )
    aggregate_specific_gravity: Optional[confloat(gt=0)] = Field(
        default=None,
        description="Masse volumique spÃ©cifique (Gs) de l'agrÃ©gat. Optionnel.",
    )


# ======================================================================
#  RPC: W/B (rapport eau/ciment)
# ======================================================================

class RpcWbInputs(BaseMixDesignInput):
    """
    EntrÃ©es pour la mÃ©thode RPC â€“ rapport eau/ciment (W/C).

    Dans ton C#, tu utilisais la valeur -99 pour signifier :
      'le programme calcule W/C automatiquement'.
    Ici on fait plus propre :
      - si wc_ratio_recipes est None, le solver le calcule
      - si wc_ratio_recipes est fourni, on utilise ces valeurs imposÃ©es
    """

    saturation_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="DegrÃ© de saturation S_r (%) du remblai.",
    )

    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description="Pourcentage massique de liant pour chaque recette (%).",
    )

    wc_ratio_recipes: Optional[List[confloat(gt=0)]] = Field(
        default=None,
        description=(
            "Rapport eau/ciment imposÃ© pour chaque recette. "
            "Si None -> le solveur le calcule Ã  partir des autres paramÃ¨tres."
        ),
    )


# ======================================================================
#  RPC: Slump
# ======================================================================

class RpcSlumpInputs(BaseMixDesignInput):
    """
    EntrÃ©es pour la mÃ©thode RPC â€“ Ajustement pour slump.
    """

    cone_type: Literal["mini", "grand"] = Field(
        "mini",
        description="Type de cÃ´ne d'Abrams utilisÃ© (mini ou grand).",
    )
    slump_mm: confloat(ge=0) = Field(
        ...,
        description="Slump cible en mm (ex: 180 mm).",
    )

    saturation_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="DegrÃ© de saturation S_r (%) du remblai.",
    )

    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description="Pourcentage massique de liant pour chaque recette (%).",
    )


# ======================================================================
#  RPC: Essai-erreur (ajustements)
# ======================================================================

class RpcEssaiAdjustment(BaseModel):
    """
    Ajustements appliquÃ©s Ã  une recette lors de la mÃ©thode essai-erreur.

    Valeurs positives = ajout
    Valeurs nÃ©gatives = retrait
    """

    added_dry_residue_mass: float = Field(
        0.0, description="Masse de rÃ©sidu sec ajoutÃ©e (kg)."
    )
    added_wet_residue_mass: float = Field(
        0.0, description="Masse de rÃ©sidu humide ajoutÃ©e (kg)."
    )
    added_water_mass: float = Field(
        0.0, description="Masse d'eau ajoutÃ©e (kg)."
    )
    # plus tard : ajout dâ€™agrÃ©gats, etc.


class RpcEssaiInputs(BaseMixDesignInput):
    """
    EntrÃ©es pour la mÃ©thode RPC â€“ Essai-erreur.

    On part d'une recette de base (calculÃ©e par CW ou W/B),
    puis on applique des ajustements (ajout/retrait d'eau, rÃ©sidu, etc.).
    """

    base_method: RpcMethod = Field(
        ...,
        description="MÃ©thode utilisÃ©e pour la recette de base (CW ou WB en pratique).",
    )

    # Un des deux doit Ãªtre non-nul suivant base_method
    base_inputs_cw: Optional[RpcCwInputs] = None
    base_inputs_wb: Optional[RpcWbInputs] = None

    # Liste des ajustements, un par recette
    adjustments: List[RpcEssaiAdjustment] = Field(
        ...,
        description="Liste des ajustements (un par recette).",
    )


# ======================================================================
#  SORTIES (rÃ©sultats du solveur)
# ======================================================================

class MixComponentMass(BaseModel):
    """
    Masses des diffÃ©rents composants d'une recette de remblai.
    Toutes les masses sont en kg.

    Les champs *_to_add_* sont utilisÃ©s par la mÃ©thode essai-erreur pour indiquer
    les masses supplÃ©mentaires Ã  ajouter par rapport Ã  la recette de base.
    """

    residue_dry_mass_kg: float
    residue_wet_mass_kg: float
    binder_total_mass_kg: float
    binder_c1_mass_kg: float
    binder_c2_mass_kg: float
    binder_c3_mass_kg: float
    water_total_mass_kg: float
    water_to_add_mass_kg: float

    # RPG (PAF): masse sèche d'agrégat (0 pour RPC)
    aggregate_dry_mass_kg: float = 0.0

    # Essai-erreur: masses supplÃ©mentaires Ã  rajouter (formules [26], [27a-c])
    binder_to_add_mass_kg: float = 0.0       # Mb_ad  [26]
    binder_c1_to_add_mass_kg: float = 0.0    # Mc1_ad [27a]
    binder_c2_to_add_mass_kg: float = 0.0    # Mc2_ad [27b]
    binder_c3_to_add_mass_kg: float = 0.0    # Mc3_ad [27c]


class MixState(BaseModel):
    """
    RÃ©sumÃ© de l'Ã©tat d'une recette de remblai aprÃ¨s calcul.
    Tu pourras enrichir cette classe (porositÃ©, compacitÃ©, etc.) plus tard.
    """

    # DensitÃ©s (kg/mÂ³)
    bulk_density_kg_m3: float
    dry_density_kg_m3: float

    # Ratios et pourcentages
    solids_mass_pct: float      # Cw% effectif aprÃ¨s calcul
    saturation_pct: float       # S_r effectif
    wc_ratio: float             # rapport eau/ciment effectif
    bw_mass_pct: float          # % massique de liant (Bw%)
    bv_vol_pct: float           # % volumique de liant (Bv)
    cv_vol_pct: float           # % volumique de solides (Cv)
    w_mass_pct: float           # teneur en eau massique (%)
    void_ratio: float           # indice des vides e
    porosity: float             # porositÃ© n
    theta_pct: float            # teneur en eau volumique (%)
    gs_binder: float            # Gs du liant
    gs_backfill: float          # Gs du remblai
    bulk_unit_weight_kN_m3: float
    dry_unit_weight_kN_m3: float

    # Volumes (m³)
    container_volume_m3: float
    total_backfill_volume_m3: float
    residue_volume_m3: float = 0.0    # Vr — volume du résidu sec
    binder_volume_m3: float = 0.0     # Vb — volume du liant
    water_volume_m3: float = 0.0      # Vw — volume d'eau totale
    solid_volume_m3: float = 0.0      # Vs — volume solide total
    void_volume_m3: float = 0.0       # Vv — volume des vides

    # Masses de composants
    components: MixComponentMass


# ======================================================================
#  RPG: Remblai Pâte Granulaire (Paste Aggregate Fill)
# ======================================================================

class RpgCwInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPG — Dosage selon Cw%.
    Identique à RpcCwInputs mais aggregate_fraction_pct et
    aggregate_specific_gravity sont obligatoires.
    """

    solids_mass_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="% massique de solides dans le remblai (Cw%).",
    )
    saturation_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="Degré de saturation Sr (%).",
    )
    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description="Bw% (liant / (résidu+agrégat)) pour chaque recette.",
    )
    aggregate_fraction_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="A_m% — fraction massique d'agrégat dans les solides non-liant (Ma/(Ma+Mr)*100).",
    )
    aggregate_specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Gs de l'agrégat (masse volumique spécifique).",
    )


class RpgWbInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPG — Rapport eau/ciment (W/C).
    """

    saturation_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="Degré de saturation Sr (%).",
    )
    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description="Bw% (liant / (résidu+agrégat)) pour chaque recette.",
    )
    wc_ratio_recipes: List[confloat(gt=0)] = Field(
        ...,
        description="Rapport eau/ciment (W/C) pour chaque recette.",
    )
    aggregate_fraction_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="A_m% — fraction massique d'agrégat dans les solides non-liant.",
    )
    aggregate_specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Gs de l'agrégat.",
    )


class RpgEssaiAdjustment(BaseModel):
    """
    Ajustements appliqués à une recette RPG lors de la méthode essai-erreur.
    Identique à RpcEssaiAdjustment mais avec un champ agrégat supplémentaire.
    """
    added_dry_residue_mass: float = Field(0.0, description="Masse de résidu sec ajoutée (kg).")
    added_wet_residue_mass: float = Field(0.0, description="Masse de résidu humide ajoutée (kg).")
    added_aggregate_mass:   float = Field(0.0, description="Masse d'agrégat sec ajouté (kg). Spécifique RPG.")
    aggregate_moisture_mass_pct: float = Field(0.0, description="Teneur en eau massique de l'agrégat ajouté (w0-ag, %). Par défaut 0 (agrégat sec).")
    added_water_mass:       float = Field(0.0, description="Masse d'eau ajoutée (kg).")


class RpgEssaiInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPG — Essai-erreur.
    Repart d'une recette de base RPG (Cw ou W/C) et applique des ajustements.
    """
    base_method: RpcMethod = Field(..., description="Méthode de base: CW ou WB.")
    base_inputs_cw: Optional[RpgCwInputs] = None
    base_inputs_wb: Optional[RpgWbInputs] = None
    adjustments: List[RpgEssaiAdjustment] = Field(
        ...,
        description="Liste des ajustements (un par recette).",
    )


class MixDesignResult(BaseModel):
    """
    RÃ©sultat global renvoyÃ© par un solveur (CW, WB, Slump, Essai-erreur).
    Contient:
      - la catÃ©gorie (RPC/RPG/RRC)
      - la mÃ©thode (dosage_cw, wb, slump, essai)
      - les infos gÃ©nÃ©rales
      - la liste de recettes calculÃ©es
    """

    category: MixCategory
    method: RpcMethod
    general: GeneralInfo
    recipes: List[MixState]

