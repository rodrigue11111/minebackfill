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

from pydantic import BaseModel, Field, confloat, conint, field_validator


#: Nombre maximal de composants de liant combinables. Le cœur mathématique
#: (Gs harmonique, répartition des masses) est N-aire ; cette borne reste un
#: garde-fou de bon sens (une recette avec des dizaines de ciments serait une
#: erreur de saisie, et l'UI dimensionne quelques champs).
MAX_BINDER_COMPONENTS = 8


# ======================================================================
#  ENUMS
# ======================================================================

class ContainerType(str, Enum):
    """
    Type de géométrie du contenant de moulage.
    Le frontend envoie ces valeurs exactes dans 'general.container_type'.
    """
    SECTION_HEIGHT = "section_hauteur"                 # Section (cm²) + hauteur (cm)
    RADIUS_HEIGHT = "rayon_hauteur"                    # Rayon (cm) + hauteur (cm)
    LENGTH_WIDTH_HEIGHT = "longueur_largeur_hauteur"   # L, l, H (cm)
    VOLUME = "volume"                                  # Volume saisi directement (m³)


class MixCategory(str, Enum):
    """
    Catégorie de remblai.
    - RPC : Remblai en pâte cimenté
    - RPG : Remblai pâte granulaire
    - RRC : Remblai rocheux
    """
    RPC = "RPC"
    RPG = "RPG"
    RRC = "RRC"


class RpcMethod(str, Enum):
    """
    Méthode de calcul pour la catégorie RPC (et plus tard RPG).
    Les valeurs correspondent à ce que le frontend utilise déjà.
    """
    CW = "dosage_cw"   # Dosage selon Cw (% de solides massiques)
    WB = "wb"          # Rapport eau/ciment (W/C)
    SLUMP = "slump"    # Ajustement pour slump
    ESSAI = "essai"    # Méthode essai-erreur



# ======================================================================
#  INFORMATIONS GÉNÉRALES (page "Informations")
# ======================================================================

class GeneralInfo(BaseModel):
    """
    Informations générales renseignées sur la page d'accueil.
    Correspond à useStore().general côté frontend.
    """

    # Informations de base
    operator_name: Optional[str] = Field(
        default=None,
        description="Nom de l'opérateur qui prépare la recette.",
    )
    project_name: Optional[str] = Field(
        default=None,
        description="Nom du projet / chantier.",
    )
    residue_id: Optional[str] = Field(
        default=None,
        description="Identifiant du résidu (ex: code labo).",
    )
    mix_date: Optional[str] = Field(
        default=None,
        description="Date de mélange au format YYYY-MM-DD (on garde une string pour l'instant).",
    )

    # ------------------ Géométrie du contenant de moulage ------------------

    container_type: Optional[ContainerType] = Field(
        default=None,
        description="Type de contenant utilisé pour le moulage.",
    )

    # Pour SECTION_HEIGHT : on utilise section + hauteur
    container_section: Optional[confloat(ge=0)] = Field(
        default=None,
        description="Section du contenant en cm² (si type 'section_hauteur').",
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

    # Pour VOLUME : le volume du contenant est saisi directement (en m³)
    container_volume_m3: Optional[confloat(gt=0)] = Field(
        default=None,
        description="Volume du contenant en m³ (si type 'volume', saisi directement).",
    )

    # --------------- Composition du liant (écho métadonnées) ---------------
    # Champs indicatifs seulement : le système de liant réellement calculé est
    # `binder_system` (N composants). binder_count/binderN_type ne sont qu'un
    # écho des 3 premiers pour l'affichage ; le solveur ne les lit pas.

    binder_count: Optional[conint(ge=1, le=MAX_BINDER_COMPONENTS)] = Field(
        default=None,
        description=f"Nombre de ciments dans le liant (1 à {MAX_BINDER_COMPONENTS}). Écho ; voir binder_system.",
    )
    binder1_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 1 (CP50, CP10, etc.). Écho des 3 premiers.",
    )
    binder2_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 2 (optionnel). Écho.",
    )
    binder3_type: Optional[str] = Field(
        default=None,
        description="Type du ciment 3 (optionnel). Écho.",
    )


