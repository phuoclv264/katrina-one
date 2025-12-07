
export const NoelCameraIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Body Bottom */}
    <rect x="5" y="30" width="90" height="45" rx="5" fill="#C62828" />
    
    {/* Body Top Strip */}
    <rect x="5" y="25" width="90" height="15" rx="5" fill="#E57373" />
    
    {/* Top Dial/Flash bump */}
    <path d="M30 25 L35 15 L65 15 L70 25 Z" fill="#E57373" />
    
    {/* Shutter Button */}
    <rect x="75" y="18" width="10" height="8" rx="2" fill="#FFD54F" />
    
    {/* Lens Group */}
    <circle cx="50" cy="50" r="22" fill="#F5F5F5" stroke="#FFD54F" strokeWidth="2" /> {/* Outer Ring */}
    <circle cx="50" cy="50" r="18" fill="#37474F" /> {/* Inner Dark */}
    <circle cx="50" cy="50" r="12" fill="#263238" /> {/* Lens Glass */}
    <circle cx="54" cy="46" r="4" fill="rgba(255,255,255,0.4)" /> {/* Reflection */}
    
    {/* Snow on Top */}
    <path d="M5 28 C15 32, 20 25, 30 28 C40 31, 45 25, 55 28 C65 31, 70 25, 80 28 C90 31, 95 25, 95 28 L95 25 C95 22, 93 20, 90 20 L10 20 C7 20, 5 22, 5 25 Z" fill="white" />
    <path d="M35 15 C40 18, 45 14, 50 16 C55 18, 60 14, 65 15 L65 15 L35 15 Z" fill="white" />
    
    {/* Snowflake Details */}
    <circle cx="15" cy="50" r="1.5" fill="white" opacity="0.8"/>
    <circle cx="85" cy="60" r="1.5" fill="white" opacity="0.8"/>
    <circle cx="10" cy="65" r="1" fill="white" opacity="0.6"/>
  </svg>
);
