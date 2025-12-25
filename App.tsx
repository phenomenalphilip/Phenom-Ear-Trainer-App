import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { signInWithPopup, signOut, onAuthStateChanged, User, AuthError } from 'firebase/auth';
import { auth, googleProvider, firebaseConfig } from './services/firebase';

import Piano from './components/Piano';
import Heatmap from './components/Heatmap';
import { UserStats, GameState, Question, DifficultyLevel, Challenge } from './types';
import { COLORS, OwlMascot, INTERVAL_NAMES, OCTAVE_NOTES } from './constants';
import { audioEngine } from './services/audioEngine';
import { generateCurriculum } from './services/curriculum';
import { StorageService } from './services/storage';

const CURRICULUM = generateCurriculum();

const SOLFEGE_MAP = ['Doh', 'Di', 'Re', 'Ri', 'Mi', 'Fah', 'Fi', 'Soh', 'Zi', 'la', 'Toh', 'Ti'];

const getNoteName = (midi: number) => OCTAVE_NOTES[midi % 12];
const getSolfege = (midi: number, root: number) => {
    const interval = ((midi - root) % 12 + 12) % 12;
    return SOLFEGE_MAP[interval];
};

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
    return { keyCenter, targetMelody: melody, description: useWeak ? "Weak Spot Training" : "Daily Warmup" };
  });
};

