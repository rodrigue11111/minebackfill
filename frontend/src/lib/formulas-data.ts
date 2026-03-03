// ============================================================
// Formula Library — Source: S5_Chap4_GNM1002-H2026
// "Calculs des mélanges de remblais miniers cimentés"
// Prof. Tikou Belem — UQAT
// ============================================================

export interface FormulaVariable {
  symbol: string;
  description: string;
  unit: string | null;
}

export interface DerivationLinks {
  derivedFrom: string[];
  derivesInto: string[];
  derivationNote: string | null;
}

export interface Formula {
  id: string;
  title: string;
  subtitle: string;
  section: string;
  chapter: string;
  pageNumber: number;
  equationLatex: string;
  equationPlainText: string;
  variables: FormulaVariable[];
  keywords: string[];
  contextSnippet: string;
  derivationLinks: DerivationLinks;
}

export const FORMULAS: Formula[] = [

  // ============================================================
  // SECTION A — Paramètres géotechniques de base (p. 7–8)
  // ============================================================

  {
    id: "F001",
    title: "Teneur en eau massique",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex:
      "w = \\frac{M_w}{M_s} = \\frac{M_h - M_d}{M_d}",
    equationPlainText: "w = Mw/Ms = (Mh - Md)/Md",
    variables: [
      { symbol: "w", description: "Teneur en eau massique", unit: "%" },
      { symbol: "M_w", description: "Masse de l'eau", unit: "kg" },
      { symbol: "M_s", description: "Masse des solides (masse sèche)", unit: "kg" },
      { symbol: "M_h", description: "Masse humide totale de l'échantillon", unit: "kg" },
      { symbol: "M_d", description: "Masse sèche de l'échantillon", unit: "kg" },
    ],
    keywords: ["water content", "teneur en eau", "humidité", "masse sèche", "masse humide"],
    contextSnippet:
      "Rapport de la masse d'eau à la masse des solides secs. Valeur typique pour remblai en pâte : w = 18–43 %.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: ["F009", "F011", "F030"],
      derivationNote: null,
    },
  },

  {
    id: "F002",
    title: "Teneur en eau volumique",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex: "\\theta = \\frac{V_w}{V_T}",
    equationPlainText: "theta = Vw/VT",
    variables: [
      { symbol: "\\theta", description: "Teneur en eau volumique", unit: null },
      { symbol: "V_w", description: "Volume d'eau libre dans les pores", unit: "m³" },
      { symbol: "V_T", description: "Volume total de l'échantillon", unit: "m³" },
    ],
    keywords: ["water content", "volumetric", "teneur volumique", "volume eau"],
    contextSnippet:
      "Rapport du volume d'eau libre au volume total de l'échantillon.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F003",
    title: "Degré de saturation",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex: "S_r = \\frac{V_w}{V_v}",
    equationPlainText: "Sr = Vw/Vv",
    variables: [
      { symbol: "S_r", description: "Degré de saturation", unit: "%" },
      { symbol: "V_w", description: "Volume d'eau libre dans les vides", unit: "m³" },
      { symbol: "V_v", description: "Volume des vides", unit: "m³" },
    ],
    keywords: ["saturation", "degree of saturation", "Sr", "vides", "voids"],
    contextSnippet:
      "Pour les mélanges de remblai en pâte destinés à s'écouler en tuyauterie, Sr = 100 % (saturé).",
    derivationLinks: {
      derivedFrom: ["F022", "F032"],
      derivesInto: ["F022", "F023", "F032"],
      derivationNote: null,
    },
  },

  {
    id: "F004",
    title: "Indice des vides",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex:
      "e = \\frac{V_v}{V_s} = \\frac{V_T}{V_s} - 1",
    equationPlainText: "e = Vv/Vs = VT/Vs - 1",
    variables: [
      { symbol: "e", description: "Indice des vides", unit: null },
      { symbol: "V_v", description: "Volume des vides", unit: "m³" },
      { symbol: "V_s", description: "Volume des solides", unit: "m³" },
      { symbol: "V_T", description: "Volume total", unit: "m³" },
    ],
    keywords: ["void ratio", "indice des vides", "e", "porosité"],
    contextSnippet:
      "Rapport du volume des vides au volume des solides. Lié à la porosité par e = n/(1–n).",
    derivationLinks: {
      derivedFrom: ["F005", "F007", "F033", "F034"],
      derivesInto: ["F005", "F007", "F031", "F032", "F033", "F034"],
      derivationNote: null,
    },
  },

  {
    id: "F005",
    title: "Porosité totale",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex:
      "n = \\frac{V_v}{V_T} \\times 100 \\quad \\Leftrightarrow \\quad n = \\frac{e}{1+e}",
    equationPlainText: "n = Vv/VT * 100 = e/(1+e)",
    variables: [
      { symbol: "n", description: "Porosité totale", unit: "%" },
      { symbol: "V_v", description: "Volume des vides", unit: "m³" },
      { symbol: "V_T", description: "Volume total de l'échantillon", unit: "m³" },
      { symbol: "e", description: "Indice des vides", unit: null },
    ],
    keywords: ["porosity", "porosité", "n", "void ratio", "vides"],
    contextSnippet:
      "Fraction volumique des vides dans le remblai. Aussi exprimée via l'indice des vides : n = e/(1+e).",
    derivationLinks: {
      derivedFrom: ["F004", "F010", "F031"],
      derivesInto: ["F004", "F027", "F033"],
      derivationNote: "Dérivée de e = Vv/Vs par substitution VT = Vs + Vv",
    },
  },

  {
    id: "F006",
    title: "Masse volumique totale (humide)",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex: "\\rho = \\frac{M_h}{V_T}",
    equationPlainText: "rho = Mh/VT",
    variables: [
      { symbol: "\\rho", description: "Masse volumique totale humide", unit: "kg/m³" },
      { symbol: "M_h", description: "Masse totale humide de l'échantillon", unit: "kg" },
      { symbol: "V_T", description: "Volume total de l'échantillon", unit: "m³" },
    ],
    keywords: ["density", "masse volumique", "humide", "rho", "wet density"],
    contextSnippet: "Masse volumique totale (solides + eau + air).",
    derivationLinks: {
      derivedFrom: ["F023", "F024"],
      derivesInto: ["F021", "F023", "F024"],
      derivationNote: null,
    },
  },

  {
    id: "F007",
    title: "Masse volumique sèche",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex:
      "\\rho_d = \\frac{M_d}{V_s} = \\frac{\\rho_s}{1+e}",
    equationPlainText: "rho_d = Md/Vs = rho_s/(1+e)",
    variables: [
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "M_d", description: "Masse sèche de l'échantillon", unit: "kg" },
      { symbol: "V_s", description: "Volume du solide", unit: "m³" },
      { symbol: "\\rho_s", description: "Masse volumique des grains solides", unit: "kg/m³" },
      { symbol: "e", description: "Indice des vides", unit: null },
    ],
    keywords: ["dry density", "masse volumique sèche", "rho_d", "void ratio"],
    contextSnippet: "Masse volumique des solides seuls ramené au volume total.",
    derivationLinks: {
      derivedFrom: ["F004", "F093", "F095"],
      derivesInto: ["F004", "F012", "F093", "F095"],
      derivationNote: null,
    },
  },

  {
    id: "F008",
    title: "Densité relative des grains (Gs)",
    subtitle: "Paramètres géotechniques de base",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 8,
    equationLatex:
      "G_s = \\frac{\\rho_s}{\\rho_w}",
    equationPlainText: "Gs = rho_s / rho_w",
    variables: [
      { symbol: "G_s", description: "Densité relative (specific gravity) des grains solides", unit: null },
      { symbol: "\\rho_s", description: "Masse volumique spécifique des grains", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau (≈ 1000 kg/m³)", unit: "kg/m³" },
    ],
    keywords: ["specific gravity", "Gs", "densité relative", "Dr", "relative density"],
    contextSnippet:
      "Gs typique : résidus miniers 2,6–3,2 ; ciment GU 3,15 ; laitier (Slag) 2,90 ; fly ash 2,3.",
    derivationLinks: {
      derivedFrom: ["F021", "F023"],
      derivesInto: ["F021", "F022", "F023", "F026"],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION B — Teneur en solides (p. 9–12)
  // ============================================================

  {
    id: "F009",
    title: "Pourcentage de solides massique (%Cw)",
    subtitle: "Teneur en solides",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 9,
    equationLatex:
      "C_w = \\frac{M_s}{M} \\times 100",
    equationPlainText: "%Cw = (Ms/M) * 100",
    variables: [
      { symbol: "C_w", description: "Pourcentage de solides massique", unit: "%" },
      { symbol: "M_s", description: "Masse des solides (résidus secs + liant sec)", unit: "kg" },
      { symbol: "M", description: "Masse totale du remblai (humide)", unit: "kg" },
    ],
    keywords: ["solid content", "Cw", "solides massique", "pourcentage solide"],
    contextSnippet:
      "RPC (remblai en pâte cimenté) : %Cw = 70–85 %. Hydraulique : 50–70 %.",
    derivationLinks: {
      derivedFrom: ["F001"],
      derivesInto: ["F010", "F011", "F012", "F014", "F018", "F020", "F023", "F031", "F035", "F038", "F048"],
      derivationNote: null,
    },
  },

  {
    id: "F010",
    title: "Pourcentage de solides volumique (%Cv)",
    subtitle: "Teneur en solides",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 9,
    equationLatex:
      "C_v = \\frac{V_s}{V_T} \\times 100",
    equationPlainText: "%Cv = (Vs/VT) * 100",
    variables: [
      { symbol: "C_v", description: "Pourcentage de solides volumique", unit: "%" },
      { symbol: "V_s", description: "Volume des solides", unit: "m³" },
      { symbol: "V_T", description: "Volume total", unit: "m³" },
    ],
    keywords: ["volumetric solid content", "Cv", "solides volumique"],
    contextSnippet:
      "Fraction volumique occupée par les solides. Complémentaire de la porosité : n = 1 – Cv.",
    derivationLinks: {
      derivedFrom: ["F009"],
      derivesInto: ["F005", "F095"],
      derivationNote: "Cv calculable à partir de Cw via la densité relative Gs et Sr",
    },
  },

  {
    id: "F011",
    title: "Relation w ↔ Cw",
    subtitle: "Teneur en solides",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 10,
    equationLatex:
      "w(\\%) = 100\\,\\frac{1 - C_w}{C_w} = \\frac{100}{C_w} - 100 \\qquad C_w = \\frac{1}{1+w}",
    equationPlainText: "w = (1 - Cw)/Cw * 100 ; Cw = 1/(1+w)",
    variables: [
      { symbol: "w", description: "Teneur en eau massique (décimal)", unit: "%" },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: "%" },
    ],
    keywords: ["water content", "Cw", "w", "relation", "conversion", "solide"],
    contextSnippet:
      "Conversion directe entre teneur en eau et pourcentage solide. RPC : Cw = 70–85 % ↔ w = 18–43 %.",
    derivationLinks: {
      derivedFrom: ["F001", "F009", "F015"],
      derivesInto: ["F013", "F015", "F030", "F059", "F076"],
      derivationNote: "Cw = Ms/M = Ms/(Ms+Mw) = 1/(1 + Mw/Ms) = 1/(1+w)",
    },
  },

  {
    id: "F012",
    title: "Cw — formes équivalentes",
    subtitle: "Teneur en solides",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 11,
    equationLatex:
      "C_w = \\frac{1}{1+w} = \\frac{\\rho_d}{\\rho_s}",
    equationPlainText: "Cw = 1/(1+w) = rho_d/rho_s",
    variables: [
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
      { symbol: "w", description: "Teneur en eau massique (décimal)", unit: null },
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "\\rho_s", description: "Masse volumique des grains", unit: "kg/m³" },
    ],
    keywords: ["Cw", "solid content", "formes équivalentes", "rho_d", "Gs"],
    contextSnippet:
      "Identités utiles entre Cw, w, ρd et ρs pour passer d'une formulation à l'autre.",
    derivationLinks: {
      derivedFrom: ["F007", "F009"],
      derivesInto: ["F023"],
      derivationNote: "Forme compacte valide : Cw = Ms/M = 1/(1+w) et Cw = rho_d/rho_s",
    },
  },

  // ============================================================
  // SECTION C — Teneur en eau et masses (p. 7, 19)
  // ============================================================

  {
    id: "F013",
    title: "Masse de solides à partir de la masse totale",
    subtitle: "Calcul des masses",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 7,
    equationLatex:
      "M_s = \\frac{M}{1+w} = M \\cdot C_w",
    equationPlainText: "Ms = M/(1+w) = M*Cw",
    variables: [
      { symbol: "M_s", description: "Masse de solides (sèche)", unit: "kg" },
      { symbol: "M", description: "Masse totale du remblai (humide)", unit: "kg" },
      { symbol: "w", description: "Teneur en eau massique (décimal)", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
    ],
    keywords: ["solides", "masse sèche", "Ms", "Cw", "w"],
    contextSnippet: "Calcul des solides à partir de la masse totale et de la teneur en eau.",
    derivationLinks: {
      derivedFrom: ["F011"],
      derivesInto: ["F014", "F040", "F041", "F069"],
      derivationNote: "Substitution directe de Cw = 1/(1+w)",
    },
  },

  {
    id: "F014",
    title: "Masse d'eau dans le remblai",
    subtitle: "Calcul des masses",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 19,
    equationLatex:
      "M_w = M \\cdot (1 - C_w) = w \\cdot M_s",
    equationPlainText: "Mw = M*(1-Cw) = w*Ms",
    variables: [
      { symbol: "M_w", description: "Masse d'eau dans le remblai", unit: "kg" },
      { symbol: "M", description: "Masse totale du remblai", unit: "kg" },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
      { symbol: "M_s", description: "Masse des solides", unit: "kg" },
    ],
    keywords: ["eau", "water", "Mw", "Cw", "masse eau"],
    contextSnippet: "Fraction liquide dans le remblai. Complément de Ms dans la masse totale.",
    derivationLinks: {
      derivedFrom: ["F009", "F013"],
      derivesInto: ["F041", "F044"],
      derivationNote: "Mw = M – Ms = M·(1 – Cw)",
    },
  },

  {
    id: "F015",
    title: "Masse totale du remblai",
    subtitle: "Calcul des masses",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 19,
    equationLatex:
      "M = \\frac{M_s}{C_w} = M_s (1 + w)",
    equationPlainText: "M = Ms/Cw = Ms*(1+w)",
    variables: [
      { symbol: "M", description: "Masse totale du remblai", unit: "kg" },
      { symbol: "M_s", description: "Masse de solides", unit: "kg" },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
    ],
    keywords: ["masse totale", "total mass", "MT", "Cw", "solides"],
    contextSnippet: "Masse totale calculée à partir de la masse des solides et du % solide.",
    derivationLinks: {
      derivedFrom: ["F011"],
      derivesInto: ["F011"],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION D — Taux massique de liant (p. 13–18)
  // ============================================================

  {
    id: "F016",
    title: "Taux massique de liant Bw (vs résidus + agrégats)",
    subtitle: "Quantité de liant",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 13,
    equationLatex:
      "B_w = \\frac{M_b}{M_t + M_{ag}}",
    equationPlainText: "Bw = Mb / (Mt + Mag)",
    variables: [
      { symbol: "B_w", description: "Taux massique de liant (vs résidus + agrégats secs)", unit: null },
      { symbol: "M_b", description: "Masse du liant (sec)", unit: "kg" },
      { symbol: "M_t", description: "Masse des résidus secs (tailings)", unit: "kg" },
      { symbol: "M_{ag}", description: "Masse des agrégats secs", unit: "kg" },
    ],
    keywords: ["binder ratio", "Bw", "taux liant", "liant", "dosage", "binder content"],
    contextSnippet:
      "Valeur typique : Bw = 2–10 % (0.02–0.10). Dans le cas RPC sans agrégat : Bw = Mb/Mt.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: ["F017", "F018", "F019", "F020", "F022", "F040", "F048", "F051", "F056", "F069"],
      derivationNote: null,
    },
  },

  {
    id: "F017",
    title: "Teneur massique de liant Bws (c_c, vs solides)",
    subtitle: "Quantité de liant",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 13,
    equationLatex:
      "B_{ws} = c_c = \\frac{M_b}{M_s} = \\frac{M_b}{M_b + M_t + M_{ag}}",
    equationPlainText: "Bws = cc = Mb/Ms = Mb/(Mb + Mt + Mag)",
    variables: [
      { symbol: "B_{ws}", description: "Teneur massique de liant (vs solides totaux)", unit: null },
      { symbol: "c_c", description: "Notation equivalente de Bws (teneur massique de liant vs solides)", unit: null },
      { symbol: "M_b", description: "Masse du liant", unit: "kg" },
      { symbol: "M_s", description: "Masse totale des solides (résidus + liant)", unit: "kg" },
    ],
    keywords: ["binder content", "Bws", "cc", "c_c", "solides", "liant par solides"],
    contextSnippet: "Rapport de la masse de liant à la masse totale des solides.",
    derivationLinks: {
      derivedFrom: ["F016"],
      derivesInto: ["F019"],
      derivationNote: "Bws = Bw/(1+Bw) et Bw = Bws/(1–Bws)",
    },
  },

  {
    id: "F018",
    title: "Pourcentage massique de liant Cb (vs masse totale)",
    subtitle: "Quantité de liant",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 13,
    equationLatex:
      "C_b = \\frac{M_b}{M_T} = c_c\\,C_w = \\left(\\frac{B_w}{1+B_w}\\right)C_w",
    equationPlainText: "Cb = Mb/MT = cc*Cw = (Bw/(1+Bw))*Cw",
    variables: [
      { symbol: "C_b", description: "Pourcentage massique de liant (vs masse totale remblai)", unit: "%" },
      { symbol: "M_b", description: "Masse du liant", unit: "kg" },
      { symbol: "M_T", description: "Masse totale du remblai", unit: "kg" },
      { symbol: "c_c", description: "Teneur massique de liant vs solides (alias Bws)", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique du remblai", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["Cb", "cc", "c_c", "Bws", "binder percentage", "liant", "masse totale"],
    contextSnippet: "Fraction massique du liant dans le remblai total (eau + solides).",
    derivationLinks: {
      derivedFrom: ["F009", "F016"],
      derivesInto: ["F021", "F104"],
      derivationNote: null,
    },
  },

  {
    id: "F019",
    title: "Relations Bw ↔ Bws (c_c)",
    subtitle: "Quantité de liant",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 14,
    equationLatex:
      "B_w = \\frac{B_{ws}}{1-B_{ws}} = \\frac{c_c}{1-c_c} \\qquad B_{ws}=c_c=\\frac{B_w}{1+B_w}",
    equationPlainText: "Bw = Bws/(1-Bws) = cc/(1-cc) ; Bws = cc = Bw/(1+Bw)",
    variables: [
      { symbol: "B_w", description: "Taux massique de liant (vs résidus/agrégats)", unit: null },
      { symbol: "B_{ws}", description: "Teneur massique de liant (vs solides)", unit: null },
      { symbol: "c_c", description: "Alias de Bws", unit: null },
    ],
    keywords: ["Bw", "Bws", "cc", "c_c", "conversion", "liant", "relation"],
    contextSnippet: "Conversion directe entre Bw et Bws.",
    derivationLinks: {
      derivedFrom: ["F016", "F017"],
      derivesInto: ["F030", "F104"],
      derivationNote: "Algèbre directe : Bws = Mb/Ms = Mb/(Mt+Mb) = (Mb/Mt)/(1+Mb/Mt) = Bw/(1+Bw)",
    },
  },

  {
    id: "F020",
    title: "Fractions de résidus et de liant dans le remblai",
    subtitle: "Quantité de liant",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 20,
    equationLatex:
      "C_{\\text{résidus}} = \\frac{C_w}{1 + B_w} \\qquad C_{\\text{liant}} = C_w \\cdot \\frac{B_w}{1 + B_w}",
    equationPlainText: "C_residus = Cw/(1+Bw) ; C_liant = Cw*Bw/(1+Bw)",
    variables: [
      { symbol: "C_{\\text{résidus}}", description: "Fraction massique des résidus dans le remblai", unit: null },
      { symbol: "C_{\\text{liant}}", description: "Fraction massique du liant dans le remblai", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["fraction résidus", "fraction liant", "Cw", "Bw", "remblai", "dosage"],
    contextSnippet:
      "Connaissant Cw et Bw, on calcule les fractions de résidus et de liant dans le remblai.",
    derivationLinks: {
      derivedFrom: ["F009", "F016"],
      derivesInto: [],
      derivationNote: "C_résidus = Mt/M = (Ms/(1+Bw))/M = Cw/(1+Bw)",
    },
  },

  {
    id: "F021",
    title: "Dosage de liant en kg/m³ (Cb-mv)",
    subtitle: "Quantité de liant — dosage volumique",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 15,
    equationLatex:
      "C_{b\\text{-mv}} = \\rho_h \\cdot C_b = \\frac{\\rho_h \\cdot C_w \\cdot B_w}{1 + B_w}",
    equationPlainText: "Cb-mv = rho_h * Cb = rho_h * Cw * Bw/(1+Bw)  [kg/m³]",
    variables: [
      { symbol: "C_{b\\text{-mv}}", description: "Dosage volumique du liant", unit: "kg/m³" },
      { symbol: "\\rho_h", description: "Masse volumique humide du remblai", unit: "kg/m³" },
      { symbol: "C_b", description: "Pourcentage massique du liant", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["kg/m3", "dosage volumique", "Cb-mv", "binder dosage", "liant kg/m3"],
    contextSnippet: "Expression du dosage de liant en unités massiques par volume (kg/m³ ou t/m³).",
    derivationLinks: {
      derivedFrom: ["F006", "F008", "F018"],
      derivesInto: ["F008"],
      derivationNote: "Cb-mv = ρh · Cb = ρh · Cw · Bw/(1+Bw)",
    },
  },

  {
    id: "F022",
    title: "Taux volumique de liant Bv",
    subtitle: "Quantité de liant — volumique",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 16,
    equationLatex:
      "B_v = \\frac{V_b}{V_t} = B_w \\cdot \\frac{\\rho_{s\\text{-résidus}}}{\\rho_{s\\text{-liant}}}",
    equationPlainText: "Bv = Vb/Vt = Bw*(rho_s-residus/rho_s-liant)",
    variables: [
      { symbol: "B_v", description: "Taux volumique de liant (vs résidus)", unit: null },
      { symbol: "V_b", description: "Volume du liant", unit: "m³" },
      { symbol: "V_t", description: "Volume des résidus secs", unit: "m³" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "\\rho_{s\\text{-résidus}}", description: "Masse volumique des grains de résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-liant}}", description: "Masse volumique des grains de liant", unit: "kg/m³" },
    ],
    keywords: ["volumetric binder ratio", "Bv", "volume liant", "volumique"],
    contextSnippet:
      "Rapport volume de liant / volume de résidus. Doit rester constant quand Gs des résidus varie.",
    derivationLinks: {
      derivedFrom: ["F003", "F008", "F016"],
      derivesInto: ["F003", "F044", "F054", "F084", "F085"],
      derivationNote: "Bv = (Mb/ρb)/(Mt/ρt) = Bw · (ρt/ρb)",
    },
  },

  // ============================================================
  // SECTION E — Masse volumique humide du remblai (p. 23–28)
  // ============================================================

  {
    id: "F023",
    title: "Masse volumique humide — forme générale (tout Sr)",
    subtitle: "Masse volumique humide",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 23,
    equationLatex:
      "\\rho_h = \\frac{\\rho_w \\, G_s \\, C_w \\, S_r}{S_r \\, C_w + G_s(1 - C_w)}",
    equationPlainText: "rho_h = rho_w*Gs*Cw*Sr / (Sr*Cw + Gs*(1-Cw))",
    variables: [
      { symbol: "\\rho_h", description: "Masse volumique humide du remblai", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau (1000 kg/m³)", unit: "kg/m³" },
      { symbol: "G_s", description: "Densité relative des grains solides", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
      { symbol: "S_r", description: "Degré de saturation (décimal)", unit: null },
    ],
    keywords: ["wet density", "masse volumique", "rho_h", "Gs", "Cw", "Sr", "humide"],
    contextSnippet: "Formule générale pour tout degré de saturation Sr.",
    derivationLinks: {
      derivedFrom: ["F003", "F006", "F008", "F009", "F012"],
      derivesInto: ["F006", "F008", "F024", "F027", "F039", "F040", "F065"],
      derivationNote: null,
    },
  },

  {
    id: "F024",
    title: "Masse volumique humide — remblai saturé (Sr = 1)",
    subtitle: "Masse volumique humide — Sr = 1",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 24,
    equationLatex:
      "\\rho_h = \\frac{\\rho_w \\, G_s \\, C_w}{C_w + G_s(1 - C_w)} = \\frac{\\rho_w \\, G_s}{C_w(1 - G_s) + G_s}",
    equationPlainText: "rho_h = rho_w*Gs*Cw / (Cw + Gs*(1-Cw))  [for Sr=1]",
    variables: [
      { symbol: "\\rho_h", description: "Masse volumique humide (saturé)", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
      { symbol: "G_s", description: "Densité relative des grains", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
    ],
    keywords: ["wet density", "Sr=1", "saturé", "rho_h", "Cw", "Gs"],
    contextSnippet:
      "Cas courant pour les remblais en pâte circulant dans les tuyaux (Sr = 100 %).",
    derivationLinks: {
      derivedFrom: ["F006", "F023", "F026"],
      derivesInto: ["F006", "F025", "F026", "F034", "F037"],
      derivationNote: "Cas limite Sr = 1 de la formule générale F023",
    },
  },

  {
    id: "F025",
    title: "Masse volumique humide — formes équivalentes (Sr = 1)",
    subtitle: "Masse volumique humide — formes équivalentes",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 26,
    equationLatex:
      "\\rho_h = \\left(\\frac{C_w}{\\rho_{s\\text{-remblai}}} + \\frac{1-C_w}{\\rho_w}\\right)^{-1}",
    equationPlainText: "rho_h = (Cw/rho_s + (1-Cw)/rho_w)^(-1)",
    variables: [
      { symbol: "\\rho_h", description: "Masse volumique humide (saturé)", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-remblai}}", description: "Masse volumique des grains du remblai", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
    ],
    keywords: ["wet density", "rho_h", "masse volumique", "inverse", "Cw"],
    contextSnippet:
      "Forme inversée utile quand ρs-remblai est connu directement.",
    derivationLinks: {
      derivedFrom: ["F024"],
      derivesInto: ["F087", "F089"],
      derivationNote: "Réarrangement algébrique de F024",
    },
  },

  {
    id: "F026",
    title: "Densité relative des grains du liant (mélange multi-liant)",
    subtitle: "Masse volumique du liant",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 25,
    equationLatex:
      "\\rho_{s\\text{-liant}} = \\left(\\sum_{i=1}^{N} \\frac{x_i}{\\rho_{s\\text{-cem}_i}}\\right)^{-1}",
    equationPlainText: "rho_s-liant = 1 / (x1/rho_cem1 + x2/rho_cem2 + ...)",
    variables: [
      { symbol: "\\rho_{s\\text{-liant}}", description: "Masse volumique du mélange de liants", unit: "kg/m³" },
      { symbol: "x_i", description: "Proportion massique du ciment i dans le mélange", unit: null },
      { symbol: "\\rho_{s\\text{-cem}_i}", description: "Masse volumique des grains du ciment i", unit: "kg/m³" },
    ],
    keywords: ["liant", "multi-liant", "mélange", "Gs liant", "CP10", "Slag", "Terraflow"],
    contextSnippet:
      "Masse volumique équivalente d'un mélange de liants (ex. 20% GU + 80% Slag).",
    derivationLinks: {
      derivedFrom: ["F008", "F024"],
      derivesInto: ["F024", "F053", "F077"],
      derivationNote: null,
    },
  },

  {
    id: "F027",
    title: "Poids volumique humide γh (tout Sr)",
    subtitle: "Poids volumique",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 28,
    equationLatex:
      "\\gamma_h = g \\cdot \\rho_h = 9.81 \\cdot \\frac{\\rho_w G_s S_r C_w}{S_r C_w + G_s(1-C_w)} \\quad [\\text{kN/m}^3]",
    equationPlainText: "gamma_h = 9.81 * rho_h  [kN/m3]",
    variables: [
      { symbol: "\\gamma_h", description: "Poids volumique humide", unit: "kN/m³" },
      { symbol: "g", description: "Accélération gravitationnelle (9,81 m/s²)", unit: "m/s²" },
      { symbol: "\\rho_h", description: "Masse volumique humide", unit: "kg/m³" },
    ],
    keywords: ["unit weight", "poids volumique", "gamma", "kN/m3", "gravity"],
    contextSnippet: "Poids volumique en kN/m³ obtenu en multipliant ρh par g = 9,81 m/s².",
    derivationLinks: {
      derivedFrom: ["F005", "F023"],
      derivesInto: ["F094"],
      derivationNote: "γh = ρh · g",
    },
  },

  // ============================================================
  // SECTION F — Rapport eau/liant E/L, W/C (p. 29–31)
  // ============================================================

  {
    id: "F028",
    title: "Rapport eau/liant massique (W/C ou E/L)",
    subtitle: "Rapport eau/liant",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 29,
    equationLatex:
      "\\left(\\frac{W}{C}\\right)_m = \\frac{M_w}{M_b}",
    equationPlainText: "W/C (massique) = Mw/Mb",
    variables: [
      { symbol: "(W/C)_m", description: "Rapport eau/liant massique", unit: null },
      { symbol: "M_w", description: "Masse d'eau dans le remblai", unit: "kg" },
      { symbol: "M_b", description: "Masse du liant", unit: "kg" },
    ],
    keywords: ["W/C", "E/L", "water-to-binder", "eau liant", "rapport massique"],
    contextSnippet: "Rapport eau/liant massique utilisé en formulation des remblais et des bétons.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: ["F029", "F030"],
      derivationNote: null,
    },
  },

  {
    id: "F029",
    title: "Rapport eau/liant volumique",
    subtitle: "Rapport eau/liant",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 29,
    equationLatex:
      "\\left(\\frac{W}{C}\\right)_V = \\frac{V_w}{V_b} = \\frac{\\rho_b}{\\rho_w} \\left(\\frac{W}{C}\\right)_m",
    equationPlainText: "W/C (volumique) = Vw/Vb = (rho_b/rho_w) * (W/C)_m",
    variables: [
      { symbol: "(W/C)_V", description: "Rapport eau/liant volumique", unit: null },
      { symbol: "V_w", description: "Volume d'eau", unit: "m³" },
      { symbol: "V_b", description: "Volume du liant", unit: "m³" },
      { symbol: "\\rho_b", description: "Masse volumique du liant", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
    ],
    keywords: ["W/C volumique", "eau/liant", "volume", "Vw/Vb"],
    contextSnippet: "Rapport volumique eau/liant, relié au rapport massique par les densités.",
    derivationLinks: {
      derivedFrom: ["F028"],
      derivesInto: [],
      derivationNote: "(W/C)_V = (W/C)_m · (ρb/ρw)",
    },
  },

  {
    id: "F030",
    title: "Rapport E/L en fonction de Cw et Bw",
    subtitle: "Rapport eau/liant",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 30,
    equationLatex:
      "\\frac{E}{L} = \\frac{W}{C} = \\left(\\frac{1-C_w}{C_w}\\right)\\left(\\frac{1}{B_w}+1\\right) = \\frac{(1-C_w)(1+B_w)}{B_w C_w}",
    equationPlainText: "E/L = W/C = ((1-Cw)/Cw)*(1/Bw + 1) = (1-Cw)*(1+Bw)/(Bw*Cw)",
    variables: [
      { symbol: "E/L", description: "Rapport eau/liant massique", unit: null },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
      { symbol: "B_{ws}", description: "Teneur massique de liant (vs solides)", unit: null },
    ],
    keywords: ["E/L", "W/C", "Cw", "Bw", "eau liant", "water binder ratio"],
    contextSnippet:
      "Expression de E/L depuis Cw et Bw (Dia. 30). Sr n'apparait pas explicitement dans cette forme car il est implicite via Cw.",
    derivationLinks: {
      derivedFrom: ["F001", "F011", "F019", "F028"],
      derivesInto: [],
      derivationNote: "Equivalent aux formes de Dia. 30; la forme en Cw/Bw est la plus stable pour l'usage pratique",
    },
  },

  // ============================================================
  // SECTION G — Porosité, indice des vides, saturation (p. 27, 34–35)
  // ============================================================

  {
    id: "F031",
    title: "Indice des vides en fonction de Gs et Cw",
    subtitle: "Indice des vides",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 34,
    equationLatex:
      "e = \\frac{\\rho_w G_s}{S_r} \\cdot \\frac{1-C_w}{C_w}",
    equationPlainText: "e = rho_w*Gs/Sr * (1-Cw)/Cw",
    variables: [
      { symbol: "e", description: "Indice des vides", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau (1 ou 1000)", unit: null },
      { symbol: "G_s", description: "Densité relative des grains", unit: null },
      { symbol: "S_r", description: "Degré de saturation", unit: null },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
    ],
    keywords: ["void ratio", "indice des vides", "e", "Gs", "Sr", "Cw"],
    contextSnippet:
      "Calcul de l'indice des vides directement depuis Gs, Sr et Cw. Pour Sr=1 : e = Gs·(1–Cw)/Cw.",
    derivationLinks: {
      derivedFrom: ["F004", "F009"],
      derivesInto: ["F005", "F079"],
      derivationNote: "e = w·Gs/Sr = [(1-Cw)/Cw]·Gs/Sr",
    },
  },

  {
    id: "F032",
    title: "Degré de saturation Sr en fonction de w, e, Gs",
    subtitle: "Saturation",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 34,
    equationLatex:
      "S_r = \\frac{w \\cdot G_s}{e} = \\frac{w \\cdot \\rho_d}{(\\rho_s - \\rho_d) \\cdot \\rho_w} \\cdot \\rho_w^2",
    equationPlainText: "Sr = w*Gs/e",
    variables: [
      { symbol: "S_r", description: "Degré de saturation (décimal)", unit: null },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
      { symbol: "G_s", description: "Densité relative des grains", unit: null },
      { symbol: "e", description: "Indice des vides", unit: null },
    ],
    keywords: ["saturation", "Sr", "w", "Gs", "e"],
    contextSnippet: "Relation standard issue de la mécanique des sols.",
    derivationLinks: {
      derivedFrom: ["F003", "F004"],
      derivesInto: ["F003", "F096"],
      derivationNote: "Sr = Vw/Vv = (Mw/ρw)/(e·Vs) = wMs/(ρw·e·Ms/ρs) = w·Gs/e",
    },
  },

  {
    id: "F033",
    title: "Porosité en fonction de n et e",
    subtitle: "Porosité",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 35,
    equationLatex:
      "n = \\frac{e}{1+e} \\qquad e = \\frac{n}{1-n}",
    equationPlainText: "n = e/(1+e) ;  e = n/(1-n)",
    variables: [
      { symbol: "n", description: "Porosité (décimal)", unit: null },
      { symbol: "e", description: "Indice des vides (décimal)", unit: null },
    ],
    keywords: ["porosity", "porosité", "n", "e", "void ratio", "relation"],
    contextSnippet: "Relations fondamentales entre porosité et indice des vides.",
    derivationLinks: {
      derivedFrom: ["F004", "F005"],
      derivesInto: ["F004"],
      derivationNote: "n = Vv/VT = Vv/(Vs+Vv) = e/(1+e)",
    },
  },

  // ============================================================
  // SECTION H — Masse totale de remblai à préparer (p. 39, 41)
  // ============================================================

  {
    id: "F034",
    title: "Masse totale de remblai à préparer (laboratoire)",
    subtitle: "Masse totale de remblai",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 39,
    equationLatex:
      "M_T = \\alpha \\cdot \\rho_h \\cdot V_T",
    equationPlainText: "MT = alpha * rho_h * VT",
    variables: [
      { symbol: "M_T", description: "Masse totale de remblai à préparer", unit: "kg" },
      { symbol: "\\alpha", description: "Facteur de perte (généralement 1,25)", unit: null },
      { symbol: "\\rho_h", description: "Masse volumique totale du remblai frais", unit: "kg/m³" },
      { symbol: "V_T", description: "Volume total des contenants à remplir", unit: "m³" },
    ],
    keywords: ["masse totale", "MT", "laboratoire", "contenant", "facteur perte", "alpha"],
    contextSnippet:
      "Facteur α = 1,25 typiquement. ρh calculé via F024 pour Sr = 1.",
    derivationLinks: {
      derivedFrom: ["F004", "F024"],
      derivesInto: ["F004", "F040"],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION I — Affaissement / Slump (p. 40)
  // ============================================================

  {
    id: "F035",
    title: "Affaissement (Slump) — borne supérieure",
    subtitle: "Affaissement (consistance)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 40,
    equationLatex:
      "S_{\\sup}(\\text{mm}) = \\frac{G_{s\\text{-tail}}}{1 + B_{w\\%}/100} \\left(\\frac{1915 \\times 100}{\\%C_w} - 178.76\\right)",
    equationPlainText: "S_sup = Gs_tail/(1+Bw%/100) * (1915*100/%Cw - 178.76)  [mm]",
    variables: [
      { symbol: "S_{\\sup}", description: "Affaissement maximal (borne supérieure)", unit: "mm" },
      { symbol: "G_{s\\text{-tail}}", description: "Densité relative des résidus", unit: null },
      { symbol: "B_{w\\%}", description: "Taux massique de liant (en %)", unit: "%" },
      { symbol: "\\%C_w", description: "Pourcentage solide massique (%)", unit: "%" },
    ],
    keywords: ["slump", "affaissement", "S_sup", "consistance", "Belem 2007", "cone Abrams"],
    contextSnippet:
      "Modèle empirique (Belem, 2007; 2010; 2023) — affaissement standard cône Abrams 178 mm (7\").",
    derivationLinks: {
      derivedFrom: ["F009"],
      derivesInto: ["F036"],
      derivationNote: null,
    },
  },

  {
    id: "F036",
    title: "Affaissement (Slump) — borne inférieure",
    subtitle: "Affaissement (consistance)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 40,
    equationLatex:
      "S_{\\inf}(\\text{mm}) = \\frac{\\%P_{80\\,\\mu\\text{m}}}{100} \\cdot \\frac{G_{s\\text{-tail}}}{1 + B_{w\\%}/100} \\left(\\frac{1915 \\times 100}{\\%C_w} - 178.76\\right)",
    equationPlainText: "S_inf = (P80um/100) * Gs_tail/(1+Bw%/100) * (1915*100/%Cw - 178.76)  [mm]",
    variables: [
      { symbol: "S_{\\inf}", description: "Affaissement minimal (borne inférieure)", unit: "mm" },
      { symbol: "\\%P_{80\\,\\mu\\text{m}}", description: "Pourcentage de grains passant 80 µm", unit: "%" },
      { symbol: "G_{s\\text{-tail}}", description: "Densité relative des résidus", unit: null },
      { symbol: "B_{w\\%}", description: "Taux massique de liant (%)", unit: "%" },
      { symbol: "\\%C_w", description: "Pourcentage solide (%)", unit: "%" },
    ],
    keywords: ["slump", "affaissement", "P80", "grains fins", "Belem 2007"],
    contextSnippet:
      "Borne inférieure dépendant du % passant 80 µm. Intervalle : S_inf ≤ S ≤ S_sup.",
    derivationLinks: {
      derivedFrom: ["F035"],
      derivesInto: [],
      derivationNote: "Forme identique à F035 avec facteur (%P80µm/100)",
    },
  },

  // ============================================================
  // SECTION J — Masses des ingrédients au labo — Méthode 1 (p. 44)
  // ============================================================

  {
    id: "F037",
    title: "Méthode 1 — Masse totale de remblai",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_h = \\rho_h \\cdot V_T \\qquad \\rho_h = \\frac{\\rho_w \\, G_s \\, C_w \\, S_r}{S_r C_w + G_s(1-C_w)}",
    equationPlainText: "Mh = rho_h * VT  [méthode 1, Sr=1]",
    variables: [
      { symbol: "M_h", description: "Masse totale de remblai (humide)", unit: "kg" },
      { symbol: "\\rho_h", description: "Masse volumique humide du remblai frais", unit: "kg/m³" },
      { symbol: "V_T", description: "Volume total à remplir", unit: "m³" },
    ],
    keywords: ["masse totale", "méthode 1", "laboratoire", "remblai", "Mh"],
    contextSnippet:
      "Point de départ de la méthode 1 : calcul de Mh puis distribution aux solides, liant, eau.",
    derivationLinks: {
      derivedFrom: ["F024"],
      derivesInto: ["F038", "F039", "F040", "F041", "F042", "F043", "F070", "F073", "F075"],
      derivationNote: null,
    },
  },

  {
    id: "F038",
    title: "Méthode 1 — Masse des solides (résidus + liant)",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_s = M_h \\cdot C_w = \\rho_h \\cdot V_T \\cdot C_w",
    equationPlainText: "Ms = Mh*Cw = rho_h*VT*Cw",
    variables: [
      { symbol: "M_s", description: "Masse totale des solides (résidus secs + liant)", unit: "kg" },
      { symbol: "M_h", description: "Masse humide totale du remblai", unit: "kg" },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
    ],
    keywords: ["Ms", "solides", "méthode 1", "laboratoire"],
    contextSnippet: "Masse des solides (tailings secs + liant sec) dans le volume de remblai.",
    derivationLinks: {
      derivedFrom: ["F009", "F037"],
      derivesInto: ["F039", "F040"],
      derivationNote: null,
    },
  },

  {
    id: "F039",
    title: "Méthode 1 — Masse de résidus secs",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_{t\\text{-secs}} = \\frac{M_h}{(1+w_{\\text{rés}})(1+B_w)}",
    equationPlainText: "Mt-secs = Mh / ((1+w_res)*(1+Bw))",
    variables: [
      { symbol: "M_{t\\text{-secs}}", description: "Masse des résidus secs", unit: "kg" },
      { symbol: "M_h", description: "Masse humide totale du remblai", unit: "kg" },
      { symbol: "w_{\\text{rés}}", description: "Teneur en eau des résidus d'entrée (décimal)", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["résidus secs", "tailings", "Mt-secs", "w_res", "méthode 1"],
    contextSnippet: "Masse de résidus secs tenant compte de leur teneur en eau initiale.",
    derivationLinks: {
      derivedFrom: ["F023", "F037", "F038"],
      derivesInto: ["F040", "F041", "F042"],
      derivationNote: null,
    },
  },

  {
    id: "F040",
    title: "Méthode 1 — Masse du liant",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_b = M_{t\\text{-secs}} \\cdot B_w = \\frac{M_h \\cdot C_w \\cdot B_w}{1 + B_w}",
    equationPlainText: "Mb = Mt-secs * Bw = Mh*Cw*Bw/(1+Bw)",
    variables: [
      { symbol: "M_b", description: "Masse du liant sec", unit: "kg" },
      { symbol: "M_{t\\text{-secs}}", description: "Masse des résidus secs", unit: "kg" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "M_h", description: "Masse humide totale du remblai", unit: "kg" },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
    ],
    keywords: ["liant", "Mb", "binder mass", "dosage", "méthode 1"],
    contextSnippet: "Masse de liant sec à peser au laboratoire.",
    derivationLinks: {
      derivedFrom: ["F013", "F016", "F023", "F034", "F037", "F038", "F039"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F041",
    title: "Méthode 1 — Masse d'eau totale",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_w = M_h (1 - C_w) = \\frac{\\rho_s \\, V_T \\, C_w}{1} (1-C_w)",
    equationPlainText: "Mw = Mh*(1-Cw)",
    variables: [
      { symbol: "M_w", description: "Masse totale d'eau dans le mélange", unit: "kg" },
      { symbol: "M_h", description: "Masse humide totale", unit: "kg" },
      { symbol: "C_w", description: "Pourcentage solide (décimal)", unit: null },
    ],
    keywords: ["eau totale", "Mw", "water", "méthode 1"],
    contextSnippet: "Eau totale requise dans le mélange (eau des résidus + eau ajoutée).",
    derivationLinks: {
      derivedFrom: ["F013", "F014", "F037", "F039"],
      derivesInto: ["F043"],
      derivationNote: null,
    },
  },

  {
    id: "F042",
    title: "Méthode 1 — Masse de résidus humides",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_{t\\text{-hum}} = M_{t\\text{-secs}} \\cdot (1 + w_{\\text{rés}})",
    equationPlainText: "Mt-hum = Mt-secs * (1 + w_res)",
    variables: [
      { symbol: "M_{t\\text{-hum}}", description: "Masse requise de résidus humides", unit: "kg" },
      { symbol: "M_{t\\text{-secs}}", description: "Masse des résidus secs", unit: "kg" },
      { symbol: "w_{\\text{rés}}", description: "Teneur en eau des résidus (décimal)", unit: null },
    ],
    keywords: ["résidus humides", "Mt-hum", "tailings wet", "w_res"],
    contextSnippet: "Masse à peser de résidus tels qu'ils arrivent au labo (avec leur humidité).",
    derivationLinks: {
      derivedFrom: ["F037", "F039"],
      derivesInto: ["F043"],
      derivationNote: null,
    },
  },

  {
    id: "F043",
    title: "Méthode 1 — Masse d'eau à ajouter",
    subtitle: "Masses des ingrédients (Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 44,
    equationLatex:
      "M_{w\\text{-aj}} = M_w - M_{w\\text{-rés}} = M_h(1-C_w) - M_{t\\text{-hum}}(1-C_{w\\text{-rés}})",
    equationPlainText: "Mw-aj = Mw - Mw-res = Mh*(1-Cw) - Mt-hum*(1-Cw_res)",
    variables: [
      { symbol: "M_{w\\text{-aj}}", description: "Masse d'eau à ajouter au mélange", unit: "kg" },
      { symbol: "M_w", description: "Masse d'eau totale requise", unit: "kg" },
      { symbol: "M_{w\\text{-rés}}", description: "Masse d'eau contenue dans les résidus", unit: "kg" },
      { symbol: "C_{w\\text{-rés}}", description: "% solide des résidus d'entrée", unit: null },
    ],
    keywords: ["eau ajoutée", "Mw-aj", "water to add", "méthode 1"],
    contextSnippet: "Volume d'eau à mesurer et à ajouter en sus des résidus humides.",
    derivationLinks: {
      derivedFrom: ["F037", "F041", "F042"],
      derivesInto: ["F068", "F074"],
      derivationNote: "Mw-aj = Meau_totale – Meau_résidus = Mw – (Mt-hum – Mt-secs)",
    },
  },

  // ============================================================
  // SECTION K — Impact du Gs des résidus sur le dosage (p. 49–52)
  // ============================================================

  {
    id: "F044",
    title: "Taux volumique initial de liant",
    subtitle: "Impact du Gs sur le dosage de liant",
    section: "Impact du Gs des résidus sur le dosage de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 49,
    equationLatex:
      "B_{v\\text{-init}} = B_{w\\text{-init}} \\cdot \\frac{\\rho_{s\\text{-résidus}}}{\\rho_{s\\text{-liant}}}",
    equationPlainText: "Bv-init = Bw-init * (rho_s-residus / rho_s-liant)",
    variables: [
      { symbol: "B_{v\\text{-init}}", description: "Taux volumique initial de liant", unit: null },
      { symbol: "B_{w\\text{-init}}", description: "Taux massique initial de liant", unit: null },
      { symbol: "\\rho_{s\\text{-résidus}}", description: "Masse volumique initiale des résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-liant}}", description: "Masse volumique des grains de liant", unit: "kg/m³" },
    ],
    keywords: ["Bv", "taux volumique", "Gs impact", "Belem 2008"],
    contextSnippet:
      "Le taux volumique Bv doit rester constant lorsque Gs des résidus change (Belem & Benzaazoua, 2008).",
    derivationLinks: {
      derivedFrom: ["F014", "F022"],
      derivesInto: ["F045"],
      derivationNote: "Bv = Vb/Vt = Bw · (ρt/ρb)",
    },
  },

  {
    id: "F045",
    title: "Taux massique de liant ajusté",
    subtitle: "Impact du Gs sur le dosage de liant",
    section: "Impact du Gs des résidus sur le dosage de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 50,
    equationLatex:
      "B_{w\\text{-ajust}} = B_{w\\text{-init}} \\cdot \\frac{\\rho_{s\\text{-rés-init}}}{\\rho_{s\\text{-rés-actuel}}}",
    equationPlainText: "Bw-ajust = Bw-init * (rho_s-res-init / rho_s-res-actuel)",
    variables: [
      { symbol: "B_{w\\text{-ajust}}", description: "Taux massique de liant ajusté", unit: null },
      { symbol: "B_{w\\text{-init}}", description: "Taux massique de liant initial", unit: null },
      { symbol: "\\rho_{s\\text{-rés-init}}", description: "Masse volumique initiale des résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-rés-actuel}}", description: "Masse volumique actuelle des résidus", unit: "kg/m³" },
    ],
    keywords: ["Bw ajusté", "adjusted binder", "Gs variation", "Belem 2008"],
    contextSnippet:
      "Quand Gs des résidus change en cours d'exploitation, Bw doit être ajusté pour maintenir Bv constant.",
    derivationLinks: {
      derivedFrom: ["F044"],
      derivesInto: ["F046"],
      derivationNote: "Condition Bv-ajust = Bv-init → Bw-ajust = Bw-init · (ρt-init/ρt-actuel)",
    },
  },

  {
    id: "F046",
    title: "Variation de taux de liant ΔBw (sous/sur-dosage)",
    subtitle: "Impact du Gs sur le dosage de liant",
    section: "Impact du Gs des résidus sur le dosage de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 51,
    equationLatex:
      "\\Delta B_w = B_{w\\text{-init}} - B_{w\\text{-ajust}} = B_{w\\text{-init}} \\left(1 - \\frac{\\rho_{s\\text{-rés-init}}}{\\rho_{s\\text{-rés-actuel}}}\\right)",
    equationPlainText: "DeltaBw = Bw-init * (1 - rho_init/rho_actuel)",
    variables: [
      { symbol: "\\Delta B_w", description: "Variation du taux de liant (décimal)", unit: null },
      { symbol: "B_{w\\text{-init}}", description: "Taux massique de liant initial", unit: null },
      { symbol: "\\rho_{s\\text{-rés-init}}", description: "Masse volumique initiale des résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-rés-actuel}}", description: "Masse volumique actuelle des résidus", unit: "kg/m³" },
    ],
    keywords: ["delta Bw", "sous-dosage", "surdosage", "ΔBw", "Belem 2008"],
    contextSnippet:
      "Si ΔBw < 0 : sous-dosage (manque de résistance) ; si ΔBw > 0 : surdosage (gain économique).",
    derivationLinks: {
      derivedFrom: ["F045"],
      derivesInto: ["F047"],
      derivationNote: "ΔBw = Bw-init – Bw-ajust",
    },
  },

  {
    id: "F047",
    title: "Gain ou perte financière annuelle liée à ΔBw",
    subtitle: "Impact du Gs sur le dosage de liant",
    section: "Impact du Gs des résidus sur le dosage de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 52,
    equationLatex:
      "\\text{Gain/Perte}\\,(\\$/\\text{an}) = M_{\\text{rés}}\\,(\\text{t/an}) \\cdot \\Delta B_w \\cdot \\$_{\\text{liant}}\\,(\\$/\\text{t})",
    equationPlainText: "Gain/Perte ($/an) = M_res (t/an) * DeltaBw * $liant ($/t)",
    variables: [
      { symbol: "M_{\\text{rés}}", description: "Production annuelle de résidus", unit: "t/an" },
      { symbol: "\\Delta B_w", description: "Variation du taux de liant", unit: null },
      { symbol: "\\$_{\\text{liant}}", description: "Coût du liant", unit: "$/t" },
    ],
    keywords: ["économique", "coût liant", "gain perte", "ΔBw", "annuel"],
    contextSnippet: "Calcul de l'impact économique annuel d'une variation de la densité des résidus.",
    derivationLinks: {
      derivedFrom: ["F046"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION L — Remblais en pâte aux granulats (PAF, RPG, p. 55–62)
  // ============================================================

  {
    id: "F048",
    title: "PAF — Masse de résidus secs",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 56,
    equationLatex:
      "M_t = M_T (1 - A_m) \\cdot \\frac{C_{w\\text{-PAF}}}{1 + B_w}",
    equationPlainText: "Mt = MT*(1-Am)*Cw_PAF/(1+Bw)",
    variables: [
      { symbol: "M_t", description: "Masse de résidus secs dans le PAF", unit: "kg" },
      { symbol: "M_T", description: "Masse totale du PAF", unit: "kg" },
      { symbol: "A_m", description: "Fraction massique des agrégats (vs résidus + agrégats)", unit: null },
      { symbol: "C_{w\\text{-PAF}}", description: "% solide massique du PAF", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["PAF", "RPG", "résidus", "granulats", "mt", "aggregate paste fill"],
    contextSnippet:
      "PAF = Paste Aggregate Fill = remblai en pâte cimenté aux granulats (remblai mixte).",
    derivationLinks: {
      derivedFrom: ["F009", "F016"],
      derivesInto: ["F049", "F050", "F051", "F052"],
      derivationNote: null,
    },
  },

  {
    id: "F049",
    title: "PAF — Masse de résidus humides",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 56,
    equationLatex:
      "M_{t\\text{-wet}} = \\frac{M_t}{C_{w\\text{-tail}}}",
    equationPlainText: "Mt-wet = Mt / Cw-tail",
    variables: [
      { symbol: "M_{t\\text{-wet}}", description: "Masse de résidus humides pour le PAF", unit: "kg" },
      { symbol: "M_t", description: "Masse de résidus secs", unit: "kg" },
      { symbol: "C_{w\\text{-tail}}", description: "% solide massique des résidus d'entrée", unit: null },
    ],
    keywords: ["résidus humides", "PAF", "Cwt", "Mt-wet"],
    contextSnippet: "Conversion de la masse sèche de résidus en masse humide à partir de leur %Cw.",
    derivationLinks: {
      derivedFrom: ["F048"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F050",
    title: "PAF — Masse d'agrégats secs",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 57,
    equationLatex:
      "M_{ag} = M_T \\cdot A_m \\cdot \\frac{C_{w\\text{-PAF}}}{1 + B_w}",
    equationPlainText: "Mag = MT*Am*Cw_PAF/(1+Bw)",
    variables: [
      { symbol: "M_{ag}", description: "Masse d'agrégats secs (roches stériles concassées)", unit: "kg" },
      { symbol: "M_T", description: "Masse totale du PAF", unit: "kg" },
      { symbol: "A_m", description: "Fraction massique des agrégats", unit: null },
      { symbol: "C_{w\\text{-PAF}}", description: "% solide du PAF", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["agrégats", "roches stériles", "Mag", "PAF", "RPG"],
    contextSnippet: "Masse d'agrégats (ex. roches stériles concassées) dans le PAF.",
    derivationLinks: {
      derivedFrom: ["F048"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F051",
    title: "PAF — Masse du liant",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 57,
    equationLatex:
      "M_b = M_T \\cdot \\frac{B_w}{1 + B_w} \\cdot C_{w\\text{-PAF}}",
    equationPlainText: "Mb = MT * Bw/(1+Bw) * Cw_PAF",
    variables: [
      { symbol: "M_b", description: "Masse du liant", unit: "kg" },
      { symbol: "M_T", description: "Masse totale du PAF", unit: "kg" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "C_{w\\text{-PAF}}", description: "% solide du PAF", unit: null },
    ],
    keywords: ["liant", "Mb", "PAF", "binder mass"],
    contextSnippet: "Masse de liant dans le PAF.",
    derivationLinks: {
      derivedFrom: ["F016", "F048"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F052",
    title: "PAF — Masse d'eau totale et eau à ajouter",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 57,
    equationLatex:
      "M_w = M_T(1 - C_{w\\text{-PAF}}) \\qquad M_{w\\text{-add}} = M_w - M_{w\\text{-tail}}",
    equationPlainText: "Mw = MT*(1-Cw_PAF) ; Mw-add = Mw - Mw-tailings",
    variables: [
      { symbol: "M_w", description: "Masse totale d'eau dans le PAF", unit: "kg" },
      { symbol: "M_T", description: "Masse totale du PAF", unit: "kg" },
      { symbol: "C_{w\\text{-PAF}}", description: "% solide massique du PAF", unit: null },
      { symbol: "M_{w\\text{-add}}", description: "Masse d'eau à ajouter", unit: "kg" },
      { symbol: "M_{w\\text{-tail}}", description: "Eau dans les résidus d'entrée", unit: "kg" },
    ],
    keywords: ["eau totale", "eau ajoutée", "PAF", "Mw-add"],
    contextSnippet: "Eau totale dans le PAF puis eau nette à ajouter après soustraction de l'eau des résidus.",
    derivationLinks: {
      derivedFrom: ["F048"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F053",
    title: "PAF — Densité des grains (ρs-PAF)",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 59,
    equationLatex:
      "\\rho_{s\\text{-PAF}} = (1 + B_w) \\left(\\frac{A_m}{\\rho_{s\\text{-ag}}} + \\frac{1-A_m}{\\rho_{s\\text{-t}}} + \\frac{B_w}{\\rho_{s\\text{-b}}}\\right)^{-1}",
    equationPlainText: "rho_s-PAF = (1+Bw) / (Am/rho_ag + (1-Am)/rho_t + Bw/rho_b)",
    variables: [
      { symbol: "\\rho_{s\\text{-PAF}}", description: "Masse volumique des grains du PAF (agrégats + résidus + liant)", unit: "kg/m³" },
      { symbol: "A_m", description: "Fraction massique des agrégats", unit: null },
      { symbol: "\\rho_{s\\text{-ag}}", description: "Masse volumique des grains d'agrégats", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-t}}", description: "Masse volumique des grains de résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-b}}", description: "Masse volumique des grains de liant", unit: "kg/m³" },
    ],
    keywords: ["densité grains PAF", "rho_s-PAF", "agrégats", "résidus", "liant"],
    contextSnippet: "Masse volumique équivalente des grains solides du PAF pour le calcul de ρbulk-PAF.",
    derivationLinks: {
      derivedFrom: ["F026"],
      derivesInto: ["F054", "F084", "F087", "F088", "F089"],
      derivationNote: "Généralisation de la formule de mélange à trois composantes",
    },
  },

  {
    id: "F054",
    title: "PAF — Relations Am ↔ am",
    subtitle: "Remblais en pâte aux granulats (PAF/RPG)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 59,
    equationLatex:
      "a_m = \\frac{A_m}{1 - A_m} \\qquad A_m = \\frac{a_m}{1 + a_m}",
    equationPlainText: "am = Am/(1-Am) ; Am = am/(1+am)",
    variables: [
      { symbol: "A_m", description: "Fraction massique des agrégats (vs résidus + agrégats)", unit: null },
      { symbol: "a_m", description: "Ratio massique agrégats/résidus", unit: null },
    ],
    keywords: ["Am", "am", "agrégats", "fraction", "ratio", "PAF"],
    contextSnippet: "Conversion entre fraction massique Am et ratio am = Mag/Mt.",
    derivationLinks: {
      derivedFrom: ["F022", "F053"],
      derivesInto: ["F083", "F084", "F086"],
      derivationNote: "Analogue à Bw ↔ Bws (F019)",
    },
  },

  // ============================================================
  // SECTION M — Remblais rocheux cimentés (CRF/RRC, p. 65–70)
  // ============================================================

  {
    id: "F055",
    title: "CRF — Conversions de dosage de retardateur (SR)",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 67,
    equationLatex:
      "D_1 = 10^{-5} D_0 \\quad D_2 = 10^{-2} D_0 \\quad D_3 = 10 \\, D_0",
    equationPlainText: "D1 = 1e-5*D0 ; D2 = 1e-2*D0 ; D3 = 10*D0",
    variables: [
      { symbol: "D_0", description: "Dosage retardateur recommandé (ml/100 kg ciment)", unit: "ml/100 kg" },
      { symbol: "D_1", description: "Dosage retardateur (ml/g ciment)", unit: "ml/g" },
      { symbol: "D_2", description: "Dosage retardateur (ml/kg ciment)", unit: "ml/kg" },
      { symbol: "D_3", description: "Dosage retardateur (ml/t ciment)", unit: "ml/t" },
    ],
    keywords: ["retardateur de prise", "setting retarder", "SR", "dosage", "D0", "D1", "CRF"],
    contextSnippet:
      "Conversions d'unités pour le dosage du retardateur de prise (50–260 ml/100 kg de ciment).",
    derivationLinks: {
      derivedFrom: ["F056", "F090", "F091", "F092"],
      derivesInto: ["F056", "F057", "F090", "F091", "F092"],
      derivationNote: null,
    },
  },

  {
    id: "F056",
    title: "CRF — Taux massique de liant",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 67,
    equationLatex:
      "B_w = \\frac{M_c}{M_{WR}} \\qquad M_c = B_w \\cdot M_{WR}",
    equationPlainText: "Bw = Mc/MWR ; Mc = Bw*MWR",
    variables: [
      { symbol: "B_w", description: "Taux massique de liant pour le CRF", unit: null },
      { symbol: "M_c", description: "Masse de ciment/liant sec", unit: "kg" },
      { symbol: "M_{WR}", description: "Masse des roches stériles (waste rock)", unit: "kg" },
    ],
    keywords: ["CRF", "RRC", "remblai rocheux", "ciment", "Bw", "waste rock"],
    contextSnippet: "Définition du taux de liant pour le remblai rocheux cimenté (CRF).",
    derivationLinks: {
      derivedFrom: ["F016", "F055"],
      derivesInto: ["F055", "F057", "F058", "F090", "F091", "F092"],
      derivationNote: "Analogue à Bw pour RPC mais les agrégats = roches stériles",
    },
  },

  {
    id: "F057",
    title: "CRF — Rapport eau/ciment (W/C)",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 67,
    equationLatex:
      "\\frac{W}{C} = \\frac{M^*}{M_c} = \\frac{M_w}{M_c} + \\frac{M_{SR}}{M_c}",
    equationPlainText: "W/C = M*/Mc = Mw/Mc + MSR/Mc",
    variables: [
      { symbol: "W/C", description: "Rapport eau/ciment du coulis (eau + retardateur)", unit: null },
      { symbol: "M^*", description: "Masse du fluide (eau + retardateur de prise)", unit: "kg" },
      { symbol: "M_c", description: "Masse de ciment", unit: "kg" },
      { symbol: "M_w", description: "Masse d'eau", unit: "kg" },
      { symbol: "M_{SR}", description: "Masse du retardateur de prise", unit: "kg" },
    ],
    keywords: ["W/C", "CRF", "eau/ciment", "retardateur", "coulis"],
    contextSnippet: "W/C du coulis cimentaire (coulis = eau + retardateur + ciment).",
    derivationLinks: {
      derivedFrom: ["F055", "F056"],
      derivesInto: ["F058", "F059", "F060", "F092"],
      derivationNote: null,
    },
  },

  {
    id: "F058",
    title: "CRF — Teneur en eau massique w",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 67,
    equationLatex:
      "w = \\frac{M^*}{M_s} = \\frac{(W/C) \\cdot B_w}{1 + B_w}",
    equationPlainText: "w = M*/Ms = (W/C)*Bw/(1+Bw)",
    variables: [
      { symbol: "w", description: "Teneur en eau massique du CRF", unit: null },
      { symbol: "M^*", description: "Masse du fluide (eau + SR)", unit: "kg" },
      { symbol: "M_s", description: "Masse des solides (roches + ciment)", unit: "kg" },
      { symbol: "W/C", description: "Rapport eau/ciment du coulis", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["CRF", "teneur en eau", "w", "W/C", "Bw"],
    contextSnippet: "Teneur en eau du CRF reliée au W/C du coulis et au taux de liant Bw.",
    derivationLinks: {
      derivedFrom: ["F056", "F057"],
      derivesInto: ["F059", "F060"],
      derivationNote: "w = M*/(MWR+Mc) = (W/C)·Mc/(MWR+Mc) = (W/C)·Bw/(1+Bw)",
    },
  },

  {
    id: "F059",
    title: "CRF — Pourcentage solide massique",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 68,
    equationLatex:
      "C_w = \\frac{M_s}{M_{CRF}} = \\frac{1}{1+w} = \\frac{1+B_w}{1+B_w(1+W/C)}",
    equationPlainText: "Cw = Ms/MCRF = 1/(1+w) = (1+Bw)/(1+Bw*(1+W/C))",
    variables: [
      { symbol: "C_w", description: "% solide massique du CRF", unit: null },
      { symbol: "M_s", description: "Masse des solides", unit: "kg" },
      { symbol: "M_{CRF}", description: "Masse totale du CRF", unit: "kg" },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "W/C", description: "Rapport eau/ciment du coulis", unit: null },
    ],
    keywords: ["Cw", "CRF", "solide", "Bw", "W/C"],
    contextSnippet: "% solide du CRF en fonction du W/C et de Bw.",
    derivationLinks: {
      derivedFrom: ["F011", "F057", "F058"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F060",
    title: "CRF — Masse totale et masse de roches stériles",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 68,
    equationLatex:
      "M_{CRF} = \\gamma_{\\text{wet}} \\cdot V_{CRF} \\qquad M_{WR} = \\frac{M_{CRF}}{1 + B_w\\left(1 + \\dfrac{W}{C}\\right)}",
    equationPlainText: "MCRF = gamma_wet * VCRF ; MWR = MCRF/(1+Bw*(1+W/C))",
    variables: [
      { symbol: "M_{CRF}", description: "Masse totale de CRF", unit: "kg" },
      { symbol: "\\gamma_{\\text{wet}}", description: "Poids volumique humide du CRF", unit: "kN/m³" },
      { symbol: "V_{CRF}", description: "Volume du chantier à remblayer", unit: "m³" },
      { symbol: "M_{WR}", description: "Masse des roches stériles", unit: "kg" },
    ],
    keywords: ["MCRF", "masse totale CRF", "roches stériles", "MWR"],
    contextSnippet: "Calcul des quantités de CRF depuis le volume du chantier et les paramètres de formulation.",
    derivationLinks: {
      derivedFrom: ["F057", "F058"],
      derivesInto: ["F092"],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION N — Calculs à l'usine de remblai (p. 72–83)
  // ============================================================

  {
    id: "F061",
    title: "Facteur de remplacement — remblai rocheux NR",
    subtitle: "Facteurs de remplacement (usine)",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 73,
    equationLatex:
      "N_R = 0.71 \\cdot \\frac{\\rho_R}{\\rho_0}",
    equationPlainText: "NR = 0.71 * rho_R / rho_0",
    variables: [
      { symbol: "N_R", description: "Facteur de remplacement — remblai rocheux", unit: null },
      { symbol: "\\rho_R", description: "Masse volumique des roches stériles", unit: "t/m³" },
      { symbol: "\\rho_0", description: "Masse volumique du minerai", unit: "t/m³" },
    ],
    keywords: ["NR", "facteur remplacement", "remblai rocheux", "Hassani Bois 1992", "usine"],
    contextSnippet:
      "Facteur NR de Hassani & Bois (1992) pour estimer la quantité de remblai rocheux nécessaire.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: ["F063"],
      derivationNote: null,
    },
  },

  {
    id: "F062",
    title: "Facteur de remplacement — remblai hydraulique NT",
    subtitle: "Facteurs de remplacement (usine)",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 73,
    equationLatex:
      "N_T = 0.64 \\cdot \\frac{\\rho_T}{\\rho_0}",
    equationPlainText: "NT = 0.64 * rho_T / rho_0",
    variables: [
      { symbol: "N_T", description: "Facteur de remplacement — remblai hydraulique", unit: null },
      { symbol: "\\rho_T", description: "Masse volumique des résidus", unit: "t/m³" },
      { symbol: "\\rho_0", description: "Masse volumique du minerai", unit: "t/m³" },
    ],
    keywords: ["NT", "facteur remplacement", "remblai hydraulique", "Hassani Bois 1992"],
    contextSnippet:
      "Facteur NT de Hassani & Bois (1992) pour estimer la quantité de remblai hydraulique (ou en pâte).",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: ["F064"],
      derivationNote: null,
    },
  },

  {
    id: "F063",
    title: "Masse de remblai rocheux nécessaire",
    subtitle: "Calculs à l'usine — remblai rocheux",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 74,
    equationLatex:
      "M_{r\\text{-rocheux}} = M_{\\text{minerai}} \\cdot N_R",
    equationPlainText: "Mr-rocheux = Mminerai * NR",
    variables: [
      { symbol: "M_{r\\text{-rocheux}}", description: "Masse de remblai rocheux nécessaire", unit: "t" },
      { symbol: "M_{\\text{minerai}}", description: "Masse de minerai extrait", unit: "t" },
      { symbol: "N_R", description: "Facteur de remplacement rocheux", unit: null },
    ],
    keywords: ["remblai rocheux", "CRF", "NR", "usine", "Hassani 1992"],
    contextSnippet: "Estimation de la quantité de remblai rocheux à partir de la production minière.",
    derivationLinks: {
      derivedFrom: ["F061"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F064",
    title: "Masse de remblai hydraulique ou en pâte nécessaire",
    subtitle: "Calculs à l'usine — remblai hydraulique / pâte",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 75,
    equationLatex:
      "M_{r\\text{-hyd}} = M_{\\text{minerai}} \\cdot N_T \\qquad M_{r\\text{-pâte}} = M_{\\text{minerai}} \\cdot N_P",
    equationPlainText: "Mr-hyd = Mminerai*NT ; Mr-pate = Mminerai*NP",
    variables: [
      { symbol: "M_{r\\text{-hyd}}", description: "Masse de remblai hydraulique nécessaire", unit: "t" },
      { symbol: "M_{r\\text{-pâte}}", description: "Masse de remblai en pâte nécessaire", unit: "t" },
      { symbol: "M_{\\text{minerai}}", description: "Masse de minerai extrait", unit: "t" },
      { symbol: "N_T", description: "Facteur de remplacement hydraulique", unit: null },
      { symbol: "N_P", description: "Facteur de remplacement remblai en pâte", unit: null },
    ],
    keywords: ["remblai hydraulique", "RPC", "NT", "NP", "usine", "Hassani 1992"],
    contextSnippet: "Estimation de la quantité de remblai hydraulique (RH/RHC) ou en pâte (RPC).",
    derivationLinks: {
      derivedFrom: ["F062"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F065",
    title: "Masse de RPC à l'usine (ρRPC × VRPC)",
    subtitle: "Calculs à l'usine — remblai en pâte",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 77,
    equationLatex:
      "M_{RPC} = \\rho_{RPC} \\cdot V_{RPC} \\qquad \\rho_{RPC} = \\frac{\\rho_s}{C_w + (1-C_w) G_s / S_r}",
    equationPlainText: "MRPC = rho_RPC * VRPC",
    variables: [
      { symbol: "M_{RPC}", description: "Masse de remblai en pâte utilisée (fraîche)", unit: "t" },
      { symbol: "\\rho_{RPC}", description: "Masse volumique totale du remblai frais", unit: "t/m³" },
      { symbol: "V_{RPC}", description: "Volume total du chantier à remblayer", unit: "m³" },
    ],
    keywords: ["MRPC", "usine", "RPC", "remblai pâte", "chantier", "volume"],
    contextSnippet: "Calcul de la quantité de remblai en pâte fraîche à produire selon le volume du chantier.",
    derivationLinks: {
      derivedFrom: ["F023"],
      derivesInto: ["F066", "F068"],
      derivationNote: null,
    },
  },

  {
    id: "F066",
    title: "Production de résidus secs à l'usine",
    subtitle: "Calculs à l'usine — résidus",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 78,
    equationLatex:
      "M_{\\text{rés-sec}} = \\left(1 - \\sum_{i=1}^n R_i X_i\\right) P_R",
    equationPlainText: "M_res-sec = (1 - sum(Ri*Xi)) * PR  [t/j]",
    variables: [
      { symbol: "M_{\\text{rés-sec}}", description: "Production de résidus secs", unit: "t/j" },
      { symbol: "R_i", description: "Taux de récupération du métal i (90–95 %)", unit: null },
      { symbol: "X_i", description: "Teneur massique du métal i dans le minerai", unit: null },
      { symbol: "P_R", description: "Taux de production de minerai", unit: "t/j" },
    ],
    keywords: ["résidus secs", "production", "usine", "métaux", "récupération", "tailings"],
    contextSnippet:
      "Production journalière de résidus secs disponibles pour la fabrication du remblai.",
    derivationLinks: {
      derivedFrom: ["F065"],
      derivesInto: ["F067"],
      derivationNote: null,
    },
  },

  {
    id: "F067",
    title: "Masse de résidus humides nécessaires à l'usine",
    subtitle: "Calculs à l'usine — résidus",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 78,
    equationLatex:
      "M_{\\text{rés-hum}} = \\frac{x \\cdot M_{\\text{rés-sec}}}{C_{w\\text{-rés}}} = x \\cdot M_{\\text{rés-sec}}(1+w)",
    equationPlainText: "M_res-hum = x*M_res-sec/Cw-res  [t/j]",
    variables: [
      { symbol: "M_{\\text{rés-hum}}", description: "Masse de résidus humides (filtrés) nécessaires", unit: "t/j" },
      { symbol: "x", description: "Fraction de résidus utilisée pour le remblai", unit: null },
      { symbol: "M_{\\text{rés-sec}}", description: "Production de résidus secs", unit: "t/j" },
      { symbol: "C_{w\\text{-rés}}", description: "% solide massique des résidus filtrés", unit: null },
    ],
    keywords: ["résidus humides", "filtrés", "usine", "x fraction"],
    contextSnippet: "Quantité de résidus humides à préparer par l'usine de remblai.",
    derivationLinks: {
      derivedFrom: ["F066"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F068",
    title: "Masse d'eau à ajouter au mélangeur (usine)",
    subtitle: "Calculs à l'usine — eau",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 83,
    equationLatex:
      "M_{w\\text{-aj}} = M_{\\text{rs}}(1+B_w) \\left(\\frac{1-C_w}{C_w} - \\frac{1-C_{w\\text{-rés}}}{C_{w\\text{-rés}}}\\right)",
    equationPlainText: "Mw-aj = M_rs*(1+Bw)*((1-Cw)/Cw - (1-Cw_res)/Cw_res)  [t/h]",
    variables: [
      { symbol: "M_{w\\text{-aj}}", description: "Masse d'eau à ajouter au mélangeur", unit: "t/h" },
      { symbol: "M_{\\text{rs}}", description: "Masse de résidus secs (t/h)", unit: "t/h" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "C_w", description: "% solide du remblai final", unit: null },
      { symbol: "C_{w\\text{-rés}}", description: "% solide des résidus filtrés entrants", unit: null },
    ],
    keywords: ["eau mélangeur", "Mw-aj", "usine", "filtres", "Bw", "Cw"],
    contextSnippet:
      "Formule dérivée utilisée à l'usine (exemple 3 — Dia. 83). Résidus filtrés à 80 %, remblai cible 78 %, Bw = 5 %.",
    derivationLinks: {
      derivedFrom: ["F043", "F065"],
      derivesInto: [],
      derivationNote: "Bilan de masse : Mw-aj = Meau_mélange – Meau_résidus",
    },
  },

  {
    id: "F069",
    title: "Masses de résidus secs, liant et eau (depuis M_remblai connu)",
    subtitle: "Calculs à l'usine — ingrédients",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 80,
    equationLatex:
      "M_t = \\frac{M_{\\text{rem}}}{(1+w)(1+B_w)} \\qquad M_b = C_w M_{\\text{rem}} - M_t \\qquad M_{\\text{eau}} = M_{\\text{rem}} - M_t - M_b",
    equationPlainText: "Mt = M_remblai/((1+w)*(1+Bw)) ; Mb = Cw*M_rem - Mt ; Meau = Mrem - Mt - Mb",
    variables: [
      { symbol: "M_{\\text{rem}}", description: "Masse totale de remblai connue (ex. tonnage chantier)", unit: "t" },
      { symbol: "M_t", description: "Masse de résidus secs", unit: "t" },
      { symbol: "M_b", description: "Masse de liant", unit: "t" },
      { symbol: "M_{\\text{eau}}", description: "Masse d'eau totale", unit: "t" },
      { symbol: "w", description: "Teneur en eau (décimal)", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "C_w", description: "% solide massique (décimal)", unit: null },
    ],
    keywords: ["usine", "ingrédients", "tonnage chantier", "Mt", "Mb", "Meau"],
    contextSnippet:
      "Exemple 2 (Dia. 80) : connaissant la masse de remblai et les paramètres (w ou Cw, Bw), calculer les ingrédients.",
    derivationLinks: {
      derivedFrom: ["F013", "F016"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION O — Masses des ingrédients au labo — Méthode 2 (p. 45–46)
  // ============================================================

  {
    id: "F070",
    title: "Méthode 2 — Masse de résidus secs",
    subtitle: "Masses des ingrédients (méthode 2)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 46,
    equationLatex:
      "M_t = \\frac{C_{wf} M_T}{1 + B_w}",
    equationPlainText: "Mt = Cwf*MT/(1+Bw)",
    variables: [
      { symbol: "M_t", description: "Masse de résidus secs", unit: "kg" },
      { symbol: "C_{wf}", description: "Pourcentage solide massique final du remblai (décimal)", unit: null },
      { symbol: "M_T", description: "Masse totale de remblai à produire", unit: "kg" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
    ],
    keywords: ["méthode 2", "résidus secs", "Mt", "Cwf", "laboratoire"],
    contextSnippet:
      "Première équation opérationnelle de la méthode 2 (Dia. 46) pour obtenir la masse sèche de résidus.",
    derivationLinks: {
      derivedFrom: ["F037"],
      derivesInto: ["F071", "F072", "F074"],
      derivationNote: "Issue de Cwf = Mt/MT + Mb/MT et Mb = Bw·Mt",
    },
  },

  {
    id: "F071",
    title: "Méthode 2 — Masse de résidus humides",
    subtitle: "Masses des ingrédients (méthode 2)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 46,
    equationLatex:
      "M_{th} = \\frac{M_t}{C_{wt}}",
    equationPlainText: "Mth = Mt/Cwt",
    variables: [
      { symbol: "M_{th}", description: "Masse requise de résidus humides", unit: "kg" },
      { symbol: "M_t", description: "Masse de résidus secs", unit: "kg" },
      { symbol: "C_{wt}", description: "% solide des résidus humides entrants (décimal)", unit: null },
    ],
    keywords: ["résidus humides", "Mth", "Cwt", "méthode 2"],
    contextSnippet:
      "Conversion masse sèche → masse humide selon la teneur solide des résidus entrants (Dia. 46).",
    derivationLinks: {
      derivedFrom: ["F070"],
      derivesInto: ["F074"],
      derivationNote: null,
    },
  },

  {
    id: "F072",
    title: "Méthode 2 — Masse d'agent liant",
    subtitle: "Masses des ingrédients (méthode 2)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 46,
    equationLatex:
      "M_b = B_w \\cdot M_t = \\kappa \\rho_{hf} V_T \\left(\\frac{B_w C_{wf}}{1+B_w}\\right)",
    equationPlainText: "Mb = Bw*Mt = kappa*rho_hf*VT*(Bw*Cwf/(1+Bw))",
    variables: [
      { symbol: "M_b", description: "Masse de liant sec", unit: "kg" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "M_t", description: "Masse de résidus secs", unit: "kg" },
      { symbol: "\\kappa", description: "Coefficient de sécurité", unit: null },
      { symbol: "\\rho_{hf}", description: "Masse volumique humide du remblai frais", unit: "kg/m³" },
      { symbol: "V_T", description: "Volume total de remblai", unit: "m³" },
    ],
    keywords: ["Mb", "liant", "méthode 2", "Bw", "laboratoire"],
    contextSnippet:
      "Masse de liant de la méthode 2 (Dia. 46), avec forme directe et forme développée.",
    derivationLinks: {
      derivedFrom: ["F070"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F073",
    title: "Méthode 2 — Masse d'eau totale du mélange",
    subtitle: "Masses des ingrédients (méthode 2)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 46,
    equationLatex:
      "M_w = M_T(1-C_{wf}) = \\kappa \\rho_{hf} V_T (1-C_{wf})",
    equationPlainText: "Mw = MT*(1-Cwf) = kappa*rho_hf*VT*(1-Cwf)",
    variables: [
      { symbol: "M_w", description: "Masse d'eau totale dans le mélange", unit: "kg" },
      { symbol: "M_T", description: "Masse totale de remblai", unit: "kg" },
      { symbol: "C_{wf}", description: "% solide final visé (décimal)", unit: null },
      { symbol: "\\kappa", description: "Coefficient de sécurité", unit: null },
      { symbol: "\\rho_{hf}", description: "Masse volumique humide du remblai frais", unit: "kg/m³" },
      { symbol: "V_T", description: "Volume total de remblai", unit: "m³" },
    ],
    keywords: ["Mw", "eau totale", "méthode 2", "Cwf"],
    contextSnippet:
      "Calcul de la masse d'eau totale requise avant déduction de l'eau déjà contenue dans les résidus.",
    derivationLinks: {
      derivedFrom: ["F037"],
      derivesInto: ["F074"],
      derivationNote: null,
    },
  },

  {
    id: "F074",
    title: "Méthode 2 — Masse d'eau à ajouter",
    subtitle: "Masses des ingrédients (méthode 2)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 46,
    equationLatex:
      "M_{w\\text{-aj}} = \\kappa \\rho_{hf} V_T(1-C_{wf}) - M_t \\left(\\frac{1-C_{wt}}{C_{wt}}\\right)",
    equationPlainText: "Mw-aj = kappa*rho_hf*VT*(1-Cwf) - Mt*((1-Cwt)/Cwt)",
    variables: [
      { symbol: "M_{w\\text{-aj}}", description: "Masse d'eau à ajouter au malaxeur", unit: "kg" },
      { symbol: "\\kappa", description: "Coefficient de sécurité", unit: null },
      { symbol: "\\rho_{hf}", description: "Masse volumique humide du remblai frais", unit: "kg/m³" },
      { symbol: "V_T", description: "Volume total de remblai", unit: "m³" },
      { symbol: "C_{wf}", description: "% solide final du remblai (décimal)", unit: null },
      { symbol: "M_t", description: "Masse de résidus secs", unit: "kg" },
      { symbol: "C_{wt}", description: "% solide des résidus humides entrants (décimal)", unit: null },
    ],
    keywords: ["Mw-aj", "eau ajoutée", "méthode 2", "laboratoire"],
    contextSnippet:
      "Bilan d'eau de la méthode 2 : eau totale cible moins eau portée par les résidus humides (Dia. 46).",
    derivationLinks: {
      derivedFrom: ["F043", "F070", "F071", "F073"],
      derivesInto: [],
      derivationNote: "Expression équivalente à Mw-aj = Mw - Mth(1-Cwt)",
    },
  },

  // ============================================================
  // SECTION P — Formulaire BF (p. 48, Dia. 48)
  // ============================================================

  {
    id: "F075",
    title: "BF [1] — Masse totale de mélange par échantillon",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "M_{BF/Y} = \\kappa \\rho_{BF} V_{BF/Y}",
    equationPlainText: "M_BF/Y = kappa*rho_BF*V_BF/Y",
    variables: [
      { symbol: "M_{BF/Y}", description: "Masse de mélange BF par moule/éprouvette", unit: "kg" },
      { symbol: "\\kappa", description: "Facteur de sécurité", unit: null },
      { symbol: "\\rho_{BF}", description: "Masse volumique humide du BF", unit: "kg/m³" },
      { symbol: "V_{BF/Y}", description: "Volume BF visé par recette", unit: "m³" },
    ],
    keywords: ["BF", "M_BF", "moule", "échantillon", "Dia 48"],
    contextSnippet:
      "Équation [1] du formulaire BF : point de départ du calcul des masses par recette.",
    derivationLinks: {
      derivedFrom: ["F037"],
      derivesInto: ["F082"],
      derivationNote: null,
    },
  },

  {
    id: "F076",
    title: "BF [2] — Teneur en eau massique w%",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "(w\\%)_{BF} = \\left(\\frac{100}{C_{w\\%}} - 1\\right)_{BF}",
    equationPlainText: "(w%)_BF = (100/Cw% - 1)_BF",
    variables: [
      { symbol: "(w\\%)_{BF}", description: "Teneur en eau massique du BF", unit: "%" },
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique du BF", unit: "%" },
    ],
    keywords: ["BF", "w%", "Cw%", "Dia 48"],
    contextSnippet:
      "Équation [2] du formulaire BF, utilisée pour obtenir w% à partir de Cw%.",
    derivationLinks: {
      derivedFrom: ["F011"],
      derivesInto: ["F079", "F082"],
      derivationNote: null,
    },
  },

  {
    id: "F077",
    title: "BF [3] — Masse volumique des grains du liant",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "\\rho_{s\\text{-liant}} = \\frac{1}{\\sum_{i=1}^{N} \\dfrac{x_i}{\\rho_{s\\text{-cem}_i}}}",
    equationPlainText: "rho_s-liant = 1/sum(xi/rho_s-cem_i)",
    variables: [
      { symbol: "\\rho_{s\\text{-liant}}", description: "Masse volumique des grains du liant", unit: "kg/m³" },
      { symbol: "x_i", description: "Fraction massique du ciment i", unit: null },
      { symbol: "\\rho_{s\\text{-cem}_i}", description: "Masse volumique du ciment i", unit: "kg/m³" },
      { symbol: "N", description: "Nombre de composants cimentaires", unit: null },
    ],
    keywords: ["BF", "rho_s-liant", "mélange de liants", "harmonique"],
    contextSnippet:
      "Équation [3] du formulaire BF : moyenne harmonique pondérée des densités des constituants du liant.",
    derivationLinks: {
      derivedFrom: ["F026"],
      derivesInto: ["F078"],
      derivationNote: null,
    },
  },

  {
    id: "F078",
    title: "BF [4] — Masse volumique des grains du BF",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "\\rho_{s\\text{-BF}} = \\frac{100 + B_{w\\%}}{\\dfrac{1}{\\rho_{s\\text{-Tailings}}} + \\dfrac{B_{w\\%}}{100\\,\\rho_{s\\text{-liant}}}}",
    equationPlainText: "rho_s-BF = (100 + Bw%)/(1/rho_s-tailings + Bw%/(100*rho_s-liant))",
    variables: [
      { symbol: "\\rho_{s\\text{-BF}}", description: "Masse volumique des grains du BF", unit: "kg/m³" },
      { symbol: "B_{w\\%}", description: "Dosage massique de liant en %", unit: "%" },
      { symbol: "\\rho_{s\\text{-Tailings}}", description: "Masse volumique des grains des résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-liant}}", description: "Masse volumique des grains du liant", unit: "kg/m³" },
    ],
    keywords: ["BF", "rho_s-BF", "Bw%", "tailings", "liant"],
    contextSnippet:
      "Équation [4] du formulaire BF pour la densité solide globale du mélange résidus + liant.",
    derivationLinks: {
      derivedFrom: ["F077"],
      derivesInto: ["F080", "F081", "F082"],
      derivationNote: null,
    },
  },

  {
    id: "F079",
    title: "BF [5] — Indice des vides initial e0-BF",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "e_{0\\text{-BF}} = (w\\%)_{BF}\\left(\\frac{100\\,G_s}{S_{r\\%}}\\right)_{BF} = \\left(\\frac{100}{C_{w\\%}}-1\\right)_{BF}\\left(\\frac{100\\,G_s}{S_{r\\%}}\\right)_{BF}",
    equationPlainText: "e0-BF = (w%)_BF*(100*Gs/Sr%)_BF = (100/Cw% - 1)_BF*(100*Gs/Sr%)_BF",
    variables: [
      { symbol: "e_{0\\text{-BF}}", description: "Indice des vides initial du BF", unit: null },
      { symbol: "(w\\%)_{BF}", description: "Teneur en eau massique du BF", unit: "%" },
      { symbol: "G_s", description: "Densité relative des grains", unit: null },
      { symbol: "S_{r\\%}", description: "Degré de saturation en %", unit: "%" },
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique", unit: "%" },
    ],
    keywords: ["BF", "e0", "indice des vides", "Dia 48"],
    contextSnippet:
      "Équation [5] du formulaire BF reliant e0-BF à w%, Cw%, Gs et Sr%.",
    derivationLinks: {
      derivedFrom: ["F031", "F076"],
      derivesInto: ["F080", "F081"],
      derivationNote: null,
    },
  },

  {
    id: "F080",
    title: "BF [6] — Masse volumique sèche du BF",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "\\rho_{d\\text{-BF}} = \\frac{\\rho_{s\\text{-BF}}}{1+e_{0\\text{-BF}}}",
    equationPlainText: "rho_d-BF = rho_s-BF/(1 + e0-BF)",
    variables: [
      { symbol: "\\rho_{d\\text{-BF}}", description: "Masse volumique sèche du BF", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-BF}}", description: "Masse volumique des grains du BF", unit: "kg/m³" },
      { symbol: "e_{0\\text{-BF}}", description: "Indice des vides initial", unit: null },
    ],
    keywords: ["BF", "rho_d", "densité sèche", "e0"],
    contextSnippet:
      "Équation [6] du formulaire BF pour la densité sèche.",
    derivationLinks: {
      derivedFrom: ["F078", "F079"],
      derivesInto: ["F081", "F082"],
      derivationNote: null,
    },
  },

  {
    id: "F081",
    title: "BF [7] — Pourcentage solide volumique Cv",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "(C_v)_{BF} = \\frac{\\rho_{d\\text{-BF}}}{\\rho_{s\\text{-BF}}} = \\left(\\frac{1}{1+e_0}\\right)_{BF}",
    equationPlainText: "(Cv)_BF = rho_d-BF/rho_s-BF = (1/(1+e0))_BF",
    variables: [
      { symbol: "(C_v)_{BF}", description: "Pourcentage solide volumique du BF", unit: null },
      { symbol: "\\rho_{d\\text{-BF}}", description: "Masse volumique sèche du BF", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-BF}}", description: "Masse volumique des grains du BF", unit: "kg/m³" },
      { symbol: "e_0", description: "Indice des vides", unit: null },
    ],
    keywords: ["BF", "Cv", "solide volumique", "rho_d/rho_s"],
    contextSnippet:
      "Équation [7] du formulaire BF : fraction volumique solide.",
    derivationLinks: {
      derivedFrom: ["F078", "F079", "F080"],
      derivesInto: ["F082"],
      derivationNote: null,
    },
  },

  {
    id: "F082",
    title: "BF [8] — Masse volumique humide du BF",
    subtitle: "Formules BF (cas Sr = 1)",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 48,
    equationLatex:
      "\\rho_{BF} = \\rho_{s\\text{-BF}}\\left(\\frac{100\\times C_v}{C_{w\\%}}\\right)_{BF} = \\rho_{d\\text{-BF}}\\left(1+\\frac{w\\%}{100}\\right)_{BF}",
    equationPlainText: "rho_BF = rho_s-BF*(100*Cv/Cw%)_BF = rho_d-BF*(1 + w%/100)_BF",
    variables: [
      { symbol: "\\rho_{BF}", description: "Masse volumique humide du BF", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-BF}}", description: "Masse volumique des grains du BF", unit: "kg/m³" },
      { symbol: "C_v", description: "Fraction volumique des solides", unit: null },
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique", unit: "%" },
      { symbol: "\\rho_{d\\text{-BF}}", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "w\\%", description: "Teneur en eau massique en %", unit: "%" },
    ],
    keywords: ["BF", "rho_BF", "densité humide", "Dia 48"],
    contextSnippet:
      "Équation [8] du formulaire BF; utilisée pour fermer la boucle des paramètres géotechniques.",
    derivationLinks: {
      derivedFrom: ["F075", "F076", "F078", "F080", "F081"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION Q — Remblais mixtes (PAF) — compléments (p. 60–62)
  // ============================================================

  {
    id: "F083",
    title: "PAF — Fraction volumique d'agrégats Av",
    subtitle: "Paramètres PAF",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 60,
    equationLatex:
      "A_v = \\frac{V_{aggregates}}{V_{tailings} + V_{aggregates}} = \\frac{A_m}{A_m + (1-A_m)\\dfrac{\\rho_{s\\text{-ag}}}{\\rho_{s\\text{-t}}}}",
    equationPlainText: "Av = Vaggregates/(Vtailings+Vaggregates) = Am/(Am + (1-Am)*(rho_s-ag/rho_s-t))",
    variables: [
      { symbol: "A_v", description: "Fraction volumique des agrégats", unit: null },
      { symbol: "V_{aggregates}", description: "Volume des agrégats", unit: "m³" },
      { symbol: "V_{tailings}", description: "Volume des résidus (tailings)", unit: "m³" },
      { symbol: "A_m", description: "Fraction massique des agrégats", unit: null },
      { symbol: "\\rho_{s\\text{-ag}}", description: "Masse volumique des grains d'agrégats", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-t}}", description: "Masse volumique des grains de résidus", unit: "kg/m³" },
    ],
    keywords: ["PAF", "Av", "agrégats", "fraction volumique", "Dia 60"],
    contextSnippet:
      "Dia. 60: relation fondamentale entre contenu massique Am et contenu volumique Av des agrégats.",
    derivationLinks: {
      derivedFrom: ["F054"],
      derivesInto: ["F084", "F085", "F086"],
      derivationNote: null,
    },
  },

  {
    id: "F084",
    title: "PAF — Densité des grains tailings + agrégats",
    subtitle: "Paramètres PAF",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 60,
    equationLatex:
      "\\rho_{s\\text{-tails+aggr}} = \\left(\\frac{A_m}{\\rho_{s\\text{-ag}}} + \\frac{1-A_m}{\\rho_{s\\text{-t}}}\\right)^{-1}",
    equationPlainText: "rho_s-tails+aggr = (Am/rho_s-ag + (1-Am)/rho_s-t)^(-1)",
    variables: [
      { symbol: "\\rho_{s\\text{-tails+aggr}}", description: "Masse volumique équivalente des grains (résidus + agrégats)", unit: "kg/m³" },
      { symbol: "A_m", description: "Fraction massique d'agrégats", unit: null },
      { symbol: "\\rho_{s\\text{-ag}}", description: "Masse volumique des grains d'agrégats", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-t}}", description: "Masse volumique des grains de résidus", unit: "kg/m³" },
    ],
    keywords: ["PAF", "rho_s", "tails+aggr", "Dia 60"],
    contextSnippet:
      "Terme intermédiaire de Dia. 60 utilisé dans l'expression complète de Bv pour les remblais mixtes.",
    derivationLinks: {
      derivedFrom: ["F022", "F053", "F054", "F083"],
      derivesInto: ["F085", "F089"],
      derivationNote: null,
    },
  },

  {
    id: "F085",
    title: "PAF — Taux volumique de liant Bv (forme complète)",
    subtitle: "Paramètres PAF",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 60,
    equationLatex:
      "B_v = B_w\\left(\\frac{\\rho_{s\\text{-tails+aggr}}}{\\rho_{s\\text{-binder}}}\\right) = B_w\\,\\frac{\\left(\\dfrac{A_m}{\\rho_{s\\text{-ag}}} + \\dfrac{1-A_m}{\\rho_{s\\text{-t}}}\\right)^{-1}}{\\left(\\dfrac{x_i}{\\rho_{s\\text{-binder-}i}} + \\dfrac{x_j}{\\rho_{s\\text{-binder-}j}}\\right)^{-1}}",
    equationPlainText: "Bv = Bw*(rho_s-tails+aggr/rho_s-binder) with full Am/xi form (Dia 60)",
    variables: [
      { symbol: "B_v", description: "Taux volumique de liant", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "\\rho_{s\\text{-tails+aggr}}", description: "Densité grains résidus+agrégats", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-binder}}", description: "Densité grains du mélange de liants", unit: "kg/m³" },
      { symbol: "A_m", description: "Fraction massique d'agrégats", unit: null },
      { symbol: "x_i", description: "Fraction massique du liant i", unit: null },
      { symbol: "x_j", description: "Fraction massique du liant j", unit: null },
    ],
    keywords: ["PAF", "Bv", "Bw", "liant", "agrégats", "Dia 60"],
    contextSnippet:
      "Dia. 60: expression complète de Bv en remblais mixtes avec liant multi-composant.",
    derivationLinks: {
      derivedFrom: ["F022", "F083", "F084"],
      derivesInto: ["F089"],
      derivationNote: null,
    },
  },

  {
    id: "F086",
    title: "PAF — Relations Av ↔ av",
    subtitle: "Paramètres PAF",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 60,
    equationLatex:
      "a_v = \\frac{A_v}{1-A_v} \\qquad A_v = \\frac{a_v}{1+a_v}",
    equationPlainText: "av = Av/(1-Av) ; Av = av/(1+av)",
    variables: [
      { symbol: "A_v", description: "Fraction volumique d'agrégats", unit: null },
      { symbol: "a_v", description: "Ratio volumique agrégats/résidus", unit: null },
    ],
    keywords: ["PAF", "Av", "av", "ratio volumique", "agrégats"],
    contextSnippet:
      "Relation ratio/fraction volumique, analogue à Am ↔ am (Dia. 60).",
    derivationLinks: {
      derivedFrom: ["F054", "F083"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION R — Paramètres PAF (p. 62, Dia. 62)
  // ============================================================

  {
    id: "F087",
    title: "PAF — Pourcentage solide volumique Cv-PAF",
    subtitle: "Paramètres PAF (Dia. 62)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 62,
    equationLatex:
      "C_{v\\text{-PAF}} = \\frac{1}{1+e_{PAF}} = \\frac{\\rho_{d\\text{-PAF}}}{\\rho_{s\\text{-PAF}}} = C_{w\\text{-PAF}}\\left(\\frac{\\rho_{bulk\\text{-PAF}}}{\\rho_{s\\text{-PAF}}}\\right)",
    equationPlainText: "Cv-PAF = 1/(1+ePAF) = rho_d-PAF/rho_s-PAF = Cw-PAF*(rho_bulk-PAF/rho_s-PAF)",
    variables: [
      { symbol: "C_{v\\text{-PAF}}", description: "Pourcentage solide volumique du PAF", unit: null },
      { symbol: "e_{PAF}", description: "Indice des vides du PAF", unit: null },
      { symbol: "\\rho_{d\\text{-PAF}}", description: "Masse volumique sèche du PAF", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-PAF}}", description: "Masse volumique des grains du PAF", unit: "kg/m³" },
      { symbol: "C_{w\\text{-PAF}}", description: "Pourcentage solide massique du PAF", unit: null },
      { symbol: "\\rho_{bulk\\text{-PAF}}", description: "Masse volumique humide (bulk) du PAF", unit: "kg/m³" },
    ],
    keywords: ["PAF", "Cv-PAF", "ePAF", "rho_d", "rho_bulk", "Dia 62"],
    contextSnippet:
      "Dia. 62: différentes formes équivalentes du pourcentage solide volumique du PAF.",
    derivationLinks: {
      derivedFrom: ["F025", "F053"],
      derivesInto: ["F088"],
      derivationNote: null,
    },
  },

  {
    id: "F088",
    title: "PAF — Masse volumique sèche ρd-PAF",
    subtitle: "Paramètres PAF (Dia. 62)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 62,
    equationLatex:
      "\\rho_{d\\text{-PAF}} = C_{w\\text{-PAF}} \\cdot \\rho_{bulk\\text{-PAF}}",
    equationPlainText: "rho_d-PAF = Cw-PAF * rho_bulk-PAF",
    variables: [
      { symbol: "\\rho_{d\\text{-PAF}}", description: "Masse volumique sèche du PAF", unit: "kg/m³" },
      { symbol: "C_{w\\text{-PAF}}", description: "Pourcentage solide massique du PAF", unit: null },
      { symbol: "\\rho_{bulk\\text{-PAF}}", description: "Masse volumique humide (bulk) du PAF", unit: "kg/m³" },
    ],
    keywords: ["PAF", "rho_d-PAF", "densité sèche", "Dia 62"],
    contextSnippet:
      "Dia. 62: équation directe de densité sèche du PAF à partir de Cw-PAF et ρbulk-PAF.",
    derivationLinks: {
      derivedFrom: ["F053", "F087"],
      derivesInto: ["F089"],
      derivationNote: null,
    },
  },

  {
    id: "F089",
    title: "PAF — Degré de saturation Sr-PAF",
    subtitle: "Paramètres PAF (Dia. 62)",
    section: "Calculs des mélanges de remblais mixtes",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 62,
    equationLatex:
      "S_{r\\text{-PAF}} = \\frac{1-C_{w\\text{-PAF}}}{\\rho_w\\left[\\dfrac{1}{\\rho_{bulk\\text{-PAF}}} - \\left(\\dfrac{C_{w\\text{-PAF}}}{1+B_w}\\right)\\left(\\dfrac{1-A_m}{\\rho_{s\\text{-t}}} + \\dfrac{A_m}{\\rho_{s\\text{-ag}}} + \\dfrac{B_w}{\\rho_{s\\text{-b}}}\\right)\\right]}",
    equationPlainText: "Sr-PAF = (1-Cw-PAF)/[rho_w*(1/rho_bulk-PAF - (Cw-PAF/(1+Bw))*((1-Am)/rho_s-t + Am/rho_s-ag + Bw/rho_s-b))]",
    variables: [
      { symbol: "S_{r\\text{-PAF}}", description: "Degré de saturation du PAF frais", unit: null },
      { symbol: "C_{w\\text{-PAF}}", description: "Pourcentage solide massique du PAF", unit: null },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
      { symbol: "\\rho_{bulk\\text{-PAF}}", description: "Masse volumique humide du PAF", unit: "kg/m³" },
      { symbol: "A_m", description: "Fraction massique d'agrégats", unit: null },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "\\rho_{s\\text{-t}}", description: "Masse volumique des grains de résidus", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-ag}}", description: "Masse volumique des grains d'agrégats", unit: "kg/m³" },
      { symbol: "\\rho_{s\\text{-b}}", description: "Masse volumique des grains du liant", unit: "kg/m³" },
    ],
    keywords: ["PAF", "Sr-PAF", "saturation", "Dia 62"],
    contextSnippet:
      "Dia. 62: formule complète du degré de saturation du PAF fraîchement mélangé.",
    derivationLinks: {
      derivedFrom: ["F025", "F053", "F084", "F085", "F088"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION S — CRF détails intermédiaires (p. 68–70)
  // ============================================================

  {
    id: "F090",
    title: "CRF — Masse de retardateur de prise M_SR",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 68,
    equationLatex:
      "M_{SR} = D_1 \\cdot M_c",
    equationPlainText: "M_SR = D1 * Mc",
    variables: [
      { symbol: "M_{SR}", description: "Masse de retardateur de prise", unit: "kg" },
      { symbol: "D_1", description: "Dosage de retardateur exprimé par unité de masse de ciment", unit: "kg/kg" },
      { symbol: "M_c", description: "Masse de ciment", unit: "kg" },
    ],
    keywords: ["CRF", "retardateur", "M_SR", "setting retarder", "Dia 68"],
    contextSnippet:
      "Dias. 68–70: calcul direct de la masse de retardateur de prise à partir du dosage D1 et de la masse de ciment.",
    derivationLinks: {
      derivedFrom: ["F055", "F056"],
      derivesInto: ["F055"],
      derivationNote: null,
    },
  },

  {
    id: "F091",
    title: "CRF — Volume de retardateur de prise V_SR",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 69,
    equationLatex:
      "V_{SR} = D_2 \\cdot M_c",
    equationPlainText: "V_SR = D2 * Mc",
    variables: [
      { symbol: "V_{SR}", description: "Volume de retardateur de prise", unit: "m³" },
      { symbol: "D_2", description: "Dosage volumique de retardateur par masse de ciment", unit: "m³/kg" },
      { symbol: "M_c", description: "Masse de ciment", unit: "kg" },
    ],
    keywords: ["CRF", "retardateur", "V_SR", "volume", "Dia 69"],
    contextSnippet:
      "Dias. 68–70: calcul du volume de retardateur de prise en fonction de D2 et de la masse de ciment.",
    derivationLinks: {
      derivedFrom: ["F055", "F056"],
      derivesInto: ["F055"],
      derivationNote: null,
    },
  },

  {
    id: "F092",
    title: "CRF — Volume de coulis cimentaire V_c-slurry",
    subtitle: "Remblais rocheux cimentés (CRF)",
    section: "Calculs des mélanges des remblais rocheux",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 70,
    equationLatex:
      "V_{c\\text{-slurry}} = M_{CRF}\\left(\\frac{B_w}{1 + B_w\\left(1 + \\dfrac{W}{C}\\right)}\\right)\\left(\\frac{1}{\\rho_c} + \\frac{\\dfrac{W}{C}}{\\rho_w} + D_2\\right)",
    equationPlainText:
      "V_c-slurry = M_CRF * [Bw/(1+Bw*(1+W/C))] * [1/rho_c + (W/C)/rho_w + D2]",
    variables: [
      { symbol: "V_{c\\text{-slurry}}", description: "Volume du coulis cimentaire", unit: "m³" },
      { symbol: "M_{CRF}", description: "Masse totale de CRF", unit: "kg" },
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "W/C", description: "Rapport eau/ciment", unit: null },
      { symbol: "\\rho_c", description: "Masse volumique des grains de ciment", unit: "kg/m³" },
      { symbol: "\\rho_w", description: "Masse volumique de l'eau", unit: "kg/m³" },
      { symbol: "D_2", description: "Dosage volumique de retardateur par masse de ciment", unit: "m³/kg" },
    ],
    keywords: ["CRF", "coulis", "slurry", "V_c-slurry", "Dia 70"],
    contextSnippet:
      "Dia. 70: volume de coulis cimentaire obtenu à partir de la masse totale de CRF, du dosage Bw, du rapport W/C et du retardateur.",
    derivationLinks: {
      derivedFrom: ["F055", "F056", "F057", "F060"],
      derivesInto: ["F055"],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION T — Formules utilitaires courtes (p. 32–34)
  // ============================================================

  {
    id: "F093",
    title: "Utilitaire — Masse volumique sèche à partir de ρh et Cw",
    subtitle: "Relations directes de calcul",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 33,
    equationLatex:
      "\\rho_d = \\rho_h \\cdot C_w",
    equationPlainText: "rho_d = rho_h * Cw",
    variables: [
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "\\rho_h", description: "Masse volumique humide", unit: "kg/m³" },
      { symbol: "C_w", description: "Pourcentage solide massique (décimal)", unit: null },
    ],
    keywords: ["rho_d", "rho_h", "Cw", "densité sèche", "Dia 33"],
    contextSnippet:
      "Dia. 33: relation de calcul rapide de la masse volumique sèche à partir de la masse volumique humide et de Cw.",
    derivationLinks: {
      derivedFrom: ["F007"],
      derivesInto: ["F007", "F094", "F095", "F096"],
      derivationNote: null,
    },
  },

  {
    id: "F094",
    title: "Utilitaire — Poids volumique sec γd",
    subtitle: "Relations directes de calcul",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 33,
    equationLatex:
      "\\gamma_d = \\rho_d \\cdot g = 9.81\\,\\rho_d",
    equationPlainText: "gamma_d = rho_d * g = 9.81 * rho_d",
    variables: [
      { symbol: "\\gamma_d", description: "Poids volumique sec", unit: "kN/m³" },
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "g", description: "Accélération gravitationnelle", unit: "m/s²" },
    ],
    keywords: ["gamma_d", "poids volumique sec", "Dia 33", "kN/m3"],
    contextSnippet:
      "Dia. 33: conversion de la masse volumique sèche en poids volumique sec.",
    derivationLinks: {
      derivedFrom: ["F027", "F093"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F095",
    title: "Utilitaire — Cv à partir de ρd et ρs",
    subtitle: "Relations directes de calcul",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 32,
    equationLatex:
      "C_v = 1 - \\frac{\\rho_d}{\\rho_s}",
    equationPlainText: "Cv = 1 - rho_d/rho_s",
    variables: [
      { symbol: "C_v", description: "Pourcentage solide volumique (décimal)", unit: null },
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "\\rho_s", description: "Masse volumique des grains", unit: "kg/m³" },
    ],
    keywords: ["Cv", "rho_d", "rho_s", "solide volumique", "Dia 32"],
    contextSnippet:
      "Dia. 32: expression compacte de Cv en fonction des masses volumiques sèche et solide.",
    derivationLinks: {
      derivedFrom: ["F007", "F010", "F093"],
      derivesInto: ["F007"],
      derivationNote: null,
    },
  },

  {
    id: "F096",
    title: "Utilitaire — Sr à partir de w, ρd et ρs",
    subtitle: "Relations directes de calcul",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 34,
    equationLatex:
      "S_r = \\frac{w\\,\\rho_d}{\\rho_s - \\rho_d}",
    equationPlainText: "Sr = (w*rho_d)/(rho_s-rho_d)",
    variables: [
      { symbol: "S_r", description: "Degré de saturation (décimal)", unit: null },
      { symbol: "w", description: "Teneur en eau massique (décimal)", unit: null },
      { symbol: "\\rho_d", description: "Masse volumique sèche", unit: "kg/m³" },
      { symbol: "\\rho_s", description: "Masse volumique des grains", unit: "kg/m³" },
    ],
    keywords: ["Sr", "saturation", "rho_d", "rho_s", "Dia 34"],
    contextSnippet:
      "Dia. 34: forme utilitaire de Sr en fonction de w, ρd et ρs (forme pratique quand ρw = 1 en g/cm³).",
    derivationLinks: {
      derivedFrom: ["F032", "F093"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  // ============================================================
  // SECTION U — Usure de conduite (p. 81)
  // ============================================================

  {
    id: "F097",
    title: "Modèle d'usure de conduite (Archibald, 2003)",
    subtitle: "Transport en conduite",
    section: "Calculs des mélanges à l'usine de remblai",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 81,
    equationLatex:
      "\\text{Wear} = c\\,V^p",
    equationPlainText: "Wear = c * V^p",
    variables: [
      { symbol: "\\text{Wear}", description: "Taux d'usure de la conduite", unit: null },
      { symbol: "c", description: "Coefficient empirique du matériau/système", unit: null },
      { symbol: "V", description: "Vitesse d'écoulement en conduite", unit: "m/s" },
      { symbol: "p", description: "Exposant empirique", unit: null },
    ],
    keywords: ["wear", "usure", "pipeline", "Archibald 2003", "vitesse conduite"],
    contextSnippet:
      "Dia. 81: modèle empirique d'usure en conduite utilisé pour relier l'usure à la vitesse d'écoulement.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: [],
      derivationNote: "Relation empirique (non dérivée algébriquement dans le chapitre).",
    },
  },

  // ============================================================
  // SECTION V — Formes complémentaires souvent utilisées
  // ============================================================

  {
    id: "F098",
    title: "Cw% en fonction du rapport W/C et de Bw%",
    subtitle: "Forme pour dosage selon w/c",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 31,
    equationLatex:
      "C_{w\\%} = \\frac{100}{1 + \\left(\\dfrac{W}{C}\\right)\\left(\\dfrac{100}{B_{w\\%}} + 1\\right)}",
    equationPlainText:
      "Cw% = 100 / [1 + (W/C)*(100/Bw% + 1)]",
    variables: [
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique du remblai", unit: "%" },
      { symbol: "W/C", description: "Rapport eau/ciment (massique)", unit: null },
      { symbol: "B_{w\\%}", description: "Pourcentage massique de liant (en %)", unit: "%" },
    ],
    keywords: ["Cw%", "W/C", "Bw%", "dosage selon rapport", "forme en pourcentage"],
    contextSnippet:
      "Forme pratique de calcul de Cw% à partir de W/C et Bw% (utilisée dans les feuilles de dosage selon le rapport eau/ciment).",
    derivationLinks: {
      derivedFrom: ["F030"],
      derivesInto: [],
      derivationNote: "Version en pourcentage de la relation W/C ↔ Cw.",
    },
  },

  {
    id: "F099",
    title: "W/C en fonction de Cw% et Bw%",
    subtitle: "Forme pour dosage selon w/c",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 31,
    equationLatex:
      "\\frac{W}{C} = \\left(\\frac{100-C_{w\\%}}{C_{w\\%}}\\right)\\left(\\frac{100}{B_{w\\%}}+1\\right)",
    equationPlainText:
      "W/C = ((100-Cw%)/Cw%) * (100/Bw% + 1)",
    variables: [
      { symbol: "W/C", description: "Rapport eau/ciment (massique)", unit: null },
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique", unit: "%" },
      { symbol: "B_{w\\%}", description: "Pourcentage massique de liant", unit: "%" },
    ],
    keywords: ["W/C", "Cw%", "Bw%", "forme en pourcentage", "dosage"],
    contextSnippet:
      "Expression inverse très utilisée dans les feuilles Excel pour passer directement de Cw% et Bw% au rapport W/C.",
    derivationLinks: {
      derivedFrom: ["F030", "F098"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F100",
    title: "Masse volumique humide via porosité et teneur en eau",
    subtitle: "Forme équivalente de ρh",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 32,
    equationLatex:
      "\\rho_h = \\rho_s\\,(1-n)\\,(1+w)",
    equationPlainText:
      "rho_h = rho_s*(1-n)*(1+w)",
    variables: [
      { symbol: "\\rho_h", description: "Masse volumique humide", unit: "kg/m³" },
      { symbol: "\\rho_s", description: "Masse volumique des grains solides", unit: "kg/m³" },
      { symbol: "n", description: "Porosité", unit: null },
      { symbol: "w", description: "Teneur en eau massique (décimal)", unit: null },
    ],
    keywords: ["rho_h", "porosité", "n", "w", "forme équivalente"],
    contextSnippet:
      "Forme compacte de la masse volumique humide quand n et w sont connus.",
    derivationLinks: {
      derivedFrom: ["F005", "F011", "F023"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F101",
    title: "Volume des solides du mélange",
    subtitle: "Volumes de phases",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 32,
    equationLatex:
      "V_s = C_v\\,V_T",
    equationPlainText:
      "Vs = Cv * VT",
    variables: [
      { symbol: "V_s", description: "Volume des solides", unit: "m³" },
      { symbol: "C_v", description: "Fraction volumique solide (décimal)", unit: null },
      { symbol: "V_T", description: "Volume total du mélange", unit: "m³" },
    ],
    keywords: ["Vs", "Cv", "volume solide", "phase solide"],
    contextSnippet:
      "Calcul direct du volume des solides à partir de Cv et du volume total.",
    derivationLinks: {
      derivedFrom: ["F010"],
      derivesInto: ["F102"],
      derivationNote: null,
    },
  },

  {
    id: "F102",
    title: "Volume des vides du mélange",
    subtitle: "Volumes de phases",
    section: "Description des remblais miniers",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 32,
    equationLatex:
      "V_v = V_T - V_s = V_T\\,(1-C_v)",
    equationPlainText:
      "Vv = VT - Vs = VT*(1-Cv)",
    variables: [
      { symbol: "V_v", description: "Volume des vides", unit: "m³" },
      { symbol: "V_T", description: "Volume total du mélange", unit: "m³" },
      { symbol: "V_s", description: "Volume des solides", unit: "m³" },
      { symbol: "C_v", description: "Fraction volumique solide", unit: null },
    ],
    keywords: ["Vv", "vides", "volume des vides", "Cv"],
    contextSnippet:
      "Expression directe du volume de vides dans le mélange.",
    derivationLinks: {
      derivedFrom: ["F010", "F101"],
      derivesInto: [],
      derivationNote: null,
    },
  },

  {
    id: "F103",
    title: "Prédiction Cw% selon le slump (modèle prédictif)",
    subtitle: "Composante eau de mélange",
    section: "Calculs des mélanges au laboratoire",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 40,
    equationLatex:
      "C_{w\\%} \\approx \\frac{4.95\\times 10^6\\,(1+B_{w\\%})}{\\left(\\dfrac{S_{(mm)}\\,(1+B_{w\\%})}{G_{s\\text{-résidus}}}+235.5122\\right)^2}",
    equationPlainText:
      "Cw% ~= [4.95e6*(1+Bw%)] / ([S_mm*(1+Bw%)/Gs_residus + 235.5122]^2)",
    variables: [
      { symbol: "C_{w\\%}", description: "Pourcentage solide massique visé", unit: "%" },
      { symbol: "S_{(mm)}", description: "Slump mesuré (en mm)", unit: "mm" },
      { symbol: "B_{w\\%}", description: "Pourcentage massique de liant", unit: "%" },
      { symbol: "G_{s\\text{-résidus}}", description: "Densité relative des grains de résidus", unit: null },
    ],
    keywords: ["slump", "Cw%", "modèle prédictif", "grand cône", "petit cône"],
    contextSnippet:
      "Modèle empirique pour estimer Cw% à partir du slump et des propriétés du mélange.",
    derivationLinks: {
      derivedFrom: [],
      derivesInto: [],
      derivationNote: "Pour un slump au petit cône, convertir d'abord vers grand cône via S_grand ≈ 2.335*S_petit.",
    },
  },

  {
    id: "F104",
    title: "Expression de Bw en fonction de Cb, Cw et c_c",
    subtitle: "Quantite de liant (Dia. 14)",
    section: "Description des remblais miniers — Quantité de liant",
    chapter: "Chapitre 4 — Calculs des mélanges",
    pageNumber: 14,
    equationLatex:
      "B_w = \\frac{C_b}{C_w-C_b} = \\frac{c_c C_w}{C_w-c_c C_w} = \\left(\\frac{1}{c_c}-1\\right)^{-1}",
    equationPlainText:
      "Bw = Cb/(Cw-Cb) = (cc*Cw)/(Cw-cc*Cw) = (1/cc - 1)^(-1)",
    variables: [
      { symbol: "B_w", description: "Taux massique de liant", unit: null },
      { symbol: "C_b", description: "Pourcentage massique de liant (vs masse totale remblai)", unit: "%" },
      { symbol: "C_w", description: "Pourcentage solide massique du remblai", unit: null },
      { symbol: "c_c", description: "Teneur massique de liant vs solides (alias Bws)", unit: null },
    ],
    keywords: ["Bw", "Cb", "Cw", "cc", "c_c", "Bws", "Dia 14", "quantite de liant"],
    contextSnippet:
      "Diapo 14: forme algebrique complete reliant Bw, Cb, Cw et l'alias c_c (=Bws).",
    derivationLinks: {
      derivedFrom: ["F018", "F019"],
      derivesInto: [],
      derivationNote: null,
    },
  },

];

// ============================================================
// Index lookup helpers
// ============================================================

export const FORMULA_MAP = new Map<string, Formula>(
  FORMULAS.map((f) => [f.id, f])
);

export const SECTIONS = Array.from(new Set(FORMULAS.map((f) => f.section)));
export const KEYWORDS_ALL = Array.from(new Set(FORMULAS.flatMap((f) => f.keywords)));
export const VARIABLES_ALL = Array.from(
  new Set(FORMULAS.flatMap((f) => f.variables.map((v) => v.symbol)))
);
