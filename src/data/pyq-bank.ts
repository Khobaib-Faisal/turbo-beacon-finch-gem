export type SubjectId = "physics" | "chemistry" | "maths";

export interface QuestionItem {
  id: string;
  source: string; // e.g. "JEE Main 2024", "JEE Adv 2023"
  type: "mcq" | "integer";
  question: string;
  options?: string[]; // exactly 4 for MCQ
  correctAnswer: number; // 0, 1, 2, 3 for MCQ; actual integer/number for numerical
  explanation: string;
}

export interface ChapterPYQ {
  chapter: string;
  subject: SubjectId;
  questions: QuestionItem[];
}

export const PYQ_DATABASE: ChapterPYQ[] = [
  // ==========================================
  //                PHYSICS
  // ==========================================
  {
    chapter: "Units, Dimensions & Measurements",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Kinematics (1D & 2D)",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Laws of Motion & Friction",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Work, Energy & Power",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Center of Mass & Collisions",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Rotational Motion",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Gravitation",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Mechanical Properties of Solids",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Fluid Mechanics",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Thermal Properties & Calorimetry",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Thermodynamics & KTG",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Simple Harmonic Motion (SHM)",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Waves & Sound",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Electrostatics & Gauss's Law",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Capacitance",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Current Electricity",
    subject: "physics",
    questions: [
      {
        id: "phy-ce-001",
        source: "JEE Main 2024",
        type: "mcq",
        question: "A wire of resistance 16 Ω is elongated to double its original length by stretching it uniformly. The resistance of the elongated wire is:",
        options: ["32 Ω", "64 Ω", "4 Ω", "16 Ω"],
        correctAnswer: 1,
        explanation: "Volume remains constant (V = A * L). Doubling length halves area. R' = ρ(2L)/(A/2) = 4R = 64 Ω."
      },
      {
        id: "phy-ce-002",
        source: "JEE Main 2023",
        type: "integer",
        question: "In a meter bridge experiment, null point is found at 40 cm from end A when a known resistance of 6 Ω is connected in the right gap. The value of unknown resistance in the left gap is ____ Ω.",
        correctAnswer: 4,
        explanation: "R / 6 = 40 / 60 = 2 / 3 => R = 4 Ω."
      }
    ]
  },
  {
    chapter: "Magnetic Effects of Current",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Magnetism & Matter",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Electromagnetic Induction (EMI)",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Alternating Current (AC)",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Electromagnetic Waves",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Ray Optics & Optical Instruments",
    subject: "physics",
    questions: [
      {
        id: "phy-ro-001",
        source: "JEE Main 2024",
        type: "mcq",
        question: "A convex lens of focal length 20 cm (μ = 1.5) is immersed in water (μ = 4/3). The new focal length in water is:",
        options: ["40 cm", "60 cm", "80 cm", "100 cm"],
        correctAnswer: 2,
        explanation: "1/f_air = (1.5 - 1) * K = 1/20 => K = 1/10. 1/f_water = ((1.5/(4/3)) - 1) * K = 1/80 => f = 80 cm."
      }
    ]
  },
  {
    chapter: "Wave Optics",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Dual Nature of Matter & Radiation",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Atoms & Nuclei",
    subject: "physics",
    questions: []
  },
  {
    chapter: "Semiconductors",
    subject: "physics",
    questions: []
  },

  // ==========================================
  //               CHEMISTRY
  // ==========================================
  {
    chapter: "Some Basic Concepts of Chemistry (Mole Concept)",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Structure of Atom",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Classification of Elements & Periodicity",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Chemical Bonding & Molecular Structure",
    subject: "chemistry",
    questions: [
      {
        id: "chem-cb-001",
        source: "JEE Main 2023",
        type: "mcq",
        question: "The shape of XeF4 molecule according to VSEPR theory is:",
        options: ["Square planar", "Tetrahedral", "Square pyramidal", "Octahedral"],
        correctAnswer: 0,
        explanation: "Xe has 8 valence electrons, 4 bonding pairs + 2 lone pairs => sp3d2 with square planar geometry."
      }
    ]
  },
  {
    chapter: "Chemical Thermodynamics",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Chemical & Ionic Equilibrium",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Redox Reactions",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Solutions",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Electrochemistry",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Chemical Kinetics",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "p-Block Elements",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "d and f Block Elements",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Coordination Compounds",
    subject: "chemistry",
    questions: [
      {
        id: "chem-cc-001",
        source: "JEE Main 2024",
        type: "integer",
        question: "The spin-only magnetic moment of [Fe(CN)6]4- complex ion is ____ BM (nearest integer).",
        correctAnswer: 0,
        explanation: "Fe2+ is 3d6. CN- is a strong field ligand causing pairing. Unpaired electrons n = 0 => μ = 0 BM."
      }
    ]
  },
  {
    chapter: "General Organic Chemistry (GOC)",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Hydrocarbons",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Haloalkanes and Haloarenes",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Alcohols, Phenols and Ethers",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Aldehydes, Ketones and Carboxylic Acids",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Amines & Diazonium Salts",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Biomolecules",
    subject: "chemistry",
    questions: []
  },
  {
    chapter: "Practical Chemistry",
    subject: "chemistry",
    questions: []
  },

  // ==========================================
  //               MATHEMATICS
  // ==========================================
  {
    chapter: "Sets, Relations & Functions",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Complex Numbers & Quadratic Equations",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Matrices & Determinants",
    subject: "maths",
    questions: [
      {
        id: "math-md-001",
        source: "JEE Main 2023",
        type: "integer",
        question: "If A is a 3x3 matrix with |A| = 4, then |adj(2A)| is equal to ____.",
        correctAnswer: 1024,
        explanation: "adj(2A) determinant = |2A|^(n-1) = (2³ * |A|)² = (8 * 4)² = 32² = 1024."
      }
    ]
  },
  {
    chapter: "Permutations & Combinations",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Binomial Theorem",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Sequences & Series",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Straight Lines",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Circles",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Conic Sections (Parabola, Ellipse, Hyperbola)",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Limits, Continuity & Differentiability",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Application of Derivatives (AOD)",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Indefinite Integrals",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Definite Integrals",
    subject: "maths",
    questions: [
      {
        id: "math-di-001",
        source: "JEE Main 2024",
        type: "mcq",
        question: "The value of ∫[0 to π] (x sin(x)) / (1 + cos²(x)) dx is:",
        options: ["π² / 4", "π² / 2", "π / 4", "π² / 8"],
        correctAnswer: 0,
        explanation: "Using King's property I = (π/2) ∫[0 to π] sin(x)/(1 + cos²(x)) dx = (π/2) [ -tan⁻¹(cos x) ]_0^π = π²/4."
      }
    ]
  },
  {
    chapter: "Differential Equations",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Vector Algebra",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Three Dimensional Geometry (3D)",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Probability",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Statistics",
    subject: "maths",
    questions: []
  },
  {
    chapter: "Trigonometric Functions & Equations",
    subject: "maths",
    questions: []
  }
];
