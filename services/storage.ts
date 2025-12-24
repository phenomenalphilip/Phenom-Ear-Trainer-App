
import { UserStats } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

const STORAGE_KEY = 'phenom_user_stats_v1';

const INITIAL_STATS: UserStats = {
  streak: 0,
  xp: 0,
  hearts: 5,
  level: 1,
  heatmap: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  unlockedChallenges: [1],
  highScores: {},
  lastPlayedDate: null,
  theme: 'dark'
};

export const StorageService = {
  // --- Local Storage ---
  load(): UserStats {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return INITIAL_STATS;
      
      const parsed = JSON.parse(saved);
      return { ...INITIAL_STATS, ...parsed };
    } catch (e) {
      console.error("Failed to load stats", e);
      return INITIAL_STATS;
    }
  },

  save(stats: UserStats) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
      console.error("Failed to save stats", e);
    }
  },

  reset(): UserStats {
    localStorage.removeItem(STORAGE_KEY);
    return INITIAL_STATS;
  },

  updateStreak(currentStats: UserStats): UserStats {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = currentStats.lastPlayedDate;
    
    let newStreak = currentStats.streak;

    if (lastDate === today) {
      return { ...currentStats, lastPlayedDate: today };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayString) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }

    return {
      ...currentStats,
      streak: newStreak,
      lastPlayedDate: today
    };
  },

  // --- Cloud Storage (Firestore) ---

  /**
   * Loads data from Firestore.
   * Strategy:
   * 1. If cloud data exists, merge it with local data (taking max XP, unlocking all challenges).
   * 2. If cloud data does NOT exist, we assume this is a new cloud user and upload their current local stats.
   */
  async syncWithCloud(uid: string, localStats: UserStats): Promise<UserStats> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const cloudStats = userSnap.data() as UserStats;
        
        // MERGE STRATEGY: Combine progress
        const mergedStats: UserStats = {
            ...localStats,
            xp: Math.max(localStats.xp, cloudStats.xp),
            level: Math.max(localStats.level, cloudStats.level),
            // Combine unlocked challenges
            unlockedChallenges: Array.from(new Set([...localStats.unlockedChallenges, ...cloudStats.unlockedChallenges])),
            // Keep max high scores
            highScores: { ...localStats.highScores, ...cloudStats.highScores },
            // Heatmap: Average them out, or take the one with more data? Let's take Cloud as truth if it exists.
            heatmap: cloudStats.heatmap, 
            theme: localStats.theme, // Keep local preference
            streak: Math.max(localStats.streak, cloudStats.streak)
        };

        // Save the merged version back to both
        this.save(mergedStats);
        await setDoc(userRef, mergedStats);
        
        return mergedStats;
      } else {
        // First time cloud user: Upload local stats
        await setDoc(userRef, localStats);
        return localStats;
      }
    } catch (error) {
      console.error("Error syncing with cloud:", error);
      return localStats; // Fallback to local
    }
  },

  async saveToCloud(uid: string, stats: UserStats) {
    try {
        const userRef = doc(db, 'users', uid);
        await setDoc(userRef, stats);
    } catch (error) {
        console.error("Error saving to cloud:", error);
    }
  }
};
