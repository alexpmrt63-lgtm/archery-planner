/**
 * PoleLogo — logo "Pôle France Relève / TIR À L'ARC / Nancy" en composition carrée,
 * conçu pour s'afficher dans un badge circulaire sans déformation.
 *
 * Polices requises : Lobster + Montserrat 700/900 (Google Fonts dans index.html)
 *
 * Usage dans un badge circulaire :
 *   <div className="w-24 h-24 rounded-full bg-white shadow-md overflow-hidden flex items-center justify-center">
 *     <PoleLogo size={88} />
 *   </div>
 */
export default function PoleLogo({ size = 110, className = '' }) {
  return (
    <svg
      viewBox="0 0 110 110"
      width={size}
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pôle France Relève — Tir à l'arc Nancy"
    >
      {/* "Pôle" — grand script Lobster, centré */}
      <text
        x="55"
        y="34"
        fontFamily="Lobster, cursive"
        fontSize="28"
        fill="#1a56a0"
        textAnchor="middle"
      >
        Pôle
      </text>

      {/* "FRANCE" — Montserrat Bold, centré */}
      <text
        x="55"
        y="46"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="700"
        fontSize="8"
        fill="#1a56a0"
        textAnchor="middle"
        letterSpacing="1"
      >
        FRANCE
      </text>

      {/* "RELÈVE" — Montserrat Bold, centré */}
      <text
        x="55"
        y="57"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="700"
        fontSize="8"
        fill="#1a56a0"
        textAnchor="middle"
        letterSpacing="1"
      >
        RELÈVE
      </text>

      {/* Swoosh rouge — arc décoratif */}
      <path
        d="M 8 64 Q 55 54 102 64"
        stroke="#e63232"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* "TIR À L'ARC" — Montserrat Black, centré */}
      <text
        x="55"
        y="80"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="900"
        fontSize="11"
        fill="#1a56a0"
        textAnchor="middle"
        letterSpacing="1"
      >
        TIR À L'ARC
      </text>

      {/* "Nancy" — Montserrat Bold, centré */}
      <text
        x="55"
        y="94"
        fontFamily="'Montserrat', sans-serif"
        fontWeight="700"
        fontSize="11"
        fill="#1a56a0"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        Nancy
      </text>
    </svg>
  );
}
