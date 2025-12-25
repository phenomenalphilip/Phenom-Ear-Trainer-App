
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

export interface InteractionLog {
  timestamp: any; // Firestore Timestamp
  target_note_absolute: number;
  target_degree: string;
  user_input_note: number;
  user_input_degree: string;
  is_octave_error: boolean;
  latency_ms: number;
}

export interface UserStats {
  streak: number;
  xp: number;
  hearts: number;
  level: number;
  heatmap: number[];
  degreeHistory: Record<number, boolean[]>; // 0-11 -> array of last 100 results (true=correct)
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
