import { db, auth } from '../config/firebase';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { CHALLENGES } from '../constants/challenges';

export const checkAndUpdateStreak = async (userData) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);

    const lastLogin = userData.lastLogin?.toDate();
    const now = new Date();

    if (!lastLogin) {
        await updateDoc(userRef, { lastLogin: serverTimestamp(), streakDays: 1 });
        return;
    }

    const diffTime = Math.abs(now - lastLogin);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        // Logged in yesterday, increment streak
        await updateDoc(userRef, {
            streakDays: increment(1),
            lastLogin: serverTimestamp()
        });
    } else if (diffDays > 1) {
        // Missed a day, reset streak
        await updateDoc(userRef, {
            streakDays: 1,
            lastLogin: serverTimestamp()
        });
    } else if (diffDays === 0 && now.getDate() !== lastLogin.getDate()) {
        // Same day but different calendar date (e.g., across midnight)
        // This is a bit tricky with simple diffDays, so let's check calendar dates
        const isYesterday = (d1, d2) => {
            const yesterday = new Date(d1);
            yesterday.setDate(d1.getDate() - 1);
            return yesterday.toDateString() === d2.toDateString();
        };

        if (isYesterday(now, lastLogin)) {
            await updateDoc(userRef, {
                streakDays: increment(1),
                lastLogin: serverTimestamp()
            });
        }
    }
};

export const getOrGenerateDailyChallenge = async (userData) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);

    const currentChallenge = userData.dailyChallenge;
    const today = new Date().toDateString();

    if (currentChallenge && currentChallenge.date === today) {
        return currentChallenge;
    }

    // Generate new challenge
    const randomIndex = Math.floor(Math.random() * CHALLENGES.length);
    const challengeTemplate = CHALLENGES[randomIndex];

    const newChallenge = {
        ...challengeTemplate,
        progress: 0,
        completed: false,
        claimed: false,
        date: today
    };

    await updateDoc(userRef, { dailyChallenge: newChallenge });
    return newChallenge;
};

export const updateChallengeProgress = async (type, amount = 1) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
        console.log('UpdateChallenge: User doc not found');
        return;
    }
    const userData = userSnap.data();
    const challenge = userData.dailyChallenge;

    console.log(`Checking progress for type: ${type}. Active challenge:`, challenge?.type);

    if (!challenge || challenge.completed || challenge.type !== type) {
        console.log('UpdateChallenge: No match or already completed');
        return;
    }

    const newProgress = (challenge.progress || 0) + amount;
    const isCompleted = newProgress >= challenge.target;

    console.log(`Updating progress: ${challenge.progress} -> ${newProgress} / ${challenge.target}`);

    await updateDoc(userRef, {
        'dailyChallenge.progress': newProgress,
        'dailyChallenge.completed': isCompleted
    });
    console.log('UpdateChallenge: Success');
};

export const claimChallengeReward = async () => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;
    const userData = userSnap.data();
    const challenge = userData.dailyChallenge;

    if (!challenge || !challenge.completed || challenge.claimed) return;

    await updateDoc(userRef, {
        coins: increment(challenge.rewardCoins),
        xp: increment(challenge.rewardXP),
        'dailyChallenge.claimed': true
    });

    return {
        coins: challenge.rewardCoins,
        xp: challenge.rewardXP
    };
};
