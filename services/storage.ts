
import { UserStats, SessionLog } from '../types';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User } from 'firebase/auth';

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

  async syncWithCloud(user: User, localStats: UserStats): Promise<UserStats> {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const cloudStats = userSnap.data() as UserStats;
        
        // MERGE STRATEGY: Combine progress
        const mergedStats: UserStats = {
            ...localStats,
            xp: Math.max(localStats.xp, cloudStats.xp),
            level: Math.max(localStats.level, cloudStats.level),
            unlockedChallenges: Array.from(new Set([...localStats.unlockedChallenges, ...cloudStats.unlockedChallenges])),
            highScores: { ...localStats.highScores, ...cloudStats.highScores },
            heatmap: cloudStats.heatmap, 
            theme: localStats.theme, // Keep local preference
            streak: Math.max(localStats.streak, cloudStats.streak)
        };

        // Save the merged version back to both, including user profile info
        this.save(mergedStats);
        
        await setDoc(userRef, {
            ...mergedStats,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            lastSynced: serverTimestamp()
        }, { merge: true });
        
        return mergedStats;
      } else {
        // First time cloud user
        await setDoc(userRef, {
            ...localStats,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            lastSynced: serverTimestamp()
        });
        return localStats;
      }
    } catch (error) {
      console.error("Error syncing with cloud:", error);
      return localStats;
    }
  },

  async saveToCloud(user: User, stats: UserStats) {
    try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { 
            ...stats,
            lastSynced: serverTimestamp() 
        }, { merge: true });
    } catch (error) {
        console.error("Error saving to cloud:", error);
    }
  },

  async logSession(user: User, logData: Omit<SessionLog, 'timestamp'>) {
    try {
        const sessionsRef = collection(db, 'users', user.uid, 'sessions');
        await addDoc(sessionsRef, {
            ...logData,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging session:", error);
    }
  }
};