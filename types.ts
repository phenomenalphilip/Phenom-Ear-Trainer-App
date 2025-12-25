
export enum InstrumentType {
  PIANO = 'PIANO',
  RHODES = 'RHODES',
  GUITAR = 'GUITAR'
}

export enum DifficultyLevel {
  BEGINNER = 'Beginner',
  INTERMEDIATE = 'Intermediate',
  MASTER = 'Master'
}

export interface Challenge {
  id: number;
  level: DifficultyLevel;
  title: string;
  subtitle: string;
  notePool: number[];
  sequenceLength: number;
  octaveRange: number; // 1, 1.5, or 2
  isModulating: boolean;
  chaosMode: boolean;
  tasksCount: number;
  isExam?: boolean;
}

export interface UserStats {
  streak: number;
  xp: number;
  hearts: number;
  level: number;
  heatmap: number[];
  unlockedChallenges: number[]; // Array of challenge IDs
  highScores: Record<number, number>; // Challenge ID -> Score
  lastPlayedDate: string | null; // ISO Date string YYYY-MM-DD
  theme: 'light' | 'dark';
}

export interface SessionLog {
  challengeId?: number;
  mode: 'CHALLENGE' | 'PRACTICE' | 'DOJO' | 'EXAM';
  difficulty?: string;
  xpEarned: number;
  maxXP: number;
  accuracy: number;
  passed: boolean;
  timestamp: any; // Firestore Timestamp
}

export interface Question {
  keyCenter: number;
  targetMelody: number[];
  description: string;
}

export interface GameState {
  currentQuestionIndex: number;
  questions: Question[];
  lives: number;
  xpGained: number;
  isDailyDojo: boolean;
  challengeId?: number;
}