# ======================================================================
#  PROPRIÉTÉS DU RÉSIDU ET DU LIANT
# ======================================================================

class ResidueProps(BaseModel):
    """
    Propriétés du résidu.
    Tous les pourcentages ici sont des % massiques (0–100).
    """

    specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Poids spécifique (SG) du résidu (sans unité).",
    )
    moisture_mass_pct: confloat(ge=0, le=100) = Field(
        ...,
        description="Teneur en eau massique du résidu humide, en % (ex: 20 pour 20%).",
    )


class BinderComponent(BaseModel):
    """
    Un composant de liant (un ciment) dans le système de liant.
    'mass_fraction' = fraction massique de ce ciment par rapport au liant total (0–1).
    """

    type: str
    specific_gravity: confloat(gt=0) = Field(
        ...,
        description="Poids spécifique (SG) du ciment (sans unité).",
    )
    mass_fraction: confloat(ge=0, le=1) = Field(
        ...,
        description=(
            "Fraction massique du ciment dans le liant total (0–1). "
            "La somme de toutes les fractions doit être égale à 1."
        ),
    )


class BinderSystem(BaseModel):
    """
    Système de liant contenant 1 à MAX_BINDER_COMPONENTS composants (ciments).
    """

    components: List[BinderComponent]

    @field_validator("components")
    @classmethod
    def _valider_nombre_composants(cls, v: List[BinderComponent]) -> List[BinderComponent]:
        # Le solveur combine désormais N composants (Gs harmonique et
        # répartition des masses par boucle). On borne quand même le nombre :
        # au-delà, c'est presque sûrement une erreur de saisie.
        if len(v) < 1:
            raise ValueError("Au moins un composant de liant est requis.")
        if len(v) > MAX_BINDER_COMPONENTS:
            raise ValueError(
                f"Maximum {MAX_BINDER_COMPONENTS} composants de liant supportés."
            )
        return v

    def validate_total_fraction(self) -> None:
        """
        Vérifie que la somme des 'mass_fraction' vaut ~1.
        Appelée explicitement dans le solver (on pourrait aussi utiliser un validator).
        """
        total = sum(c.mass_fraction for c in self.components)
        # On tolère une petite erreur numérique (par ex. 0.999999 au lieu de 1)
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"Les fractions massiques des liants doivent totaliser 100 % (somme actuelle : {total*100:.2f} %)."
            )


# ======================================================================
#  BASE COMMUNE À TOUS LES SCÉNARIOS
# ======================================================================

class SolverConstants(BaseModel):
    """
    Constantes numériques optionnelles pour le solveur.
    Si non fournies, le backend utilise ses valeurs par défaut.
    """

    water_density: confloat(gt=0) = Field(
        1000.0,
        description="Masse volumique de l'eau (kg/m³).",
    )
    gravity: confloat(gt=0) = Field(
        9.81,
        description="Accélération de la gravité (m/s²).",
    )
    slump_small_to_large_factor: confloat(gt=0) = Field(
        2.335,
        description="Facteur de conversion du petit cône vers le grand cône.",
    )
    slump_model_coeff: confloat(gt=0) = Field(
        4.95e6,
        description="Coefficient du modèle prédictif du slump.",
    )
    slump_model_offset: confloat(gt=0) = Field(
        235.5122,
        description="Constante additive du modèle prédictif du slump.",
    )

    # --------------- Drapeaux de convention de calcul ---------------
    # Défauts = convention « Intra 2017 » (comportement historique). Les autres
    # valeurs capturent des variantes de feuilles du professeur (packs).
    essai_gs_convention: Literal["base", "recalcule"] = Field(
        "base",
        description=(
            "Essai-erreur : « base » fige les Gs de la recette de base (Intra "
            "2017) ; « recalcule » les recalcule à partir de la composition "
            "après ajouts."
        ),
    )
    essai_binder_rule: Literal["solides_totaux", "residu_ajoute"] = Field(
        "solides_totaux",
        description=(
            "Essai-erreur : « solides_totaux » maintient Bw sur tous les solides "
            "ajoutés (résidu + granulat, Intra 2017) ; « residu_ajoute » applique "
            "le liant ajouté au résidu ajouté seulement (feuille « gramme » "
            "Belem 2016). Voir Issues.md #4."
        ),
    )