const generatePracticeQuestions = (difficulty: string, stats: UserStats, count: number = 10, forceWeakSpots: boolean = false): Question[] => {
  const weakSpots = getWeakSpots(stats.heatmap);
  let basePool: number[];
  let sequenceLength: number;
  let octaveRange: number;

  switch (difficulty) {
    case DifficultyLevel.MASTER:
      basePool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      sequenceLength = 5;
      octaveRange = 2;
      break;
    case DifficultyLevel.INTERMEDIATE:
      basePool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
      sequenceLength = 3;
      octaveRange = 1.5;
      break;
    case DifficultyLevel.BEGINNER:
    default:
      basePool = [0, 2, 4, 5, 7, 9, 11];
      sequenceLength = 1;
      octaveRange = 1;
      break;
  }

  let activePool = basePool;
  if (forceWeakSpots) {
    const intersection = basePool.filter(n => weakSpots.includes(n));
    if (intersection.length > 0) activePool = intersection;
  }

  return Array.from({ length: count }).map(() => {
    const keyCenter = (difficulty === DifficultyLevel.BEGINNER) ? 60 : Math.floor(Math.random() * 12) + 54;
    const melody: number[] = [];
    for (let i = 0; i < sequenceLength; i++) {
      const interval = activePool[Math.floor(Math.random() * activePool.length)];
      let note = keyCenter + interval;
      if (octaveRange > 1) {
         const shift = Math.floor(Math.random() * (octaveRange * 2)) - Math.floor(octaveRange);
         note += shift * 12;
      }
      melody.push(note);
    }
    return { keyCenter, targetMelody: melody, description: forceWeakSpots ? "Targeting Weakness" : `${difficulty} Practice` };
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

const MenuButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} className="absolute top-4 right-4 sm:top-6 sm:right-6 z-40 w-10 h-10 flex flex-col justify-center items-end gap-1.5 group cursor-pointer p-2">
    <div className="w-6 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors"></div>
    <div className="w-4 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors group-hover:w-6 duration-300"></div>
    <div className="w-5 h-0.5 bg-gray-500 group-hover:bg-[var(--text-main)] transition-colors group-hover:w-6 duration-200"></div>
  </button>
);

const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void; onOpenSettings: () => void; stats: UserStats }> = ({ isOpen, onClose, onOpenSettings, stats }) => {
  const navigate = useNavigate();
  const handleNav = (path: string) => { navigate(path); onClose(); };
  const handleSettings = () => { onOpenSettings(); onClose(); };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute top-0 right-0 bottom-0 w-3/4 max-w-xs bg-[var(--bg-main)] border-l border-[var(--border-color)] p-6 shadow-2xl animate-slide-left flex flex-col justify-between">
        <div>
          <div className="flex justify-end mb-8"><button onClick={onClose} className="text-[var(--text-muted)] text-2xl">✕</button></div>
          <div className="mb-10 pl-2 border-l-2 border-[#00FFCC]"><h2 className="text-2xl font-black text-[var(--text-main)] italic">PHENOM</h2></div>
          <nav className="flex flex-col gap-6">
            <button onClick={() => handleNav('/')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">HOME</button>
            <button onClick={() => handleNav('/dojo')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">DAILY DOJO</button>
            <button onClick={() => handleNav('/practice')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">PRACTICE MODE</button>
            <button onClick={() => handleNav('/exam')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">EXAM MODE</button>
            <button onClick={() => handleNav('/levels')} className="text-left text-xl font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all">EXERCISES</button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onReset: () => void; onToggleTheme: () => void; stats: UserStats; user: User | null; }> = ({ isOpen, onClose, onReset, onToggleTheme, stats, user }) => {
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const handleLogin = async () => {
     setIsAuthLoading(true);
     try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); } finally { setIsAuthLoading(false); }
  };
  const handleLogout = async () => { try { await signOut(auth); onReset(); } catch (error) { console.error(error); } };
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
        <h2 className="text-2xl font-black text-[var(--text-main)] italic mb-6">SETTINGS</h2>
        <div className="mb-6 p-4 bg-[var(--bg-card)] rounded-xl">
            {user ? (
                <div className="flex flex-col gap-3">
                   <div className="text-sm font-bold text-[var(--text-main)]">{user.displayName}</div>
                   <button onClick={handleLogout} className="w-full py-2 bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg text-xs font-black uppercase">Sign Out</button>
                </div>
            ) : (
                <button onClick={handleLogin} disabled={isAuthLoading} className="w-full py-2 sm:py-3 text-white rounded-xl text-sm font-bold bg-[#4285F4]">{isAuthLoading ? "Connecting..." : "Sign in with Google"}</button>
            )}
        </div>
        <button onClick={onReset} className="w-full bg-red-500/10 border border-red-500/50 text-red-500 py-4 rounded-xl font-bold mb-4">RESET PROGRESS</button>
        <button onClick={onClose} className="w-full bg-[var(--bg-card)] text-[var(--text-main)] border border-[var(--border-color)] py-4 rounded-xl font-bold">CLOSE</button>
      </div>
    </div>
  );
};

const SessionSummary: React.FC<{ xp: number; accuracy: number; passed: boolean; maxXP: number; onContinue: () => void; isExam?: boolean; totalXP: number }> = ({ xp, accuracy, passed, maxXP, onContinue, isExam, totalXP }) => (
    <div className="flex flex-col h-full bg-[var(--bg-main)] items-center justify-center p-6 animate-fade-in relative overflow-hidden">
      <OwlMascot state={passed ? "success" : "fail"} className="w-24 h-24 sm:w-40 sm:h-40 mb-6" />
      <h2 className={`text-2xl font-black italic mb-6 text-center ${passed ? 'text-[#FFD700]' : 'text-red-500'}`}>{passed ? "Session Cleared!" : "Session Failed"}</h2>
      <div className="grid grid-cols-2 gap-4 w-full mb-8">
           <div className="bg-[var(--bg-card)] border border-yellow-500/30 rounded-2xl p-4 flex flex-col items-center">
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">TOTAL XP</div>
              <div className="flex items-center text-[var(--text-main)]"><span className="text-2xl font-black">{totalXP}</span></div>
           </div>
           <div className="bg-[var(--bg-card)] border border-[#00FFCC]/30 rounded-2xl p-4 flex flex-col items-center">
              <div className="text-[10px] font-black text-[#00FFCC] uppercase tracking-widest mb-1">PASS REQ.</div>
              <div className="flex items-center text-[var(--text-main)]"><span className="text-2xl font-black">{Math.floor(maxXP * 0.8)}</span></div>
           </div>
      </div>
      <button onClick={onContinue} className={`w-full font-black text-xl py-4 rounded-2xl transition-all ${passed ? 'bg-[#00FFCC] text-black' : 'bg-[var(--bg-card)] text-[var(--text-main)]'}`}>CONTINUE</button>
    </div>
);

const WelcomeScreen: React.FC<{ stats: UserStats, onOpenSettings: () => void }> = ({ stats, onOpenSettings }) => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 sm:p-8 items-center justify-between py-6">
      <div className="flex flex-col items-center w-full">
        <div className="flex justify-between w-full mb-4 bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border-color)]">
            <div className="flex flex-col items-center"><span className="text-[10px] text-[var(--text-muted)] font-black">XP</span><span className="text-[#00FFCC] font-bold text-lg">{stats.xp}</span></div>
            <div className="flex flex-col items-center"><span className="text-[10px] text-[var(--text-muted)] font-black">Level</span><span className="text-blue-400 font-bold text-lg">{stats.level}</span></div>
            <div className="flex flex-col items-center"><span className="text-[10px] text-[var(--text-muted)] font-black">Lives</span><span className="text-red-500 font-bold text-lg">❤️ {stats.hearts}</span></div>
        </div>
        <div className="mb-4 relative"><OwlMascot className="w-24 h-24 sm:w-48 sm:h-48" /></div>
        <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter text-[var(--text-main)] mb-1">PHENOM</h1>
        <p className="text-[var(--text-muted)] font-bold uppercase tracking-[0.4em] text-[10px] mb-8">The Elite Ear Dojo</p>
      </div>
      <div className="w-full flex flex-col gap-3 mb-4">
        <button onClick={() => navigate('/dojo')} className="w-full bg-[#00FFCC] py-4 rounded-3xl font-black text-xl text-[#0a0a0a] shadow-[0_6px_0_#00AA88]">DAILY DOJO</button>
        <button onClick={() => navigate(`/play/${Math.max(...stats.unlockedChallenges)}`)} className="w-full bg-blue-600/10 border border-blue-500/50 py-4 rounded-3xl font-black text-xl text-blue-500">CONTINUE EXERCISES</button>
      </div>
    </div>
  );
};

