
import React from 'react';

export const COLORS = {
  bg: '#121212',
  whiteKey: '#E0E0E0',
  blackKey: '#000000',
  mint: '#00FFCC',
  crimson: '#FF2D55',
  electricBlue: '#3A86FF',
  gold: '#FFD700',
};

export const OCTAVE_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const INTERVAL_NAMES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

export const KEYBOARD_RANGE = { start: 36, end: 84 }; // C2 to C6

export const HomeIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z" />
  </svg>
);

export const OwlMascot = ({ className, state = 'idle' }: { className?: string, state?: 'idle' | 'active' | 'success' | 'fail' }) => (
  <div className={`relative ${className}`}>
     <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
        {/* Friendly Round Body */}
        <circle cx="50" cy="55" r="35" fill={state === 'fail' ? '#FF2D55' : state === 'success' ? '#00FFCC' : '#E0E0E0'} />
        
        {/* Belly Patch */}
        <circle cx="50" cy="65" r="20" fill="rgba(255,255,255,0.3)" />

        {/* Headphones connecting band */}
        <path d="M15 55 C15 20 85 20 85 55" fill="none" stroke="#333" strokeWidth="6" strokeLinecap="round" />
        
        {/* Headphone muffs */}
        <rect x="8" y="45" width="12" height="25" rx="4" fill="#333" />
        <rect x="80" y="45" width="12" height="25" rx="4" fill="#333" />
        
        {/* Eyes - Big and Cute */}
        <g transform={state === 'active' ? 'translate(0, -2)' : ''}>
           <circle cx="38" cy="50" r="10" fill="white" stroke="#333" strokeWidth="2" />
           <circle cx="62" cy="50" r="10" fill="white" stroke="#333" strokeWidth="2" />
           
           {/* Pupils */}
           {state === 'fail' ? (
             <>
               <text x="38" y="55" fontSize="12" textAnchor="middle" fill="#333">x</text>
               <text x="62" y="55" fontSize="12" textAnchor="middle" fill="#333">x</text>
             </>
           ) : (
             <>
               <circle cx="38" cy="50" r="4" fill="#333">
                 {state === 'active' && <animate attributeName="cy" values="50;48;50" dur="0.5s" repeatCount="indefinite" />}
               </circle>
               <circle cx="62" cy="50" r="4" fill="#333">
                 {state === 'active' && <animate attributeName="cy" values="50;48;50" dur="0.5s" repeatCount="indefinite" />}
               </circle>
               <circle cx="40" cy="48" r="1.5" fill="white" />
               <circle cx="64" cy="48" r="1.5" fill="white" />
             </>
           )}
        </g>

        {/* Beak */}
        <path d="M50 60 L46 66 L54 66 Z" fill="#FFA500" stroke="#333" strokeWidth="1" />

        {/* Expression */}
        {state === 'success' && (
           <path d="M40 75 Q50 82 60 75" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
        )}
     </svg>
  </div>
);
