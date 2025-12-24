import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { signInWithPopup, signOut, onAuthStateChanged, User, AuthError } from 'firebase/auth';
import { auth, googleProvider } from './services/firebase';

import Piano from './components/Piano';
import Heatmap from './components/Heatmap';
import { UserStats, GameState, Question, DifficultyLevel, Challenge } from './types';
import { COLORS, OwlMascot, INTERVAL_NAMES, OCTAVE_NOTES } from './constants';
import { audioEngine } from './services/audioEngine';
import { generateCurriculum } from './services/curriculum';
import { StorageService } from './services/storage';

const CURRICULUM = generateCurriculum();

// User-specified Solfege mapping
const SOLFEGE_MAP = ['Doh', 'Di', 'Re', 'Ri', 'Mi', 'Fah', 'Fi', 'Soh', 'Zi', 'la', 'Toh', 'Ti'];

// --- HELPERS ---

const getNoteName = (midi: number) => OCTAVE_NOTES[midi % 12];
const getSolfege = (midi: number, root: number) => {
    const interval = ((midi - root) % 12 + 12) % 12;
    return SOLFEGE_MAP[interval];
};

// --- ALGORITHMS ---

const getUnlockedNotes = (unlockedIds: number[]) => {
  const maxId = Math.max(...unlockedIds);
  const unlockedNotes = new Set<number>();
  CURRICULUM.filter(c => c.id <= maxId).forEach(c => {
    c.notePool.forEach(n => unlockedNotes.add(n));
  });
  return Array.from(unlockedNotes);
};

const getWeakSpots = (heatmap: number[]) => {
  const withIndex = heatmap.map((score, i) => ({ score, i }));
  withIndex.sort((a, b) => a.score - b.score);
  return withIndex.slice(0, 4).map(x => x.i);
};

const generateDojoQuestions = (stats: UserStats, count: number = 10, forceWeakSpots: boolean = false): Question[] => {
  const unlockedNotes = getUnlockedNotes(stats.unlockedChallenges);
  const weakSpots = getWeakSpots(stats.heatmap);
  const availableWeakSpots = weakSpots.filter(n => unlockedNotes.includes(n));
  const poolToUseForWeak = availableWeakSpots.length > 0 ? availableWeakSpots : unlockedNotes;

  return Array.from({ length: count }).map(() => {
    const keyCenter = 60; 
    const melody: number[] = [];
    
    const useWeak = forceWeakSpots || Math.random() < 0.7;
    const pool = useWeak ? poolToUseForWeak : unlockedNotes;
    
    const interval = pool[Math.floor(Math.random() * pool.length)];
    melody.push(keyCenter + interval);

    return { 
      keyCenter, 
      targetMelody: melody, 
      description: useWeak ? "Weak Spot Training" : "Daily Warmup" 
    };
  });
};

const generatePracticeQuestions = (difficulty: string, stats: UserStats, count: number = 10, forceWeakSpots: boolean = false): Question[] => {
  const weakSpots = getWeakSpots(stats.heatmap);
  
  // Define pools based on difficulty
  let basePool: number[];
  let sequenceLength: number;
  let octaveRange: number;

  switch (difficulty) {
    case DifficultyLevel.MASTER:
      basePool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Chromatic
      sequenceLength = 5;
      octaveRange = 2;
      break;
    case DifficultyLevel.INTERMEDIATE:
      basePool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Chromatic
      sequenceLength = 3;
      octaveRange = 1.5;
      break;
    case DifficultyLevel.BEGINNER:
    default:
      basePool = [0, 2, 4, 5, 7, 9, 11]; // Major Scale
      sequenceLength = 1;
      octaveRange = 1;
      break;
  }

  // If weak spots active, intersect base pool with weak spots. 
  // If intersection is empty, fallback to base pool to avoid crash.
  let activePool = basePool;
  if (forceWeakSpots) {
    const intersection = basePool.filter(n => weakSpots.includes(n));
    if (intersection.length > 0) activePool = intersection;
  }

  return Array.from({ length: count }).map(() => {
    // Random Key Center
    const keyCenter = (difficulty === DifficultyLevel.BEGINNER) ? 60 : Math.floor(Math.random() * 12) + 54;
    const melody: number[] = [];
    
    for (let i = 0; i < sequenceLength; i++) {
      const interval = activePool[Math.floor(Math.random() * activePool.length)];
      let note = keyCenter + interval;
      
      if (octaveRange > 1) {
         // Add some random octave displacement for harder levels
         const shift = Math.floor(Math.random() * (octaveRange * 2)) - Math.floor(octaveRange);
         note += shift * 12;
      }
      melody.push(note);
    }

    return {
      keyCenter,
      targetMelody: melody,
      description: forceWeakSpots ? "Targeting Weakness" : `${difficulty} Practice`
    };
  });
};

const generateChallengeQuestions = (challenge: Challenge): Question[] => {
  return Array.from({ length: challenge.tasksCount || 10 }).map(() => {
    const keyCenter = (challenge.isModulating || Math.random() > 0.8) ? Math.floor(Math.random() * 12) + 54 : 60;
    const melody: number[] = [];
    for(let i=0; i < challenge.sequenceLength; i++) {
      const interval = challenge.notePool[Math.floor(Math.random() * challenge.notePool.length)];
      let note = keyCenter + interval;
      if (challenge.octaveRange > 1) {
        const shift = Math.floor(Math.random() * (challenge.octaveRange * 2)) - Math.floor(challenge.octaveRange);
        note += shift * 12;
      }
      melody.push(note);
    }
    return { keyCenter, targetMelody: melody, description: challenge.title };
  });
};


// --- COMPONENTS ---

const MenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button 
    onClick={onClick} 
    className="absolute top-6 right-6 z-40 w-10 h-10 flex flex-col justify-center items-end gap-1.5 group cursor-pointer p-2"
  >
    <div className="w-6 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors"></div>
    <div className="w-4 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors group-hover:w-6 duration-300"></div>
    <div className="w-5 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors group-hover:w-6 duration-200"></div>
  </button>
);

