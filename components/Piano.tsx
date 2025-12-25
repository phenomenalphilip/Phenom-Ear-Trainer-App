
import React, { useRef, useEffect, useState } from 'react';
import { KEYBOARD_RANGE, COLORS, OCTAVE_NOTES, HomeIcon } from '../constants';

interface PianoProps {
  onNoteClick: (midi: number) => void;
  highlightedNote?: number | null;
  correctNote?: number | null;
  errorNote?: number | null;
  rootNote: number;
  theme: 'light' | 'dark';
}

const Piano: React.FC<PianoProps> = ({ onNoteClick, highlightedNote, correctNote, errorNote, rootNote, theme }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isCentered, setIsCentered] = useState(true);

  const whiteKeyWidth = 48; // minimum 44pt width
  const blackKeyWidth = 32;

  const getNoteInfo = (midi: number) => {
    const name = OCTAVE_NOTES[midi % 12];
    const isBlack = name.includes('#');
    return { name, isBlack };
  };

  const keys = [];
  for (let i = KEYBOARD_RANGE.start; i <= KEYBOARD_RANGE.end; i++) {
    keys.push({ midi: i, ...getNoteInfo(i) });
  }

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    const center = (scrollWidth - clientWidth) / 2;
    setIsCentered(Math.abs(scrollLeft - center) < 20);
  };

  const reCenter = () => {
    if (!scrollRef.current) return;
    const { scrollWidth, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: (scrollWidth - clientWidth) / 2,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    reCenter();
  }, []);

  return (
    <div className="relative w-full h-48 sm:h-64 flex-none overflow-hidden border-t border-[var(--border-color)] bg-[var(--bg-main)]">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex h-full overflow-x-auto select-none no-scrollbar pb-4 px-4 pt-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="relative flex h-full">
          {keys.map((key) => {
            const isCorrect = correctNote === key.midi;
            const isError = errorNote === key.midi;
            const isHighlighted = highlightedNote === key.midi;
            const isRoot = rootNote === key.midi;

            // Correct during error state should have yellow outline
            const extraStyles = isCorrect && isError === false ? {
               border: `2px solid ${COLORS.gold}`,
               boxShadow: `0 0 20px ${COLORS.mint}`
            } : {};

            if (key.isBlack) {
              return (
                <button
                  key={key.midi}
                  onClick={() => onNoteClick(key.midi)}
                  className={`absolute top-0 z-10 rounded-b-md transition-all duration-150 border-x border-b border-blue-500/20 active:translate-y-1 shadow-lg`}
                  style={{
                    left: `${(keys.slice(0, key.midi - KEYBOARD_RANGE.start).filter(k => !k.isBlack).length * whiteKeyWidth) - (blackKeyWidth / 2)}px`,
                    width: `${blackKeyWidth}px`,
                    height: '60%',
                    backgroundColor: isCorrect ? COLORS.mint : isError ? COLORS.crimson : isHighlighted ? COLORS.electricBlue : COLORS.blackKey,
                    boxShadow: isCorrect ? `0 0 15px ${COLORS.mint}` : isError ? `0 0 15px ${COLORS.crimson}` : 'none',
                    ...extraStyles
                  }}
                >
                  <div className="absolute inset-0 border-t border-white/10 rounded-b-md"></div>
                  {isRoot && <HomeIcon className="w-4 h-4 text-white mx-auto mt-2 opacity-50" />}
                </button>
              );
            }

            return (
              <button
                key={key.midi}
                onClick={() => onNoteClick(key.midi)}
                className={`relative z-0 border-x border-b rounded-b-lg transition-all duration-150 active:translate-y-1`}
                style={{
                  minWidth: `${whiteKeyWidth}px`,
                  height: '100%',
                  backgroundColor: isCorrect ? COLORS.mint : isError ? COLORS.crimson : isHighlighted ? COLORS.electricBlue : COLORS.whiteKey,
                  boxShadow: isCorrect ? `0 0 15px ${COLORS.mint}` : isError ? `0 0 15px ${COLORS.crimson}` : '0 4px 0 rgba(0,0,0,0.1)',
                  borderColor: theme === 'dark' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
                  ...extraStyles
                }}
              >
                <div className="absolute bottom-2 left-0 right-0 text-[10px] mono text-black/40 font-bold">
                    {key.name}{(key.midi / 12 - 1).toFixed(0)}
                </div>
                {isRoot && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2">
                    <HomeIcon className="w-5 h-5 text-black opacity-30" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!isCentered && (
        <button 
          onClick={reCenter}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] backdrop-blur-md rounded-full p-3 text-[var(--text-main)] transition-all border border-[var(--border-color)] z-20 shadow-lg"
        >
          <HomeIcon className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default Piano;
