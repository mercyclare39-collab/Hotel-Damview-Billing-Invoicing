import React from 'react';

interface HotelLogoProps {
  logoBase64?: string;
  className?: string;
  size?: number;
  height?: number | string;
  style?: React.CSSProperties;
}

export const HotelLogo: React.FC<HotelLogoProps> = ({ logoBase64, className = '', size = 80, height, style }) => {
  const finalHeight = height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : `${size}px`;
  const finalWidth = height !== undefined ? 'auto' : `${size}px`;

  if (logoBase64 && logoBase64.startsWith('data:image')) {
    return (
      <img
        src={logoBase64}
        alt="Hotel Damview Logo"
        style={{
          height: finalHeight,
          width: finalWidth,
          maxHeight: '100%',
          objectFit: 'contain',
          ...style,
        }}
        className={`rounded-sm ${className}`}
      />
    );
  }

  // Crisp, timeless architectural & water-reflection crest for Hotel Damview
  return (
    <div
      style={{
        height: finalHeight,
        width: height !== undefined ? finalHeight : `${size}px`,
        aspectRatio: '1 / 1',
        ...style,
      }}
      className={`relative flex flex-col items-center justify-center bg-stone-900 text-amber-400 rounded p-1 border border-stone-800 shadow-sm select-none ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer classic gold border ring */}
        <circle cx="50" cy="50" r="46" stroke="#d97706" strokeWidth="2" strokeDasharray="2 1" />
        <circle cx="50" cy="50" r="43" stroke="#b45309" strokeWidth="1" />

        {/* Scenic Dam / Water Ripple lines at bottom */}
        <path
          d="M20 68 Q 35 64, 50 68 T 80 68"
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M25 74 Q 37 71, 50 74 T 75 74"
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Hotel architectural pavilion & crest */}
        <path
          d="M50 20 L68 34 L32 34 Z"
          fill="#f59e0b"
        />
        {/* Columns */}
        <rect x="36" y="36" width="4" height="20" fill="#fbbf24" rx="0.5" />
        <rect x="44" y="36" width="4" height="20" fill="#fbbf24" rx="0.5" />
        <rect x="52" y="36" width="4" height="20" fill="#fbbf24" rx="0.5" />
        <rect x="60" y="36" width="4" height="20" fill="#fbbf24" rx="0.5" />
        {/* Base foundation */}
        <rect x="32" y="56" width="36" height="4" fill="#d97706" rx="0.5" />

        {/* Monogram or Sun badge */}
        <circle cx="50" cy="29" r="3" fill="#ffffff" />

        {/* Established text */}
        <text
          x="50"
          y="85"
          textAnchor="middle"
          fill="#fef3c7"
          fontSize="7"
          fontWeight="bold"
          fontFamily="'Times New Roman', serif"
          letterSpacing="1"
        >
          DAMVIEW
        </text>
      </svg>
    </div>
  );
};