const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void; onOpenSettings: () => void; stats: UserStats }> = ({ isOpen, onClose, onOpenSettings, stats }) => {
  const navigate = useNavigate();
  
  const handleNav = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleSettings = () => {
    onOpenSettings();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute top-0 right-0 bottom-0 w-64 bg-[var(--bg-main)] border-l border-[var(--border-color)] p-8 shadow-2xl animate-slide-left flex flex-col justify-between">
        
        <div>
          <div className="flex justify-end mb-8">
            <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-2xl">✕</button>
          </div>

          <div className="mb-10 pl-2 border-l-2 border-[#00FFCC]">
            <h2 className="text-2xl font-black text-[var(--text-main)] italic tracking-tighter">PHENOM</h2>
            <div className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest">Level {stats.level} User</div>
          </div>

          <nav className="flex flex-col gap-6">
            <button onClick={() => handleNav('/')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">HOME</button>
            <button onClick={() => handleNav('/dojo')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">DAILY DOJO</button>
            <button onClick={() => handleNav('/practice')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">PRACTICE MODE</button>
            <button onClick={() => handleNav('/exam')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">EXAM MODE</button>
            <button onClick={() => handleNav('/levels')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">EXERCISES</button>
            <button onClick={() => handleNav('/stats')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:italic transition-all">PROFILE</button>
          </nav>
        </div>

        <div className="space-y-4">
           <button onClick={handleSettings} className="w-full py-4 border border-[var(--border-color)] rounded-xl text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)] transition-all">
             Settings
           </button>
           <div className="text-[10px] text-center text-[var(--text-muted)] font-mono">v1.3.1 EXAM</div>
        </div>

      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onReset: () => void; 
  onToggleTheme: () => void; 
  stats: UserStats;
  user: User | null;
}> = ({ isOpen, onClose, onReset, onToggleTheme, stats, user }) => {

  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = async () => {
     if (isAuthLoading) return;
     setIsAuthLoading(true);
     setAuthError(null);
     try {
        await signInWithPopup(auth, googleProvider);
     } catch (error: any) {
        console.error("Login failed", error);
        
        // Handle specific Firebase errors
        if (error.code === 'auth/unauthorized-domain') {
            setAuthError(`Domain not authorized: ${window.location.hostname}`);
        } else if (error.code === 'auth/popup-blocked') {
            setAuthError("Popup blocked. Please allow popups for this site.");
        } else if (error.code === 'auth/cancelled-popup-request') {
             // User closed the popup, or clicked twice. Ignore.
             console.log("Popup cancelled by user");
        } else {
             setAuthError(`Error: ${error.message}`);
        }
     } finally {
        setIsAuthLoading(false);
     }
  };

  const handleLogout = async () => {
     try {
        await signOut(auth);
        setAuthError(null);
     } catch (error) {
        console.error("Logout failed", error);
     }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-slide-up">
        <h2 className="text-2xl font-black text-[var(--text-main)] italic mb-6">SETTINGS</h2>
        
        {/* Auth Section */}
        <div className="mb-6 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
            {user ? (
                <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-3">
                      {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full" />}
                      <div className="text-sm font-bold text-[var(--text-main)] truncate">{user.displayName}</div>
                   </div>
                   <button 
                      onClick={handleLogout}
                      className="w-full py-2 bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg text-xs font-black uppercase tracking-widest"
                   >
                      Sign Out
                   </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <button 
                    onClick={handleLogin}
                    disabled={isAuthLoading}
                    className={`w-full py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex justify-center items-center gap-2 ${
                        isAuthLoading 
                        ? 'bg-gray-500 cursor-wait opacity-70' 
                        : 'bg-[#4285F4] hover:bg-[#357ae8]'
                    }`}
                    >
                    {isAuthLoading ? (
                        <span>Connecting...</span>
                    ) : (
                        <>
                            <span>G</span>
                            <span>Sign in with Google</span>
                        </>
                    )}
                    </button>
                    {authError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <div className="text-xs text-red-500 font-bold mb-1">Authentication Failed</div>
                            <div className="text-[10px] text-[var(--text-muted)] leading-tight">{authError}</div>
                            {authError.includes('Domain not authorized') && (
                                <div className="mt-2 text-[10px] text-[var(--text-main)] bg-red-500/10 p-2 rounded border border-red-500/20">
                                    <strong>Fix:</strong> Add <code>{window.location.hostname}</code> to <em>Firebase Console &gt; Authentication &gt; Settings &gt; Authorized Domains</em>.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="space-y-4 mb-8">
           <div className="flex justify-between items-center text-sm p-3 bg-[var(--bg-card)] rounded-xl">
             <span className="text-[var(--text-muted)] font-bold">Theme</span>
             <button onClick={onToggleTheme} className="px-4 py-2 bg-[var(--bg-card-hover)] rounded-lg font-bold text-[var(--text-main)] text-xs uppercase tracking-wider">
                {stats.theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
             </button>
           </div>
           
           <div className="flex justify-between text-sm px-2">
             <span className="text-[var(--text-muted)] font-bold">XP</span>
             <span className="text-[#00FFCC] font-mono">{stats.xp}</span>
           </div>
           <div className="flex justify-between text-sm px-2">
             <span className="text-[var(--text-muted)] font-bold">Streak</span>
             <span className="text-orange-400 font-mono">{stats.streak} days</span>
           </div>
           <div className="flex justify-between text-sm px-2">
             <span className="text-[var(--text-muted)] font-bold">Level</span>
             <span className="text-blue-400 font-mono">{stats.level}</span>
           </div>
        </div>

        <button 
          onClick={onReset}
          className="w-full bg-red-500/10 border border-red-500/50 text-red-500 py-4 rounded-xl font-bold mb-4 hover:bg-red-500/20 transition-colors"
        >
          RESET PROGRESS
        </button>
        
        <button 
          onClick={onClose}
          className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] py-4 rounded-xl font-bold hover:bg-[var(--bg-card-hover)] transition-colors"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

const SessionSummary: React.FC<{ xp: number; accuracy: number; passed: boolean; maxXP: number; onContinue: () => void; isExam?: boolean }> = ({ xp, accuracy, passed, maxXP, onContinue, isExam }) => {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      {/* Confetti / Burst Background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
         <div className={`w-96 h-96 rounded-full blur-[120px] ${passed ? 'bg-[#00FFCC]' : 'bg-red-500'}`}></div>
      </div>
      
      {passed ? (
        <>
            <div className="absolute top-20 left-10 text-yellow-500 animate-pulse text-4xl">✨</div>
            <div className="absolute top-40 right-10 text-[#00FFCC] animate-pulse delay-75 text-5xl">✳️</div>
        </>
      ) : (
        <div className="absolute top-20 right-10 text-red-500 animate-pulse text-4xl">💔</div>
      )}

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        
        <OwlMascot state={passed ? "success" : "fail"} className="w-48 h-48 mb-8" />
        
        <h2 className={`text-3xl font-black italic mb-2 tracking-tight drop-shadow-lg ${passed ? 'text-[#FFD700]' : 'text-red-500'}`}>
            {isExam ? (passed ? "Exam Passed!" : "Exam Failed") : (passed ? "Session Cleared!" : "Session Failed")}
        </h2>
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-widest text-xs mb-10">
            {passed ? "Qualification Met" : "Did not qualify"}
        </p>
        
        <div className="grid grid-cols-2 gap-4 w-full mb-12">
           <div className="bg-[var(--bg-card)] border border-yellow-500/30 rounded-2xl p-4 flex flex-col items-center shadow-lg">
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">{isExam ? "Score" : "XP Earned"}</div>
              <div className="flex items-center text-[var(--text-main)]">
                 <span className="text-2xl mr-2">⚡</span>
                 <span className="text-3xl font-black">{xp}</span>
              </div>
           </div>
           
           <div className="bg-[var(--bg-card)] border border-[#00FFCC]/30 rounded-2xl p-4 flex flex-col items-center shadow-lg">
              <div className="text-[10px] font-black text-[#00FFCC] uppercase tracking-widest mb-1">{isExam ? "Pass Req." : "Pass Req."}</div>
              <div className="flex items-center text-[var(--text-main)]">
                 <span className="text-2xl mr-2">🎯</span>
                 <span className="text-3xl font-black">{Math.floor(maxXP * 0.8)}</span>
              </div>
           </div>
        </div>

        <button 
          onClick={onContinue}
          className={`w-full font-black text-xl py-5 rounded-2xl transition-all shadow-lg active:translate-y-1 active:shadow-none ${
              passed 
              ? 'bg-[#00FFCC] text-black shadow-[0_4px_0_#00AA88] hover:brightness-110' 
              : 'bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
          }`}
        >
          {passed ? "CONTINUE" : "TRY AGAIN"}
        </button>

      </div>
    </div>
  );
};

const WelcomeScreen: React.FC<{ stats: UserStats, onOpenSettings: () => void }> = ({ stats, onOpenSettings }) => {
  const navigate = useNavigate();
  
  const handleContinueExercises = () => {
    const maxUnlocked = Math.max(...stats.unlockedChallenges);
    navigate(`/play/${maxUnlocked}`);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-8 items-center justify-between py-10">
      <div className="flex flex-col items-center w-full mt-8">
        <div className="flex justify-between w-full mb-8 bg-[var(--bg-card)] p-4 rounded-2xl border border-[var(--border-color)]">
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">XP</span>
                <span className="text-[#00FFCC] font-bold text-xl">{stats.xp}</span>
            </div>
             <div className="flex flex-col items-center">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Level</span>
                <span className="text-blue-400 font-bold text-xl">{stats.level}</span>
            </div>
            <div className="flex flex-col items-center">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Lives</span>
                <span className="text-red-500 font-bold text-xl">❤️ {stats.hearts}</span>
            </div>
        </div>

        <div className="mb-8 relative">
           <div className="absolute inset-0 bg-[#00FFCC]/10 blur-[100px] rounded-full scale-150"></div>
           <OwlMascot className="w-56 h-56 relative z-10" />
        </div>
        <h1 className="text-6xl font-black italic tracking-tighter text-[var(--text-main)] mb-2 drop-shadow-2xl">PHENOM</h1>
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-[0.5em] text-[10px] mb-8">The Elite Ear Dojo</p>
      </div>

      <div className="w-full flex flex-col gap-4 mb-4">
        <button 
          onClick={() => navigate('/dojo')}
          className="w-full bg-[#00FFCC] py-5 rounded-3xl font-black text-xl text-[#0a0a0a] hover:brightness-110 transition-all shadow-[0_6px_0_#00AA88] active:translate-y-1 active:shadow-none animate-gentle-pulse"
        >
          <div className="flex flex-col items-center">
             <span>DAILY DOJO</span>
             {stats.streak > 0 && <span className="text-[10px] uppercase font-bold tracking-widest opacity-60 mt-1">🔥 Streak: {stats.streak}</span>}
          </div>
        </button>

        <button 
          onClick={handleContinueExercises}
          className="w-full bg-blue-600/10 border border-blue-500/50 py-5 rounded-3xl font-black text-xl text-blue-500 hover:bg-blue-600/20 transition-all"
        >
          CONTINUE EXERCISES
        </button>
      </div>
    </div>
  );
};

const PracticeSelector: React.FC = () => {
  const navigate = useNavigate();
  const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER];
  
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-6 pt-20">
      <div className="flex items-center mb-10">
        <button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button>
        <h2 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight">Practice Mode</h2>
      </div>
      <p className="text-[var(--text-muted)] mb-8 text-sm">Select a difficulty. Exercises generate endlessly. Focus on your accuracy.</p>
      <div className="grid grid-cols-1 gap-6">
        {levels.map((lvl, idx) => (
          <button
            key={lvl}
            onClick={() => navigate(`/practice/${lvl}`)}
            className="group relative flex flex-col p-8 rounded-[2.5rem] bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-blue-400 transition-all active:scale-95 shadow-sm"
          >
            <div className="text-[var(--text-muted)] font-black text-[10px] tracking-[0.3em] uppercase mb-2">Mode {idx + 1}</div>
            <div className="text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">{lvl}</div>
            <div className="text-[var(--text-muted)] text-sm mt-1">Infinite Drills</div>
            <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
               <OwlMascot className="w-16 h-16" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ExamSelector: React.FC<{ stats: UserStats }> = ({ stats }) => {
  const navigate = useNavigate();
  const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER];
  
  // Find exam IDs for each level
  const examIds = useMemo(() => {
    const ids: Record<string, number> = {};
    levels.forEach(l => {
        const exam = CURRICULUM.find(c => c.level === l && c.isExam);
        if (exam) ids[l] = exam.id;
    });
    return ids;
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-6 pt-20">
      <div className="flex items-center mb-10">
        <button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button>
        <h2 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight">Exam Mode</h2>
      </div>
      <p className="text-[var(--text-muted)] mb-8 text-sm">Strict testing. No immediate feedback. Pass to prove mastery.</p>
      <div className="grid grid-cols-1 gap-6">
        {levels.map((lvl, idx) => {
            const id = examIds[lvl];
            const isUnlocked = stats.unlockedChallenges.includes(id);
            return (
              <button
                key={lvl}
                onClick={() => id && navigate(`/play/${id}`)}
                className={`group relative flex flex-col p-8 rounded-[2.5rem] border transition-all active:scale-95 shadow-sm bg-[var(--bg-card)] border-[var(--border-color)] hover:border-purple-500 cursor-pointer`}
              >
                <div className="text-[var(--text-muted)] font-black text-[10px] tracking-[0.3em] uppercase mb-2">Exam {idx + 1}</div>
                <div className="text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">{lvl} EXAM</div>
                <div className="text-[var(--text-muted)] text-sm mt-1">{isUnlocked ? 'Ready to Start' : 'Attempt Early (Test Out)'}</div>
                <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
                   <span className="text-4xl">🎓</span>
                </div>
              </button>
            );
        })}
      </div>
    </div>
  );
};

const LevelSelector: React.FC = () => {
  const navigate = useNavigate();
  const levels = [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER];
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-6 pt-20">
      <div className="flex items-center mb-10">
        <button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button>
        <h2 className="text-2xl font-black text-[var(--text-main)] italic tracking-tight">Select Level</h2>
      </div>
      <div className="grid grid-cols-1 gap-6">
        {levels.map((lvl, idx) => (
          <button
            key={lvl}
            onClick={() => navigate(`/level/${lvl}`)}
            className="group relative flex flex-col p-8 rounded-[2.5rem] bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--text-muted)] transition-all active:scale-95 shadow-sm"
          >
            <div className="text-[var(--text-muted)] font-black text-[10px] tracking-[0.3em] uppercase mb-2">Tier {idx + 1}</div>
            <div className="text-3xl font-black text-[var(--text-main)] italic uppercase tracking-tighter">{lvl}</div>
            <div className="text-[var(--text-muted)] text-sm mt-1">50 Professional Challenges</div>
            <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
               <OwlMascot className="w-20 h-20" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ChallengeList: React.FC<{ stats: UserStats }> = ({ stats }) => {
  const { level } = useParams();
  const navigate = useNavigate();
  const filteredChallenges = useMemo(() => CURRICULUM.filter(c => c.level === level), [level]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] overflow-hidden pt-12">
      <div className="p-6 border-b border-[var(--border-color)] bg-[var(--bg-main)]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/levels')} className="text-[var(--text-muted)] text-2xl">←</button>
          <div className="text-center">
            <h2 className="text-xl font-black text-[var(--text-main)] italic uppercase">{level}</h2>
            <div className="text-[10px] font-black text-[var(--text-muted)] tracking-widest uppercase">Curriculum Block</div>
          </div>
          <div className="w-8"></div>
        </div>
        <div className="flex gap-4 border-b border-[var(--border-color)] pb-2">
           <button className="text-[var(--text-main)] font-bold border-b-2 border-[#00FFCC] pb-2 px-2">Standard</button>
           <button className="text-[var(--text-muted)] font-bold pb-2 px-2">Custom</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredChallenges.map((c) => {
          const isUnlocked = stats.unlockedChallenges.includes(c.id);
          const highScore = stats.highScores[c.id] || 0;
          const isSolved = highScore > 0;
          
          return (
            <button
              key={c.id}
              disabled={!isUnlocked}
              onClick={() => navigate(`/play/${c.id}`)}
              className={`w-full flex items-center p-4 rounded-2xl transition-all ${
                c.isExam 
                   ? (isSolved ? 'bg-purple-500/10 border-purple-500/30' : isUnlocked ? 'bg-purple-900/20 border-purple-500/50 hover:bg-purple-900/30' : 'opacity-30 grayscale cursor-not-allowed bg-[var(--bg-card)]')
                   : (isSolved 
                    ? 'bg-[#00FFCC]/10 border border-[#00FFCC]/30 hover:bg-[#00FFCC]/20 active:scale-[0.98]'
                    : isUnlocked 
                      ? 'bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] active:scale-[0.98]' 
                      : 'opacity-30 grayscale cursor-not-allowed bg-[var(--bg-card)]')
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${c.isExam ? 'bg-purple-500/20' : isSolved ? 'bg-[#00FFCC]/20' : 'bg-[var(--bg-main)]'}`}>
                 <span className="text-[var(--text-muted)]">{c.isExam ? '🎓' : isSolved ? '🏆' : '🎵'}</span>
              </div>
              <div className="flex-1 text-left">
                <div className={`font-bold text-sm leading-tight ${c.isExam ? 'text-purple-400' : isSolved ? 'text-[#00FFCC]' : 'text-[var(--text-main)]'}`}>{c.title}</div>
                <div className="text-[var(--text-muted)] text-[10px] uppercase font-black tracking-tighter mt-0.5">{c.subtitle}</div>
                <div className="text-[var(--text-muted)] text-[10px] mt-1 font-mono">High score: {highScore}</div>
              </div>
              <div className="text-right">
                <div className="text-[var(--text-muted)] text-[10px] font-bold uppercase">{c.tasksCount} tasks</div>
                {!isUnlocked && <div className="text-[10px] text-red-900 font-black uppercase mt-1">Locked</div>}
                {isUnlocked && !isSolved && <div className="text-[10px] text-teal-600 font-black uppercase mt-1">Unlocked</div>}
                {isSolved && <div className="text-[10px] text-[#00FFCC] font-black uppercase mt-1 tracking-widest">SOLVED</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface GameSessionProps {
  stats: UserStats;
  onComplete: (xp: number, passed: boolean, maxXP: number, id?: number) => void;
  onUpdateHeatmap: (interval: number, correct: boolean) => void;
}

const GameSession: React.FC<GameSessionProps> = ({ stats, onComplete, onUpdateHeatmap }) => {
  const { challengeId, difficulty } = useParams();
  const navigate = useNavigate();
  const isDailyDojo = !challengeId && !difficulty;
  const isPracticeMode = !!difficulty;
  const challenge = useMemo(() => (isDailyDojo || isPracticeMode) ? null : CURRICULUM.find(c => c.id === Number(challengeId)), [challengeId, isDailyDojo, isPracticeMode]);
  const isExam = challenge?.isExam ?? false;

  const [gameState, setGameState] = useState<GameState>({
    currentQuestionIndex: 0,
    questions: [],
    lives: 5, // Not used for session termination anymore
    xpGained: 0,
    isDailyDojo,
    challengeId: Number(challengeId)
  });
  
  const [userInput, setUserInput] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ 
    type: 'correct' | 'wrong' | 'partial' | null, 
    userSequence?: number[],
    targetSequence?: number[]
  }>({ type: null });

  const [isAnswering, setIsAnswering] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [weakSpotMode, setWeakSpotMode] = useState(false);
  
  const [mistakes, setMistakes] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  
  // Logic states
  const [hasAttempted, setHasAttempted] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  
  const feedbackSequenceId = useRef(0);

  // Initialization
  useEffect(() => {
    let qs: Question[];
    if (isPracticeMode && difficulty) {
      qs = generatePracticeQuestions(difficulty, stats, 10, weakSpotMode);
    } else if (isDailyDojo) {
      qs = generateDojoQuestions(stats, 10, weakSpotMode);
    } else if (challenge) {
      qs = generateChallengeQuestions(challenge);
    } else {
      qs = [];
    }
    setGameState(prev => ({ ...prev, questions: qs, currentQuestionIndex: 0 }));
    setMistakes(0);
    setShowSummary(false);
    setHasAttempted(false);
    setCanAdvance(false);
    setAttempts(0);
    setIsAnswerRevealed(false);
    feedbackSequenceId.current = 0;
  }, [challenge, isDailyDojo, isPracticeMode, difficulty, weakSpotMode]);

  const playChallenge = async () => {
    if (gameState.questions.length === 0) return;
    const q = gameState.questions[gameState.currentQuestionIndex];
    
    // Only reset input state if starting a new question (not a retry)
    if (!hasAttempted && attempts === 0) {
        setIsAnswering(false);
        setUserInput([]);
        setFeedback({ type: null });
        setCanAdvance(false);
    }

    await audioEngine.playCadence(q.keyCenter);
    await new Promise(r => setTimeout(r, 800));
    
    const bpm = (challenge?.level === DifficultyLevel.MASTER || difficulty === DifficultyLevel.MASTER) ? 140 : 100;
    await audioEngine.playMelody(q.targetMelody, bpm);
    setIsAnswering(true);
  };

  useEffect(() => {
    if (gameState.questions.length > 0 && !showSummary) {
        // Reset full state for new question
        setIsAnswering(false);
        setUserInput([]);
        setFeedback({ type: null });
        setHasAttempted(false);
        setCanAdvance(false);
        setAttempts(0);
        setIsAnswerRevealed(false);
        feedbackSequenceId.current = 0;
        
        playChallenge();
    }
  }, [gameState.currentQuestionIndex, gameState.questions, showSummary]);

  const handleNoteClick = async (midi: number) => {
    audioEngine.playNote(midi, 0.4);

    if (!isAnswering || canAdvance) return; 
    
    const q = gameState.questions[gameState.currentQuestionIndex];
    if (userInput.length < q.targetMelody.length) {
        setUserInput(prev => [...prev, midi]);
    }
  };

  const handleBackspace = () => {
     setUserInput(prev => prev.slice(0, -1));
  };
  
  const handleSkip = () => {
     const q = gameState.questions[gameState.currentQuestionIndex];
     // Count as mistake
     setMistakes(prev => prev + 1);
     
     // Update heatmap with failure for all target notes
     q.targetMelody.forEach(note => {
        const interval = (note - q.keyCenter + 12) % 12;
        onUpdateHeatmap(interval, false);
     });
     
     handleNext();
  };

  const handleCheckSequence = async () => {
     const q = gameState.questions[gameState.currentQuestionIndex];
     const isCorrect = JSON.stringify(userInput) === JSON.stringify(q.targetMelody);

     if (isExam) {
         // EXAM MODE: No feedback, silent grading
         if (isCorrect) {
             setGameState(p => ({ ...p, xpGained: p.xpGained + (10 * q.targetMelody.length) }));
             // Silently update heatmap for correct
             q.targetMelody.forEach(note => {
                const interval = (note - q.keyCenter + 12) % 12;
                onUpdateHeatmap(interval, true);
             });
         } else {
             setMistakes(prev => prev + 1);
             // Silently update heatmap for errors
             userInput.forEach((note, i) => {
                 const target = q.targetMelody[i];
                 if (note !== target) {
                     const interval = (target - q.keyCenter + 12) % 12;
                     onUpdateHeatmap(interval, false);
                 }
             });
         }
         handleNext();
         return;
     }

     // STANDARD MODE
     if (isCorrect) {
         q.targetMelody.forEach(note => {
            const interval = (note - q.keyCenter + 12) % 12;
            onUpdateHeatmap(interval, true);
         });

         setFeedback({ type: 'correct' });
         
         if (!hasAttempted) {
             const earnedXP = 10 * q.targetMelody.length;
             setGameState(p => ({ ...p, xpGained: p.xpGained + earnedXP }));
         }
         
         setCanAdvance(true); 
         setHasAttempted(true);

     } else {
         userInput.forEach((note, i) => {
             const target = q.targetMelody[i];
             if (note !== target) {
                 const interval = (target - q.keyCenter + 12) % 12;
                 onUpdateHeatmap(interval, false);
             }
         });
         
         setMistakes(prev => prev + 1);
         setHasAttempted(true);
         setAttempts(prev => prev + 1);
         
         if (attempts + 1 >= 3) {
             setIsAnswerRevealed(true);
         }
         
         setFeedback({ 
             type: 'wrong', 
             userSequence: userInput, 
             targetSequence: q.targetMelody 
         });
         
         setShowOverlay(true);

         const currentSeqId = ++feedbackSequenceId.current;

         await new Promise(r => setTimeout(r, 600));
         if (feedbackSequenceId.current !== currentSeqId) return; 
         await audioEngine.playMelody(userInput, 180);
         
         await new Promise(r => setTimeout(r, 500));
         if (feedbackSequenceId.current !== currentSeqId) return;
         await audioEngine.playMelody(q.targetMelody, 120);
         
         await new Promise(r => setTimeout(r, 700));
         if (feedbackSequenceId.current !== currentSeqId) return;
         await audioEngine.playNote(q.keyCenter, 1.0);
         
         if (feedbackSequenceId.current === currentSeqId) {
             setCanAdvance(true);
         }
     }
  };

  const handleNext = () => {
      setUserInput([]);
      setFeedback({ type: null });
      setIsAnswering(false);
      setCanAdvance(false);
      setHasAttempted(false);

      if (gameState.currentQuestionIndex < gameState.questions.length - 1) {
        setGameState(p => ({ ...p, currentQuestionIndex: p.currentQuestionIndex + 1 }));
      } else if (isPracticeMode) {
        setGameState(p => ({ 
           ...p, 
           currentQuestionIndex: 0, 
           questions: generatePracticeQuestions(difficulty!, stats, 10, weakSpotMode) 
        }));
      } else {
        setShowSummary(true);
      }
  };
  
  const handleSummaryContinue = () => {
    const maxPotentialXP = gameState.questions.reduce((acc, q) => acc + (10 * q.targetMelody.length), 0);
    const passed = gameState.xpGained >= (maxPotentialXP * 0.8);
    
    onComplete(gameState.xpGained, passed, maxPotentialXP, challenge?.id);
  };

  const handleRetry = () => {
      feedbackSequenceId.current++;
      setShowOverlay(false);
      setFeedback({ type: null });
      setUserInput([]);
      setCanAdvance(false);
      setIsAnswering(true);
  };

  const currentQ = gameState.questions[gameState.currentQuestionIndex];
  const progressPercent = (gameState.currentQuestionIndex / gameState.questions.length) * 100;
  
  if (showSummary) {
    const accuracy = Math.max(0, 100 - (mistakes * 10)); // Rough estimate
    const maxSessionXP = gameState.questions.reduce((acc, q) => acc + (10 * q.targetMelody.length), 0);
    const passed = gameState.xpGained >= (maxSessionXP * 0.8);
    return <SessionSummary xp={gameState.xpGained} accuracy={accuracy} passed={passed} maxXP={maxSessionXP} onContinue={handleSummaryContinue} isExam={isExam} />;
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] overflow-hidden">
      <div className="px-6 pt-6 pb-2 border-b border-[var(--border-color)] bg-[var(--bg-main)]/80 backdrop-blur-md">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => navigate(isPracticeMode ? '/practice' : isExam ? '/exam' : isDailyDojo ? '/' : '/levels')} className="text-[var(--text-muted)]">✕</button>
          {!isPracticeMode && <div className="flex-1 h-2.5 bg-[var(--bg-card)] rounded-full overflow-hidden"><div className="h-full bg-[#00FFCC] transition-all duration-700" style={{ width: `${progressPercent}%` }} /></div>}
          {isPracticeMode && <div className="flex-1 flex justify-center"><div className="text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)]">Endless Mode</div></div>}
          <div className="flex items-center gap-3">
             <div className="text-[#00FFCC] font-black text-sm tracking-wider tabular-nums">XP {gameState.xpGained}</div>
             <div className="text-red-500 font-black animate-pulse">❤️ {stats.hearts}</div>
          </div>
        </div>
        <div className="flex justify-between items-end mb-2">
            <div>
                <span className="text-[10px] text-[var(--text-muted)] font-black tracking-widest uppercase">{isDailyDojo ? 'Daily Dojo' : isPracticeMode ? 'Practice' : challenge?.title}</span>
                <div className="text-[var(--text-main)] font-bold text-xs">{isDailyDojo ? 'Adaptive Warmup' : isPracticeMode ? `${difficulty} Loop` : `Target: ${challenge?.sequenceLength} note(s)`}</div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => playChallenge()} disabled={!isAnswering} className="text-[10px] font-black tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full">REPEAT</button>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
           {!isExam && (
               <>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00FFCC] rounded-full blur-[100px]" style={{ visibility: feedback.type === 'correct' ? 'visible' : 'hidden' }}></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-500 rounded-full blur-[100px]" style={{ visibility: feedback.type === 'wrong' ? 'visible' : 'hidden' }}></div>
               </>
           )}
        </div>
        
        {/* Dynamic Boxes Visualization */}
        <div className="flex gap-3 mb-8">
            {currentQ?.targetMelody.map((_, i) => {
                const filled = userInput.length > i;
                let solfegeText = '';
                
                if (filled) {
                    const playedNote = userInput[i];
                    solfegeText = getSolfege(playedNote, currentQ.keyCenter);
                }

                return (
                    <div 
                        key={i} 
                        className={`w-12 h-12 rounded-xl border-2 transition-all duration-300 flex items-center justify-center font-bold text-sm ${
                            filled 
                            ? (isExam 
                                ? 'bg-[var(--bg-card)] border-[var(--text-muted)] text-[var(--text-main)] shadow-sm scale-100'
                                : 'bg-[#00FFCC] border-[#00FFCC] text-black shadow-[0_0_15px_rgba(0,255,204,0.4)] scale-100')
                            : 'bg-transparent border-[var(--border-color)] scale-90 opacity-50'
                        }`}
                    >
                        {filled ? solfegeText : ''}
                    </div>
                );
            })}
        </div>
        
        <OwlMascot state={feedback.type === 'correct' ? 'success' : feedback.type === 'wrong' ? 'fail' : !isAnswering ? 'active' : 'idle'} className="w-32 h-32 mb-6" />
        
        <div className="h-16 flex flex-col items-center justify-center text-center w-full max-w-xs">
           {!isAnswering && <div className="text-blue-400 font-black tracking-widest text-sm animate-pulse">LISTEN...</div>}
           {isAnswering && (
              <div className="flex gap-3 w-full animate-slide-up">
                 {!canAdvance && (
                     <>
                        {!isExam ? (
                            <button 
                                onClick={handleBackspace} 
                                disabled={userInput.length === 0}
                                className="flex-1 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] font-bold text-sm hover:bg-[var(--bg-card-hover)] disabled:opacity-30 transition-all"
                            >
                                ⌫ 
                            </button>
                        ) : (
                            <button 
                                onClick={handleSkip} 
                                className="flex-1 py-3 rounded-xl bg-[var(--bg-card)] border border-red-500/50 text-red-500 font-bold text-sm hover:bg-red-500/10 transition-all"
                            >
                                SKIP
                            </button>
                        )}
                        
                        {isExam ? (
                             <button 
                                onClick={handleCheckSequence}
                                disabled={userInput.length !== currentQ?.targetMelody.length}
                                className="flex-[2] py-3 rounded-xl bg-purple-500 text-white font-black text-sm hover:bg-purple-400 transition-all shadow-[0_4px_0_#9333ea] active:translate-y-1 active:shadow-none"
                            >
                                SUBMIT
                            </button>
                        ) : (
                            <button 
                                onClick={handleCheckSequence}
                                disabled={userInput.length !== currentQ?.targetMelody.length}
                                className="flex-[2] py-3 rounded-xl bg-[#00FFCC] text-black font-black text-sm hover:brightness-110 disabled:opacity-30 disabled:saturate-0 transition-all shadow-[0_4px_0_#00AA88] active:translate-y-1 active:shadow-none"
                            >
                                CHECK
                            </button>
                        )}
                     </>
                 )}
                 {canAdvance && (
                     <button 
                        onClick={handleNext}
                        className="flex-[2] py-3 rounded-xl bg-blue-500 text-white font-black text-sm hover:bg-blue-400 transition-all shadow-[0_4px_0_#2563EB] active:translate-y-1 active:shadow-none animate-bounce"
                     >
                        NEXT →
                     </button>
                 )}
              </div>
           )}
           {feedback.type === 'correct' && !canAdvance && <div className="animate-bounce text-[#00FFCC] font-black text-xl tracking-tighter italic">PERFECT!</div>}
        </div>
      </div>

      <Piano 
        onNoteClick={handleNoteClick} 
        rootNote={currentQ?.keyCenter || 60} 
        correctNote={null} 
        errorNote={null} 
        highlightedNote={userInput[userInput.length - 1]} 
        theme={stats.theme} 
      />

      {showOverlay && !isExam && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-[var(--bg-main)] rounded-t-[3rem] border-t-4 border-red-500 p-8 animate-slide-up shadow-2xl">
          <h3 className="text-red-500 font-black text-3xl italic tracking-tighter mb-4">MISSED IT</h3>
          
          <div className="bg-[var(--bg-card)] rounded-xl p-4 mb-6 space-y-3">
             <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                 <span className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest">Key Center</span>
                 <span className="text-[var(--text-main)] font-bold">
                    {getNoteName(currentQ.keyCenter)} <span className="text-blue-400 ml-1">({getSolfege(currentQ.keyCenter, currentQ.keyCenter)})</span>
                 </span>
             </div>
             <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2">
                 <span className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest">Target</span>
                 <div className="text-right">
                    {isAnswerRevealed ? (
                        feedback.targetSequence?.map((n, i) => (
                            <span key={i} className="text-[#00FFCC] font-bold ml-2">
                                {getNoteName(n)} <span className="opacity-70 text-xs">({getSolfege(n, currentQ.keyCenter)})</span>
                            </span>
                        ))
                    ) : (
                        <span className="text-[var(--text-muted)] font-mono font-bold tracking-widest">???</span>
                    )}
                 </div>
             </div>
             <div className="flex justify-between items-center">
                 <span className="text-[10px] uppercase font-black text-[var(--text-muted)] tracking-widest">Played</span>
                 <div className="text-right">
                    {feedback.userSequence?.map((n, i) => (
                        <span key={i} className="text-red-500 font-bold ml-2">
                            {getNoteName(n)} <span className="opacity-70 text-xs">({getSolfege(n, currentQ.keyCenter)})</span>
                        </span>
                    ))}
                 </div>
             </div>
          </div>
          
          <div className="flex flex-col gap-3">
             <div className="flex gap-3">
                <button onClick={handleRetry} className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] py-4 rounded-2xl font-black text-[var(--text-main)] text-lg hover:bg-[var(--bg-card-hover)]">RETRY</button>
                <button onClick={() => { setShowOverlay(false); handleNext(); }} className="flex-1 bg-red-600 py-4 rounded-2xl font-black text-white text-lg hover:bg-red-500">NEXT</button>
             </div>
             {!isAnswerRevealed && (
                 <button onClick={() => setIsAnswerRevealed(true)} className="w-full text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] py-2 hover:text-[var(--text-main)]">
                    Reveal Answer
                 </button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC<{ 
  stats: UserStats; 
  onOpenSettings: () => void; 
  handleComplete: (xp: number, passed: boolean, maxXP: number, id?: number) => void; 
  handleUpdateHeatmap: (interval: number, correct: boolean) => void;
  onToggleTheme: () => void;
}> = ({ stats, onOpenSettings, handleComplete, handleUpdateHeatmap, onToggleTheme }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <>
      <MenuButton onClick={() => setIsMenuOpen(true)} />
      
      <SideMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        onOpenSettings={onOpenSettings} 
        stats={stats} 
      />

      <Routes>
        <Route path="/" element={<WelcomeScreen stats={stats} onOpenSettings={onOpenSettings} />} />
        <Route path="/dojo" element={<GameSession stats={stats} onComplete={handleComplete} onUpdateHeatmap={handleUpdateHeatmap} />} />
        <Route path="/practice" element={<PracticeSelector />} />
        <Route path="/practice/:difficulty" element={<GameSession stats={stats} onComplete={handleComplete} onUpdateHeatmap={handleUpdateHeatmap} />} />
        <Route path="/exam" element={<ExamSelector stats={stats} />} />
        <Route path="/levels" element={<LevelSelector />} />
        <Route path="/level/:level" element={<ChallengeList stats={stats} />} />
        <Route path="/play/:challengeId" element={<GameSession stats={stats} onComplete={handleComplete} onUpdateHeatmap={handleUpdateHeatmap} />} />
        <Route path="/stats" element={<WelcomeScreen stats={stats} onOpenSettings={onOpenSettings} />} />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  const [stats, setStats] = useState<UserStats>(StorageService.load());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Listen for Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Load cloud stats and merge with current local stats
        const syncedStats = await StorageService.syncWithCloud(currentUser.uid, stats);
        setStats(syncedStats);
      }
    });
    return () => unsubscribe();
  }, []); // Run once on mount

  useEffect(() => {
    // Save to local storage
    StorageService.save(stats);
    
    // Save to cloud if logged in
    if (user) {
        // Debounce could be added here for performance, but for now safe to save
        StorageService.saveToCloud(user.uid, stats);
    }
  }, [stats, user]);
  
  // Set body background color to avoid flashes
  useEffect(() => {
    document.body.style.backgroundColor = stats.theme === 'dark' ? '#0a0a0a' : '#f0f2f5';
  }, [stats.theme]);

  const handleComplete = (xp: number, passed: boolean, maxXP: number, id?: number) => {
    setStats(prev => {
      let nextStats = { ...prev };
      
      // Update XP & Level
      nextStats.xp += xp;
      nextStats.level = Math.floor(nextStats.xp / 500) + 1;

      // Handle Pass/Fail Hearts Logic
      if (!passed) {
          nextStats.hearts = Math.max(0, nextStats.hearts - 1);
      }

      // Unlock next challenge if not Dojo or Practice AND if passed
      if (id && passed) {
        const currentHighScore = nextStats.highScores[id] || 0;
        if (xp > currentHighScore) {
             nextStats.highScores = { ...nextStats.highScores, [id]: xp };
        }

        // Logic adjusted for new sequential ID system (exams included)
        // Check if next ID exists in curriculum
        const nextId = id + 1;
        const exists = CURRICULUM.some(c => c.id === nextId);
        
        if (exists && !nextStats.unlockedChallenges.includes(nextId)) {
          nextStats.unlockedChallenges = [...nextStats.unlockedChallenges, nextId];
        }
      } else {
        if (passed) {
            nextStats = StorageService.updateStreak(nextStats);
        }
      }

      return nextStats;
    });
    
    // Navigate back logic
    if (id) {
       // If it was an exam, maybe go to Exam Selector or Level Selector?
       const challenge = CURRICULUM.find(c => c.id === id);
       if (challenge?.isExam) {
           window.location.hash = '/exam';
       } else {
           window.location.hash = `/level/${challenge?.level}`;
       }
    } else {
       window.location.hash = '/';
    }
  };

  const handleUpdateHeatmap = (interval: number, correct: boolean) => {
    setStats(prev => {
      const newHeatmap = [...prev.heatmap];
      newHeatmap[interval] = Math.min(1, Math.max(0, newHeatmap[interval] + (correct ? 0.05 : -0.1)));
      return { ...prev, heatmap: newHeatmap };
    });
  };

  const handleReset = () => {
    const fresh = StorageService.reset();
    setStats(fresh);
    setIsSettingsOpen(false);
  };
  
  const handleToggleTheme = () => {
    setStats(prev => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  };
  
  const themeStyles = {
    '--bg-main': stats.theme === 'dark' ? '#0a0a0a' : '#f0f2f5',
    '--text-main': stats.theme === 'dark' ? '#ffffff' : '#111827',
    '--text-muted': stats.theme === 'dark' ? '#9ca3af' : '#6b7280',
    '--bg-card': stats.theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
    '--bg-card-hover': stats.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
    '--border-color': stats.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties;

  return (
    <div 
      className="h-screen w-full max-w-md mx-auto relative shadow-2xl overflow-hidden bg-[var(--bg-main)] border-x border-[var(--border-color)] transition-colors duration-300"
      style={themeStyles}
    >
      <HashRouter>
        <AppContent 
          stats={stats} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          handleComplete={handleComplete}
          handleUpdateHeatmap={handleUpdateHeatmap}
          onToggleTheme={handleToggleTheme}
        />
      </HashRouter>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onReset={handleReset} 
        onToggleTheme={handleToggleTheme}
        stats={stats}
        user={user} 
      />

      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-left { animation: slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        
        @keyframes gentle-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 0 #00AA88; }
          50% { transform: scale(1.02); box-shadow: 0 12px 20px rgba(0, 255, 204, 0.4), 0 8px 0 #00AA88; }
        }
        .animate-gentle-pulse { animation: gentle-pulse 2s infinite ease-in-out; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;