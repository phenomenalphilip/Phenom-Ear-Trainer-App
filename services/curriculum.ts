
import { DifficultyLevel, Challenge } from '../types';

const CHROMATIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

export const generateCurriculum = (): Challenge[] => {
  const challenges: Challenge[] = [];

  // Level 1: BEGINNER (1-50)
  for (let i = 1; i <= 50; i++) {
    let pool: number[] = [0, 7, 1]; // 1, 5, b2
    let title = "Stability vs Tension";
    if (i > 10) { pool = [...pool, 4, 3]; title = "Color Quality"; }
    if (i > 20) { pool = [...pool, 6, 5]; title = "The Center (Tritone)"; }
    if (i > 30) { pool = [...pool, 11, 10, 2]; title = "Leading Tones"; }
    if (i > 40) { pool = CHROMATIC; title = "Full Chromatic"; }

    challenges.push({
      id: i,
      level: DifficultyLevel.BEGINNER,
      title: `${title} ${((i - 1) % 10) + 1}`,
      subtitle: i <= 10 ? "Anchors & Minor 2nd" : i <= 20 ? "Bright vs Dark" : "Expanding Spectrum",
      notePool: pool,
      sequenceLength: 1,
      octaveRange: 1,
      isModulating: false,
      chaosMode: false,
      tasksCount: 10
    });
  }

  // Level 2: INTERMEDIATE (51-100)
  for (let i = 51; i <= 100; i++) {
    let pool = CHROMATIC;
    let title = "Functional Shapes";
    let isModulating = false;
    if (i > 65) title = "Chromatic Movement";
    if (i > 80) { title = "Modulation Master"; isModulating = true; }

    challenges.push({
      id: i,
      level: DifficultyLevel.INTERMEDIATE,
      title: `${title} ${((i - 51) % 15) + 1}`,
      subtitle: i <= 65 ? "Common Melodic Words" : i <= 80 ? "Enclosures & Approaches" : "Instant Key Reset",
      notePool: pool,
      sequenceLength: 3,
      octaveRange: 1.5,
      isModulating: isModulating,
      chaosMode: false,
      tasksCount: 10
    });
  }

  // Level 3: MASTER (101-150)
  for (let i = 101; i <= 150; i++) {
    let title = "Non-Diatonic Clusters";
    let chaos = false;
    if (i > 125) { title = "Chaos Mode"; chaos = true; }

    challenges.push({
      id: i,
      level: DifficultyLevel.MASTER,
      title: `${title} ${((i - 101) % 25) + 1}`,
      subtitle: i <= 125 ? "Altered Scale Structures" : "Wide Leaps & Timbre Shuffle",
      notePool: CHROMATIC,
      sequenceLength: 5,
      octaveRange: 2,
      isModulating: true,
      chaosMode: chaos,
      tasksCount: 10
    });
  }

  return challenges;
};