const PracticeSelector: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 pt-16">
      <div className="flex items-center mb-6"><button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button><h2 className="text-2xl font-black italic">Practice Mode</h2></div>
      <div className="grid grid-cols-1 gap-4">
        {[DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER].map(lvl => (
          <button key={lvl} onClick={() => navigate(`/practice/${lvl}`)} className="p-6 rounded-[2rem] bg-[var(--bg-card)] border border-[var(--border-color)] text-left">
            <div className="text-2xl font-black italic uppercase text-[var(--text-main)]">{lvl}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ExamSelector: React.FC<{ stats: UserStats }> = ({ stats }) => {
  const navigate = useNavigate();
  const examIds = useMemo(() => {
    const ids: Record<string, number> = {};
    [DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER].forEach(l => {
        const exam = CURRICULUM.find(c => c.level === l && c.isExam);
        if (exam) ids[l] = exam.id;
    });
    return ids;
  }, []);
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 pt-16">
      <div className="flex items-center mb-6"><button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button><h2 className="text-2xl font-black italic">Exam Mode</h2></div>
      <div className="grid grid-cols-1 gap-4">
        {[DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER].map(lvl => (
          <button key={lvl} onClick={() => examIds[lvl] && navigate(`/play/${examIds[lvl]}`)} className="p-6 rounded-[2rem] bg-[var(--bg-card)] border border-[var(--border-color)] text-left">
            <div className="text-2xl font-black italic text-[var(--text-main)]">{lvl} EXAM</div>
          </button>
        ))}
      </div>
    </div>
  );
};

const LevelSelector: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] p-4 pt-16">
      <div className="flex items-center mb-6"><button onClick={() => navigate('/')} className="text-[var(--text-muted)] mr-4 text-2xl">←</button><h2 className="text-2xl font-black italic">Select Level</h2></div>
      <div className="grid grid-cols-1 gap-4">
        {[DifficultyLevel.BEGINNER, DifficultyLevel.INTERMEDIATE, DifficultyLevel.MASTER].map(lvl => (
          <button key={lvl} onClick={() => navigate(`/level/${lvl}`)} className="p-6 rounded-[2rem] bg-[var(--bg-card)] border border-[var(--border-color)] text-left">
            <div className="text-2xl font-black italic text-[var(--text-main)]">{lvl}</div>
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
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--bg-main)] sticky top-0 z-10">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate('/levels')} className="text-[var(--text-muted)] text-2xl">←</button>
          <h2 className="text-xl font-black italic uppercase">{level}</h2>
          <div className="w-8"></div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredChallenges.map((c) => {
          const isUnlocked = stats.unlockedChallenges.includes(c.id);
          return (
            <button key={c.id} disabled={!isUnlocked} onClick={() => navigate(`/play/${c.id}`)} className={`w-full flex items-center p-3 rounded-2xl border transition-all ${isUnlocked ? 'bg-[var(--bg-card)] border-[var(--border-color)]' : 'opacity-30 grayscale'}`}>
              <div className="flex-1 text-left"><div className="font-bold text-sm text-[var(--text-main)]">{c.title}</div><div className="text-[var(--text-muted)] text-[10px] uppercase font-black">{c.subtitle}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface GameSessionProps {
  stats: UserStats;
  onComplete: (result: { xp: number, passed: boolean, maxXP: number, accuracy: number, challengeId?: number, mode: 'CHALLENGE' | 'PRACTICE' | 'DOJO' | 'EXAM', difficulty?: string }) => void;
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
    lives: stats.hearts,
    xpGained: 0,
    isDailyDojo,
    challengeId: Number(challengeId)
  });
  const [userInput, setUserInput] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong' | null, userSequence?: number[], targetSequence?: number[] }>({ type: null });
  const [isAnswering, setIsAnswering] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);

  useEffect(() => {
    let qs: Question[];
    if (isPracticeMode && difficulty) qs = generatePracticeQuestions(difficulty, stats, 10, false);
    else if (isDailyDojo) qs = generateDojoQuestions(stats, 10, false);
    else if (challenge) qs = generateChallengeQuestions(challenge);
    else qs = [];
    setGameState(prev => ({ ...prev, questions: qs, currentQuestionIndex: 0 }));
  }, [challenge, isDailyDojo, isPracticeMode, difficulty]);

  const playChallenge = async () => {
    if (gameState.questions.length === 0) return;
    const q = gameState.questions[gameState.currentQuestionIndex];
    setIsAnswering(false);
    setUserInput([]);
    setFeedback({ type: null });
    setCanAdvance(false);
    setHasAttempted(false);
    setShowOverlay(false);
    
    await audioEngine.playCadence(q.keyCenter);
    const bpm = (challenge?.level === DifficultyLevel.MASTER || difficulty === DifficultyLevel.MASTER) ? 140 : 100;
    await audioEngine.playMelody(q.targetMelody, bpm);
    setIsAnswering(true);
  };

  useEffect(() => {
    if (gameState.questions.length > 0 && !showSummary) playChallenge();
  }, [gameState.currentQuestionIndex, gameState.questions, showSummary]);

  const handleNoteClick = (midi: number) => {
    audioEngine.playNote(midi, 0.4);
    if (!isAnswering || canAdvance) return; 
    const q = gameState.questions[gameState.currentQuestionIndex];
    if (userInput.length < q.targetMelody.length) setUserInput(prev => [...prev, midi]);
  };

  const handleCheckSequence = async () => {
     const q = gameState.questions[gameState.currentQuestionIndex];
     const isCorrect = JSON.stringify(userInput) === JSON.stringify(q.targetMelody);
     if (isCorrect) {
         setFeedback({ type: 'correct' });
         if (!hasAttempted) setGameState(p => ({ ...p, xpGained: p.xpGained + (10 * q.targetMelody.length) }));
         setCanAdvance(true); 
         setHasAttempted(true);
         q.targetMelody.forEach(note => onUpdateHeatmap((note - q.keyCenter + 12) % 12, true));
     } else {
         setMistakes(prev => prev + 1);
         setFeedback({ type: 'wrong', userSequence: userInput, targetSequence: q.targetMelody });
         setShowOverlay(true);
         q.targetMelody.forEach(note => onUpdateHeatmap((note - q.keyCenter + 12) % 12, false));
         await audioEngine.playMelody(userInput, 180);
         await audioEngine.playMelody(q.targetMelody, 120);
     }
  };

  const handleNext = () => {
      if (gameState.currentQuestionIndex < gameState.questions.length - 1) {
        setGameState(p => ({ ...p, currentQuestionIndex: p.currentQuestionIndex + 1 }));
      } else {
        setShowSummary(true);
      }
  };
  
  const handleSummaryContinue = () => {
    const maxPotentialXP = gameState.questions.reduce((acc, q) => acc + (10 * q.targetMelody.length), 0);
    const sessionMode: 'CHALLENGE' | 'PRACTICE' | 'DOJO' | 'EXAM' = isExam ? 'EXAM' : isDailyDojo ? 'DOJO' : (isPracticeMode ? 'PRACTICE' : 'CHALLENGE');
    onComplete({ xp: gameState.xpGained, passed: gameState.xpGained >= (maxPotentialXP * 0.8), maxXP: maxPotentialXP, accuracy: 100, challengeId: challenge?.id, mode: sessionMode, difficulty });
  };

  const currentQ = gameState.questions[gameState.currentQuestionIndex];
  if (showSummary) return <SessionSummary xp={gameState.xpGained} accuracy={100} passed={gameState.xpGained >= (gameState.questions.reduce((a,q)=>a+(10*q.targetMelody.length),0) * 0.8)} maxXP={gameState.questions.reduce((a,q)=>a+(10*q.targetMelody.length),0)} onContinue={handleSummaryContinue} isExam={isExam} totalXP={stats.xp + gameState.xpGained} />;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-main)] overflow-hidden">
      <div className="px-4 pt-4 pb-2 border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <button onClick={() => navigate('/')} className="text-[var(--text-muted)] text-xl mr-4">✕</button>
            <div className="w-48 h-2 bg-[var(--bg-card)] rounded-full overflow-hidden"><div className="h-full bg-[#00FFCC]" style={{ width: `${(gameState.currentQuestionIndex / gameState.questions.length) * 100}%` }} /></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[#00FFCC] font-black text-xs">XP {stats.xp + gameState.xpGained}</div>
             <div className="text-red-500 font-black text-xs">❤️ {stats.hearts}</div>
          </div>
        </div>
        <div className="flex justify-between items-end">
            <div>
                <div className="text-[var(--text-main)] font-black text-xs uppercase tracking-tight">{isDailyDojo ? 'Daily Dojo' : isPracticeMode ? `${difficulty} Practice` : challenge?.title}</div>
                <div className="text-[var(--text-muted)] font-bold text-[10px]">Target: {currentQ?.targetMelody.length} note(s)</div>
            </div>
            <button onClick={() => playChallenge()} className="text-[var(--text-muted)] font-black text-[10px] tracking-widest bg-[var(--bg-card)] px-3 py-1.5 rounded-full hover:bg-[var(--bg-card-hover)]">REPEAT</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <div className="flex gap-2 mb-8">
            {currentQ?.targetMelody.map((_, i) => <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center font-bold text-sm ${userInput.length > i ? 'bg-[#00FFCC] border-[#00FFCC] text-black shadow-[0_0_15px_rgba(0,255,204,0.4)]' : 'bg-transparent border-[var(--border-color)]'}`}>{userInput.length > i ? getSolfege(userInput[i], currentQ.keyCenter) : ''}</div>)}
        </div>
        <OwlMascot state={feedback.type === 'correct' ? 'success' : feedback.type === 'wrong' ? 'fail' : 'idle'} className="w-24 h-24 mb-6" />
        <div className="h-14 w-full max-w-xs flex gap-3">
            {!canAdvance ? (
                <>
                    <button onClick={() => setUserInput(prev => prev.slice(0, -1))} disabled={userInput.length === 0} className="w-16 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] flex items-center justify-center rounded-xl">⌫</button>
                    <button onClick={handleCheckSequence} disabled={userInput.length !== currentQ?.targetMelody.length} className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] font-black rounded-xl disabled:opacity-30">CHECK</button>
                </>
            ) : (
                <button onClick={handleNext} className="w-full bg-blue-500 text-white font-black rounded-xl">NEXT →</button>
            )}
        </div>
      </div>
      <Piano onNoteClick={handleNoteClick} rootNote={currentQ?.keyCenter || 60} highlightedNote={userInput[userInput.length - 1]} theme={stats.theme} />
      {showOverlay && (
        <div className="absolute inset-x-0 bottom-0 z-50 bg-[var(--bg-main)] rounded-t-3xl border-t-4 border-red-500 p-6 animate-slide-up shadow-2xl">
          <h3 className="text-red-500 font-black text-2xl italic mb-4">MISSED IT</h3>
          <div className="flex gap-3">
            <button onClick={() => { setShowOverlay(false); setUserInput([]); setIsAnswering(true); }} className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] py-3 rounded-2xl font-black">RETRY</button>
            <button onClick={() => { setShowOverlay(false); handleNext(); }} className="flex-1 bg-red-600 py-3 rounded-2xl font-black text-white">NEXT</button>
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC<{ 
  stats: UserStats; 
  onOpenSettings: () => void; 
  handleComplete: (result: { xp: number, passed: boolean, maxXP: number, accuracy: number, challengeId?: number, mode: 'CHALLENGE' | 'PRACTICE' | 'DOJO' | 'EXAM', difficulty?: string }) => void; 
  handleUpdateHeatmap: (interval: number, correct: boolean) => void;
  onToggleTheme: () => void;
}> = ({ stats, onOpenSettings, handleComplete, handleUpdateHeatmap, onToggleTheme }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const isGameSession = location.pathname.startsWith('/play') || location.pathname.startsWith('/dojo') || location.pathname.startsWith('/practice/');
  useEffect(() => setIsMenuOpen(false), [location]);
  return (
    <>
      {!isGameSession && <MenuButton onClick={() => setIsMenuOpen(true)} />}
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onOpenSettings={onOpenSettings} stats={stats} />
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const syncedStats = await StorageService.syncWithCloud(currentUser, stats);
        setStats(syncedStats);
      } else {
        setStats(StorageService.load());
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleComplete = async (result: { xp: number, passed: boolean, maxXP: number, accuracy: number, challengeId?: number, mode: 'CHALLENGE' | 'PRACTICE' | 'DOJO' | 'EXAM', difficulty?: string }) => {
    const { xp, passed, challengeId } = result;
    const newStats = { ...stats };
    newStats.xp += xp;
    newStats.level = Math.floor(newStats.xp / 500) + 1;
    if (challengeId && passed) {
        newStats.highScores = { ...newStats.highScores, [challengeId]: Math.max(newStats.highScores[challengeId] || 0, xp) };
        const nextId = challengeId + 1;
        if (CURRICULUM.some(c => c.id === nextId) && !newStats.unlockedChallenges.includes(nextId)) {
          newStats.unlockedChallenges = [...newStats.unlockedChallenges, nextId];
        }
    }
    setStats(newStats);
    StorageService.save(newStats);
    if (user) {
        await StorageService.saveToCloud(user, newStats);
        StorageService.logSession(user, { ...result, xpEarned: xp });
    }
    window.location.hash = '/';
  };

  const handleUpdateHeatmap = (interval: number, correct: boolean) => {
    setStats(prev => {
      const h = [...prev.heatmap];
      h[interval] = Math.min(1, Math.max(0, h[interval] + (correct ? 0.05 : -0.1)));
      return { ...prev, heatmap: h };
    });
  };

  const handleReset = () => {
    const fresh = StorageService.reset();
    setStats(fresh);
    setIsSettingsOpen(false);
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
    <div className="h-[100dvh] w-full max-w-md mx-auto relative shadow-2xl overflow-hidden bg-[var(--bg-main)] border-x border-[var(--border-color)]" style={themeStyles}>
      <HashRouter>
        <AppContent stats={stats} onOpenSettings={() => setIsSettingsOpen(true)} handleComplete={handleComplete} handleUpdateHeatmap={handleUpdateHeatmap} onToggleTheme={() => setStats({...stats, theme: stats.theme === 'dark' ? 'light' : 'dark'})} />
      </HashRouter>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onReset={handleReset} onToggleTheme={() => {}} stats={stats} user={user} />
      <style>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-left { animation: slide-left 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default App;