class BaseMixDesignInput(BaseModel):
    """
    Champs communs pour tous les scénarios de mélange
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
        description="Nombre de recettes à calculer (1 à 4).",
    )
    containers_per_recipe: conint(ge=1) = Field(
        1,
        description="Nombre de contenants par recette.",
    )
    safety_factor: confloat(gt=0) = Field(
        1.0,
        description="Facteur de sécurité appliqué au volume total.",
    )


# ======================================================================
#  RPC: Dosage selon Cw (% de solides massiques)
# ======================================================================

class RpcCwInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPC – Dosage selon Cw%.
    """

    solids_mass_pct: confloat(gt=0, le=100) = Field(
        ...,
        description="% massique de solides dans le remblai (Cw%).",
    )
    saturation_pct: confloat(gt=0, le=100) = Field(
        ...,
        description="Degré de saturation S_r (%) du remblai.",
    )

    # Pourcentage massique de liant par recette (1 à 4)
    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description=(
            "Pourcentage massique de liant dans chaque recette (%). "
            "La liste doit contenir au moins num_recipes éléments (jusqu'à 4)."
        ),
    )

    # Paramètres optionnels pour l'utilisation d'agrégats (A_m)
    aggregate_fraction_pct: Optional[confloat(ge=0, le=100)] = Field(
        default=0.0,
        description="Fraction massique d'agrégat co-mixing (%). Si 0 -> aucun agrégat.",
    )
    aggregate_specific_gravity: Optional[confloat(gt=0)] = Field(
        default=None,
        description="Masse volumique spécifique (Gs) de l'agrégat. Optionnel.",
    )


# ======================================================================
#  RPC: W/B (rapport eau/ciment)
# ======================================================================

class RpcWbInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPC – rapport eau/ciment (W/C).

    Dans ton C#, tu utilisais la valeur -99 pour signifier :
      'le programme calcule W/C automatiquement'.
    Ici on fait plus propre :
      - si wc_ratio_recipes est None, le solver le calcule
      - si wc_ratio_recipes est fourni, on utilise ces valeurs imposées
    """

    saturation_pct: confloat(gt=0, le=100) = Field(
        ...,
        description="Degré de saturation S_r (%) du remblai.",
    )

    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ...,
        description="Pourcentage massique de liant pour chaque recette (%).",
    )

    wc_ratio_recipes: Optional[List[confloat(gt=0)]] = Field(
        default=None,
        description=(
            "Rapport eau/ciment imposé pour chaque recette. "
            "Si None -> le solveur le calcule à partir des autres paramètres."
        ),
    )


# ======================================================================
#  RPC: Slump
# ======================================================================

class RpcSlumpInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPC – Ajustement pour slump.
    """

    cone_type: Literal["mini", "grand"] = Field(
        "mini",
        description="Type de cône d'Abrams utilisé (mini ou grand).",
    )
    slump_mm: confloat(gt=0) = Field(
        ...,
        description="Slump cible en mm (ex: 180 mm).",
    )

    saturation_pct: confloat(gt=0, le=100) = Field(
        ...,
        description="Degré de saturation S_r (%) du remblai.",
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
    Ajustements appliqués à une recette lors de la méthode essai-erreur.

    Valeurs positives = ajout
    Valeurs négatives = retrait
    """

    added_dry_residue_mass: float = Field(
        0.0, description="Masse de résidu sec ajoutée (kg)."
    )
    added_wet_residue_mass: float = Field(
        0.0, description="Masse de résidu humide ajoutée (kg)."
    )
    added_water_mass: float = Field(
        0.0, description="Masse d'eau ajoutée (kg)."
    )
    # plus tard : ajout d'agrégats, etc.


class RpcEssaiInputs(BaseMixDesignInput):
    """
    Entrées pour la méthode RPC – Essai-erreur.

    On part d'une recette de base (calculée par CW ou W/B),
    puis on applique des ajustements (ajout/retrait d'eau, résidu, etc.).
    """

    base_method: RpcMethod = Field(
        ...,
        description="Méthode utilisée pour la recette de base (CW ou WB en pratique).",
    )

    # Un des deux doit être non-nul suivant base_method
    base_inputs_cw: Optional[RpcCwInputs] = None
    base_inputs_wb: Optional[RpcWbInputs] = None

    # Liste des ajustements, un par recette
    adjustments: List[RpcEssaiAdjustment] = Field(
        ...,
        description="Liste des ajustements (un par recette).",
    )


# ======================================================================
#  SORTIES (résultats du solveur)
# ======================================================================

class MixComponentMass(BaseModel):
    """
    Masses des différents composants d'une recette de remblai.
    Toutes les masses sont en kg.

    Les champs *_to_add_* sont utilisés par la méthode essai-erreur pour indiquer
    les masses supplémentaires à ajouter par rapport à la recette de base.
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

    # Essai-erreur: masses supplémentaires à rajouter (formules [26], [27a-c])
    binder_to_add_mass_kg: float = 0.0       # Mb_ad  [26]
    binder_c1_to_add_mass_kg: float = 0.0    # Mc1_ad [27a]
    binder_c2_to_add_mass_kg: float = 0.0    # Mc2_ad [27b]
    binder_c3_to_add_mass_kg: float = 0.0    # Mc3_ad [27c]

    # N composants de liant (>= 3 possibles). ADDITIF : binder_c1/2/3_mass_kg
    # ci-dessus restent renseignés pour les 3 premiers (compat des
    # consommateurs et du localStorage existants). Ces listes portent TOUS les
    # composants dans l'ordre du système de liant.
    binder_masses_kg: List[float] = Field(default_factory=list)
    binder_to_add_masses_kg: List[float] = Field(default_factory=list)


class MixState(BaseModel):
    """
    Résumé de l'état d'une recette de remblai après calcul.
    Tu pourras enrichir cette classe (porosité, compacité, etc.) plus tard.
    """

    # Densités (kg/m³)
    bulk_density_kg_m3: float
    dry_density_kg_m3: float

    # Ratios et pourcentages
    solids_mass_pct: float      # Cw% effectif après calcul
    saturation_pct: float       # S_r effectif
    wc_ratio: float             # rapport eau/ciment effectif
    bw_mass_pct: float          # % massique de liant (Bw%)
    bv_vol_pct: float           # % volumique de liant (Bv)
    cv_vol_pct: float           # % volumique de solides (Cv)
    w_mass_pct: float           # teneur en eau massique (%)
    void_ratio: float           # indice des vides e
    porosity: float             # porosité n
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
    aggregate_volume_m3: float = 0.0  # Vg — volume du granulat sec (RPG)

    # Granulat (RPG) — équivalents feuille Intra 2017 (D24/D25, D83-D85)
    aggregate_vol_pct_of_residue: float = 0.0    # % vol. granulat / (résidus + granulat)
    aggregate_vol_pct_of_backfill: float = 0.0   # % vol. granulat / remblai total
    aggregate_mass_pct: float = 0.0              # % massique granulat / solides hors liant

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

    solids_mass_pct: confloat(gt=0, le=100) = Field(
        ...,
        description="% massique de solides dans le remblai (Cw%).",
    )
    saturation_pct: confloat(gt=0, le=100) = Field(
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

    saturation_pct: confloat(gt=0, le=100) = Field(
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
    Résultat global renvoyé par un solveur (CW, WB, Slump, Essai-erreur).
    Contient:
      - la catégorie (RPC/RPG/RRC)
      - la méthode (dosage_cw, wb, slump, essai)
      - les infos générales
      - la liste de recettes calculées
    """

    category: MixCategory
    method: RpcMethod
    general: GeneralInfo
    recipes: List[MixState]



# ======================================================================
#  RRC: Remblai Rocheux Cimenté (Cemented Rockfill — CRF)
#  Formules du cours, Dias 66-70 (feuille Intra 2017 non applicable :
#  le CRF est dosé par masse totale ou volume de chantier).
# ======================================================================

class RrcInputs(BaseModel):
    """
    Entrées pour le RRC/CRF.

    Le mélange est défini par :
      - la quantité de CRF : volume de chantier x masse volumique humide,
        ou masse totale directe ;
      - Bw = Mc/MWR (taux massique de liant par rapport aux roches stériles) ;
      - W/C = M*/Mc (fluide = eau + retardateur, par rapport au ciment) ;
      - le dosage du retardateur de prise D0 (ml/100 kg de ciment, 0 = aucun).
    """

    category: MixCategory = MixCategory.RRC
    general: GeneralInfo
    num_recipes: conint(ge=1, le=4) = Field(1, description="Nombre de recettes (1 à 4).")

    quantity_mode: Literal["volume", "masse"] = Field(
        "volume",
        description="Quantité de CRF donnée par volume de chantier ou masse totale.",
    )
    volume_m3: Optional[confloat(gt=0)] = Field(
        default=None, description="Volume du chantier à remblayer (m³) — mode volume.",
    )
    wet_density_kg_m3: Optional[confloat(gt=0)] = Field(
        default=2200.0, description="Masse volumique humide du CRF (kg/m³) — mode volume.",
    )
    total_mass_kg: Optional[confloat(gt=0)] = Field(
        default=None, description="Masse totale de CRF (kg) — mode masse.",
    )

    binder_mass_pct_recipes: List[confloat(ge=0, le=100)] = Field(
        ..., description="Bw% (= Mc/MWR x 100) pour chaque recette.",
    )
    wc_ratio_recipes: List[confloat(gt=0)] = Field(
        ..., description="Rapport W/C du coulis (fluide/ciment) pour chaque recette.",
    )

    cement_specific_gravity: confloat(gt=0) = Field(
        3.15, description="Gs du ciment (pour le volume du coulis).",
    )
    retarder_dosage_ml_per_100kg: confloat(ge=0) = Field(
        0.0, description="Dosage du retardateur D0 (ml/100 kg de ciment). 0 = aucun.",
    )
    retarder_density_g_ml: confloat(gt=0) = Field(
        1.2, description="Masse volumique du retardateur (g/ml).",
    )

    constants: Optional[SolverConstants] = None


class RrcRecipeState(BaseModel):
    """Résultat d'une recette RRC/CRF (formules Dias 68-70)."""

    bw_mass_pct: float          # Bw (%)
    wc_ratio: float             # W/C du coulis
    w_mass_pct: float           # teneur en eau massique w (%)
    solids_mass_pct: float      # Cw (%)
    retarder_dosage_mass_pct: float  # D_m% = rho_SR*D1*100

    total_mass_kg: float        # M_CRF
    crf_volume_m3: float        # V_CRF (0 si mode masse sans densité)
    waste_rock_mass_kg: float   # M_WR
    cement_mass_kg: float       # M_c
    fluid_mass_kg: float        # M* (eau + retardateur)
    water_mass_kg: float        # M_w
    retarder_mass_kg: float     # M_SR
    retarder_volume_l: float    # V_SR (litres)
    slurry_mass_kg: float       # M_c-slurry (ciment + eau + retardateur)
    slurry_volume_m3: float     # V_c-slurry


class RrcResult(BaseModel):
    """Résultat global du solveur RRC."""

    category: MixCategory
    general: GeneralInfo
    recipes: List[RrcRecipeState]
