
import { DifficultyLevel, Challenge } from '../types';

const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const PENTASCALE = [0, 2, 4, 5, 7]; // Do Re Mi Fa So
const NON_DIATONIC = [0, 1, 3, 6, 8, 10]; // Root + Accidentals
const CHORD_TONES = [0, 3, 4, 7, 10, 11, 2]; // Root, 3rds, 5th, 7ths, 9th

export const generateCurriculum = (): Challenge[] => {
  const challenges: Challenge[] = [];
  let idCounter = 1;

  // --- LEVEL 1: BEGINNER (1-50) ---
  // Focus: Single Note Identification. Gradual accumulation of intervals.
  for (let i = 1; i <= 50; i++) {
    let pool: number[] = [];
    let title = "";
    let subtitle = "";

    if (i <= 5) {
      pool = [0, 7, 1]; // Root, 5, b2
      title = "The Anchors & The Clash";
      subtitle = "Stability vs Tension";
    } else if (i <= 10) {
      pool = [0, 7, 1, 2, 4, 3]; // + M2, M3, m3
      title = "Major/Minor Colors";
      subtitle = "Happy vs Sad Qualities";
    } else if (i <= 15) {
      pool = [0, 7, 1, 2, 4, 3, 5, 6]; // + P4, b5
      title = "Suspension & Tension";
      subtitle = "The Center of the Octave";
    } else if (i <= 20) {
      pool = [0, 7, 1, 2, 4, 3, 5, 6, 8, 9]; // + m6, M6
      title = "The Outer Rim";
      subtitle = "Wide Intervals";
    } else if (i <= 25) {
      pool = [0, 7, 1, 2, 4, 3, 5, 6, 8, 9, 10, 11]; // + m7, M7 (Full Chromatic)
      title = "The Final Resolution";
      subtitle = "Leading Tones";
    } else if (i <= 35) {
      pool = MAJOR_SCALE;
      title = "Diatonic Focus";
      subtitle = "Major Scale Only";
    } else if (i <= 45) {
      pool = NON_DIATONIC;
      title = "The Black Keys Focus";
      subtitle = "Accidentals Only";
    } else {
      pool = CHROMATIC;
      title = "Full Chromatic Graduation";
      subtitle = "Mastery Check";
    }

    challenges.push({
      id: idCounter++,
      level: DifficultyLevel.BEGINNER,
      title: `${title} ${((i - 1) % 5) + 1}`, // Recycles numbers nicely
      subtitle: subtitle,
      notePool: pool,
      sequenceLength: 1,
      octaveRange: 1,
      isModulating: false,
      chaosMode: false,
      tasksCount: 10
    });
  }

  // LEVEL 1 EXAM
  challenges.push({
    id: idCounter++,
    level: DifficultyLevel.BEGINNER,
    title: "Beginner Final Exam",
    subtitle: "Level 1 Assessment",
    notePool: CHROMATIC,
    sequenceLength: 1,
    octaveRange: 1,
    isModulating: true,
    chaosMode: false,
    tasksCount: 20,
    isExam: true
  });

  // --- LEVEL 2: INTERMEDIATE (52-101) ---
  // Focus: Melodic Sequences (3-4 notes). Range Expansion.
  for (let j = 1; j <= 50; j++) {
    // We map j (1-50) to the logic of the previous curriculum (which was 51-100)
    // Effectively i = j + 50
    const i = j + 50;
    
    let pool = CHROMATIC;
    let title = "";
    let subtitle = "";
    let range = 1;
    let len = 3;
    let isModulating = false;

    if (i <= 60) {
      pool = PENTASCALE;
      range = 0.5; // Half octave
      title = "The Pentascale";
      subtitle = "5-Note Range";
    } else if (i <= 70) {
      pool = MAJOR_SCALE;
      range = 1;
      title = "The Full Octave";
      subtitle = "Diatonic Melodies";
    } else if (i <= 80) {
      pool = CHROMATIC;
      range = 1;
      title = "Chromatic Weaving";
      subtitle = "Passing Tones";
    } else if (i <= 90) {
      pool = CHROMATIC;
      range = 1.5; // Extending Range
      len = 4;
      title = "Range Extension I";
      subtitle = "1.5 Octave Span";
    } else {
      pool = CHROMATIC;
      range = 1;
      len = 3;
      isModulating = true;
      title = "Modulation Basics";
      subtitle = "Shifting Key Centers";
    }

    challenges.push({
      id: idCounter++,
      level: DifficultyLevel.INTERMEDIATE,
      title: `${title} ${((i - 51) % 10) + 1}`,
      subtitle: subtitle,
      notePool: pool,
      sequenceLength: len,
      octaveRange: range,
      isModulating: isModulating,
      chaosMode: false,
      tasksCount: 10
    });
  }

  // LEVEL 2 EXAM
  challenges.push({
    id: idCounter++,
    level: DifficultyLevel.INTERMEDIATE,
    title: "Intermediate Final Exam",
    subtitle: "Level 2 Assessment",
    notePool: CHROMATIC,
    sequenceLength: 4,
    octaveRange: 1.5,
    isModulating: true,
    chaosMode: false,
    tasksCount: 20,
    isExam: true
  });

  // --- LEVEL 3: MASTER (103-152) ---
  // Focus: Long Sequences (4-5 notes), Wide Range (2 Octaves), Complex Harmony.
  for (let j = 1; j <= 50; j++) {
    const i = j + 100;
    
    let pool = CHROMATIC;
    let title = "";
    let subtitle = "";
    let range = 2;
    let len = 5;
    let isModulating = false;
    let chaos = false;

    if (i <= 115) {
      pool = CHORD_TONES;
      range = 1.5;
      len = 4;
      title = "Arpeggios & Leaps";
      subtitle = "Chord Tones Only";
    } else if (i <= 130) {
      pool = MAJOR_SCALE;
      range = 2; // Full 2 Octaves
      title = "The Grand Staff";
      subtitle = "2 Octave Diatonic";
    } else if (i <= 140) {
      pool = CHROMATIC;
      range = 2;
      title = "2 Octave Chromatic";
      subtitle = "Professional Standard";
    } else {
      pool = CHROMATIC;
      range = 2;
      isModulating = true;
      chaos = true;
      title = "The Phenom Gauntlet";
      subtitle = "Maximum Difficulty";
    }

    challenges.push({
      id: idCounter++,
      level: DifficultyLevel.MASTER,
      title: `${title} ${((i - 101) % 10) + 1}`,
      subtitle: subtitle,
      notePool: pool,
      sequenceLength: len,
      octaveRange: range,
      isModulating: isModulating,
      chaosMode: chaos,
      tasksCount: 10
    });
  }

  // LEVEL 3 EXAM
  challenges.push({
    id: idCounter++,
    level: DifficultyLevel.MASTER,
    title: "Master Final Exam",
    subtitle: "Level 3 Assessment",
    notePool: CHROMATIC,
    sequenceLength: 5,
    octaveRange: 2,
    isModulating: true,
    chaosMode: true,
    tasksCount: 20,
    isExam: true
  });

  return challenges;
};
