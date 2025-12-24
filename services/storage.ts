
import { UserStats } from '../types';

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
  load(): UserStats {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return INITIAL_STATS;
      
      const parsed = JSON.parse(saved);
      // Merge with initial stats to ensure new fields are present if schema changes
      const stats = { ...INITIAL_STATS, ...parsed };
      
      // Check for broken streak on load
      if (stats.lastPlayedDate) {
        const last = new Date(stats.lastPlayedDate);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - last.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        // If more than 2 days (yesterday + today buffer), streak is broken
        // Note: Simple check. For strict daily, we'd check if yesterday was played.
        // Let's rely on simple string comparison for "Yesterday" logic in update, 
        // but for display, if it's been > 48 hours, maybe reset?
        // For now, simply return stored stats, update logic handles the reset/increment.
      }
      
      return stats;
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

  // Helper to calculate new streak based on completion
  updateStreak(currentStats: UserStats): UserStats {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = currentStats.lastPlayedDate;
    
    let newStreak = currentStats.streak;

    if (lastDate === today) {
      // Already played today, no streak change
      return { ...currentStats, lastPlayedDate: today };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayString) {
      newStreak += 1;
    } else {
      newStreak = 1; // Broken streak or new start
    }

    return {
      ...currentStats,
      streak: newStreak,
      lastPlayedDate: today
    };
  }
};
