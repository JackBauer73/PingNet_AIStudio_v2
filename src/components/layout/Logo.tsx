import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className = "w-10 h-10", size }: LogoProps) {
  return (
    <svg
      viewBox="0 0 400 600"
      className={className}
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Dégradé des flammes internes orange, rouge, jaune */}
        <linearGradient id="flameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="40%" stopColor="#f97316" />
          <stop offset="80%" stopColor="#facc15" />
          <stop offset="100%" stopColor="#fef08a" />
        </linearGradient>

        {/* Dégradé des anses/ailes pour donner du relief */}
        <linearGradient id="wingGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="50%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>

        {/* Dégradé du bol de la coupe en bleu vert teal/gris sombre */}
        <linearGradient id="bowlGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#2d7a88" />
        </linearGradient>

        {/* Dégradé de la base foncée métallique */}
        <linearGradient id="baseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0a0f1d" />
          <stop offset="50%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>

        {/* Effet d'ombre portée subtile */}
        <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f97316" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Ensemble du logo avec filtre léger */}
      <g filter="url(#subtleGlow)">
        
        {/* ================= FLAMMES CENTRALES & INFÉRIEURES ================= */}
        {/* Flamme de fond rouge sombre pour la profondeur */}
        <path
          d="M 160,400 C 130,320 140,240 180,180 C 190,140 190,90 200,30 C 210,90 210,140 220,180 C 260,240 270,320 240,400 Z"
          fill="#9a3412"
          opacity="0.75"
        />

        {/* Flamme Centrale Majeure (Sinueuse en S) */}
        <path
          d="M 200,420 C 175,340 140,300 170,210 C 185,150 210,110 200,10 C 215,65 220,120 215,160 C 205,210 230,270 240,330 C 245,370 225,400 200,420 Z"
          fill="url(#flameGrad)"
        />

        {/* Flamme Interne Gauche */}
        <path
          d="M 180,420 C 150,360 110,310 135,210 C 145,170 165,130 155,50 C 175,95 180,150 170,195 C 155,245 185,310 195,365 Z"
          fill="url(#flameGrad)"
          opacity="0.9"
        />

        {/* Flamme Interne Droite */}
        <path
          d="M 220,420 C 250,360 290,310 265,210 C 255,170 235,130 245,50 C 225,95 220,150 230,195 C 245,245 215,310 205,365 Z"
          fill="url(#flameGrad)"
          opacity="0.9"
        />

        {/* Langue de feu centrale blanche éclatante (Cœur intense) */}
        <path
          d="M 200,400 C 192,340 180,300 190,240 C 195,210 205,185 200,120 C 205,160 210,195 205,225 C 198,255 212,310 210,360 C 208,380 203,395 200,400 Z"
          fill="#ffffff"
          opacity="0.8"
        />


        {/* ================= ANSES / CONTOURS SPORTIFS DE LA COUPE ================= */}
        {/* Anse Gauche (Flanc Flamboyant) */}
        {/* Partie Principale Orange */}
        <path
          d="M 150,430 C 90,410 40,340 40,240 C 40,165 75,120 110,135 C 75,160 65,220 75,280 C 85,340 120,380 150,400 Z"
          fill="url(#wingGrad)"
        />
        {/* Liseré Sombre interne de l'anse gauche */}
        <path
          d="M 140,415 C 105,395 80,350 80,280 C 80,225 90,185 105,155 C 85,190 75,235 75,280 C 75,345 105,390 140,415 Z"
          fill="#1e293b"
        />

        {/* Anse Droite (Flanc Flamboyant d'équilibre) */}
        {/* Partie Principale Orange */}
        <path
          d="M 250,430 C 310,410 360,340 360,240 C 360,165 325,120 290,135 C 325,160 335,220 325,280 C 315,340 280,380 250,400 Z"
          fill="url(#wingGrad)"
        />
        {/* Liseré Sombre interne de l'anse droite */}
        <path
          d="M 260,415 C 295,395 320,350 320,280 C 320,225 310,185 295,155 C 315,190 325,235 325,280 C 325,345 295,390 260,415 Z"
          fill="#1e293b"
        />


        {/* ================= LE BOL DE LA COUPE & SUPPORT ================= */}
        {/* Bol Principal de la Coupe Coupe */}
        <path
          d="M 125,410 C 125,465 160,505 200,505 C 240,505 275,465 275,410 C 275,395 265,395 260,410 C 260,445 235,480 200,480 C 165,480 140,445 140,410 C 135,395 125,395 125,410 Z"
          fill="url(#bowlGrad)"
        />

        {/* Support central immédiat reliant le bol à la base */}
        <path
          d="M 175,495 C 175,515 185,520 200,520 C 215,520 225,515 225,495 Z"
          fill="#1e293b"
        />


        {/* ================= SOCLE / BASE DU TROPHÉE ================= */}
        {/* Échelon Supérieur du Socle (Petit rectangle aminci) */}
        <path
          d="M 155,512 L 245,512 L 250,525 L 150,525 Z"
          fill="#475569"
        />

        {/* Échelon Central du Socle (Bloc robuste) */}
        <path
          d="M 130,525 L 270,525 L 275,565 L 125,565 Z"
          fill="url(#baseGrad)"
        />
        {/* Ligne métallique de brillance au milieu du bloc robuste */}
        <rect x="195" y="525" width="10" height="40" fill="#94a3b8" opacity="0.2" />

        {/* Base Trapézoïdale Finale (Grand socle d'ancrage stability) */}
        <path
          d="M 85,565 L 315,565 L 330,595 L 70,595 Z"
          fill="#0a0f1d"
        />

        {/* Ligne horizontale d'accent gris clair sur le gros socle */}
        <line x1="100" y1="572" x2="300" y2="572" stroke="#475569" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
        
      </g>
    </svg>
  );
}
