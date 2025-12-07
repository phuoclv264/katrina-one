'use client';

import { useEffect, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';

export function SantaEffect() {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showSanta, setShowSanta] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const isNoel = theme?.startsWith('noel') || resolvedTheme?.startsWith('noel');
    if (!isNoel) {
        setShowSanta(false);
        return;
    }

    const checkAndShowSanta = () => {
        // 30% chance to show Santa
        if (Math.random() < 0.3) {
            setShowSanta(true);
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
            // Hide after 2 seconds
            hideTimerRef.current = setTimeout(() => setShowSanta(false), 2000);
        }
    };

    // Initial check shortly after load
    const initialTimer = setTimeout(checkAndShowSanta, 2000);

    // Check once per minute
    const interval = setInterval(checkAndShowSanta, 60000);

    return () => {
        clearTimeout(initialTimer);
        clearInterval(interval);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [mounted, theme, resolvedTheme]);

  if (!mounted) return null;

  const isNoel = theme?.startsWith('noel') || resolvedTheme?.startsWith('noel');
  if (!isNoel) return null;

  return (
    <AnimatePresence>
      {showSanta && (
        <motion.div
          initial={{ y: 200, rotate: 10 }}
          animate={{ y: 10, rotate: 0 }}
          exit={{ y: 200, rotate: 10 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 70 }}
          className="fixed bottom-0 left-0 z-[9999] pointer-events-none santa-container"
        >
          <div className="relative w-full h-full">
             {/* Speech Bubble */}
             <motion.div 
               initial={{ opacity: 0, scale: 0.5 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.8, duration: 0.5 }}
               className="absolute -top-10 right-0 bg-card border-2 border-destructive rounded-2xl p-2 px-4 shadow-lg z-10"
             >
               <p className="text-destructive font-bold text-sm whitespace-nowrap">Merry Christmas!</p>
               <div className="absolute bottom-[-6px] left-4 w-3 h-3 bg-card border-b-2 border-r-2 border-destructive transform rotate-45"></div>
             </motion.div>

             {/* SVG Santa */}
             <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Body/Suit */}
                <path d="M40,200 L160,200 L160,180 C160,140 130,130 100,130 C70,130 40,140 40,180 Z" fill="#D32F2F" />
                <path d="M100,130 L100,200" stroke="#B71C1C" strokeWidth="2" opacity="0.2"/>
                
                {/* Buttons */}
                <circle cx="100" cy="160" r="4" fill="#FFD700" />
                <circle cx="100" cy="180" r="4" fill="#FFD700" />

                {/* Belt */}
                <rect x="40" y="190" width="120" height="10" fill="#212121" />
                <rect x="90" y="188" width="20" height="14" fill="none" stroke="#FFD700" strokeWidth="2" rx="2" />

                {/* Head Group */}
                <g className="animate-head-bob">
                    {/* Beard (Back layer) */}
                    <path d="M60,100 Q100,180 140,100" fill="#F5F5F5" />
                    
                    {/* Face */}
                    <circle cx="100" cy="90" r="35" fill="#FFCCBC" />
                    
                    {/* Beard (Front fluff) */}
                    <path d="M65,110 Q80,140 100,140 Q120,140 135,110 Q140,100 130,100 Q100,100 70,100 Q60,100 65,110" fill="#F5F5F5" />

                    {/* Mouth (Singing/Smiling) */}
                    <motion.path 
                        d="M90,115 Q100,125 110,115" 
                        fill="none" 
                        stroke="#000" 
                        strokeWidth="2" 
                        strokeLinecap="round"
                        animate={{ d: ["M90,115 Q100,125 110,115", "M90,115 Q100,110 110,115", "M90,115 Q100,125 110,115"] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />

                    {/* Moustache */}
                    <path d="M100,112 Q80,112 85,100 Q90,95 100,105 Q110,95 115,100 Q120,112 100,112" fill="#F5F5F5" stroke="#E0E0E0" strokeWidth="1" />

                    {/* Nose */}
                    <circle cx="100" cy="100" r="6" fill="#EF9A9A" />

                    {/* Eyes */}
                    <g>
                       <ellipse cx="88" cy="90" rx="3" ry="4" fill="#212121" />
                       <ellipse cx="112" cy="90" rx="3" ry="4" fill="#212121" />
                       {/* Blinking Animation Overlay */}
                       <motion.g
                         animate={{ opacity: [0, 0, 1, 0] }}
                         transition={{ repeat: Infinity, duration: 4, times: [0, 0.9, 0.95, 1] }}
                       >
                          <rect x="84" y="86" width="8" height="8" fill="#FFCCBC" />
                          <rect x="108" y="86" width="8" height="8" fill="#FFCCBC" />
                          <line x1="84" y1="90" x2="92" y2="90" stroke="#000" strokeWidth="1" />
                          <line x1="108" y1="90" x2="116" y2="90" stroke="#000" strokeWidth="1" />
                       </motion.g>
                    </g>

                    {/* Glasses */}
                    <g opacity="0.8">
                        <circle cx="88" cy="90" r="8" fill="none" stroke="#FFD700" strokeWidth="1" />
                        <circle cx="112" cy="90" r="8" fill="none" stroke="#FFD700" strokeWidth="1" />
                        <line x1="96" y1="90" x2="104" y2="90" stroke="#FFD700" strokeWidth="1" />
                    </g>

                    {/* Hat */}
                    <path d="M65,80 C65,80 80,40 110,30 C130,23 150,50 150,80" fill="#D32F2F" />
                    <path d="M55,75 Q100,60 145,75 L145,90 Q100,75 55,90 Z" fill="#F5F5F5" />
                    {/* Pom Pom */}
                    <motion.circle 
                        cx="150" cy="80" r="10" fill="#F5F5F5" 
                        animate={{ y: [0, 5, 0], x: [0, 2, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    />
                </g>

                {/* Waving Hand */}
                <motion.g 
                    initial={{ rotate: 0 }}
                    animate={{ rotate: [0, 15, -5, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut", repeatDelay: 1 }}
                    style={{ originX: "140px", originY: "160px" }}
                >
                    <path d="M140,160 L160,140" stroke="#D32F2F" strokeWidth="12" strokeLinecap="round" />
                    {/* Mitten */}
                    <path d="M155,130 Q165,125 175,135 Q180,145 170,150 Q160,155 155,145 Z" fill="#212121" />
                    <circle cx="160" cy="145" r="5" fill="#212121" /> {/* Thumb */}
                    <rect x="150" y="145" width="14" height="6" fill="#F5F5F5" transform="rotate(-45 157 148)" />
                </motion.g>

                {/* Left Hand (Holding a list maybe? For now just resting) */}
                <g>
                    <path d="M60,160 L40,150" stroke="#D32F2F" strokeWidth="12" strokeLinecap="round" />
                    <circle cx="38" cy="150" r="8" fill="#212121" />
                    <rect x="42" y="152" width="10" height="6" fill="#F5F5F5" transform="rotate(30 47 155)" />
                </g>

             </svg>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
