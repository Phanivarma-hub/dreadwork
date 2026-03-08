import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, Easing, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RANK_COLORS } from '../../constants/theme';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, increment, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getXPForLevel, updateRankAfterMatch, calculateBRRRChange, getRankFromRR } from '../../constants/ranks';
import { updateChallengeProgress } from '../../services/userService';
import { CHALLENGE_TYPES } from '../../constants/challenges';
import GameButton from '../../components/GameButton';
import RankUpdateCard from '../../components/RankUpdateCard';
import soundService from '../../services/soundService';

const DuelResultScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const {
        playerWon, isDraw, playerScore, botScore,
        opponentName, language, matchType, userData,
    } = route.params;

    const [displayXP, setDisplayXP] = useState(0);
    const [displayRR, setDisplayRR] = useState(0);
    const [rewards, setRewards] = useState({ xp: 0, rr: 0 });
    const [levelUp, setLevelUp] = useState(false);
    const [rankChange, setRankChange] = useState(null);
    const [saving, setSaving] = useState(true);
    const [rrData, setRrData] = useState({ oldRR: 0, newRR: 0 });

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const rewardSlide = useRef(new Animated.Value(60)).current;
    const rewardFade = useRef(new Animated.Value(0)).current;
    const levelUpScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Entrance animations
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1, tension: 50, friction: 7, useNativeDriver: true,
            }),
            Animated.parallel([
                Animated.spring(rewardFade, {
                    toValue: 1, tension: 40, friction: 8, useNativeDriver: true,
                }),
                Animated.spring(rewardSlide, {
                    toValue: 0, tension: 40, friction: 8, useNativeDriver: true,
                }),
            ]),
        ]).start();

        // Background glow rotation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1, duration: 15000, easing: Easing.linear, useNativeDriver: true,
            })
        ).start();

        applyRewards();

        if (playerWon) {
            soundService.playSound('win');
        } else if (!isDraw) {
            soundService.playSound('gameover');
        }
    }, []);

    const applyRewards = async () => {
        // XP: Win = 120, Loss = 40, Draw = 80 (per SRS Section 9)
        const xpReward = playerWon ? 120 : isDraw ? 80 : 40;
        const isRanked = matchType === 'ranked';

        setRewards({ xp: xpReward, rr: 0 });

        // Animate XP counting
        const steps = 25;
        const xpStep = xpReward / steps;
        let currentStep = 0;
        const interval = setInterval(() => {
            currentStep++;
            setDisplayXP(Math.floor(xpStep * currentStep));
            if (currentStep >= steps) {
                setDisplayXP(xpReward);
                clearInterval(interval);
            }
        }, 40);

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                let currentXP = (data.xp || 0) + xpReward;
                let currentLevel = data.level || 1;
                let requiredXP = getXPForLevel(currentLevel);

                let levelGained = false;
                if (currentXP >= requiredXP) {
                    currentLevel += 1;
                    currentXP -= requiredXP;
                    levelGained = true;
                }

                const updateData = {
                    xp: currentXP,
                    level: currentLevel,
                    matchesPlayed: increment(1),
                    wins: playerWon ? increment(1) : (data.wins || 0), // Use playerWon for wins increment
                };

                // Rank update for ranked matches
                if (isRanked) {
                    const currentRR = data.rankPoints || 0;
                    const result = updateRankAfterMatch(currentRR, playerWon);
                    updateData.rankPoints = result.rankPoints;
                    updateData.rank = result.rank;
                    updateData.rankDivision = result.rankDivision;

                    setRankChange(result);
                    setRrData({ oldRR: currentRR, newRR: result.rankPoints });
                    setRewards(prev => ({ ...prev, rr: result.rrChange }));

                    // Play ranking sound
                    soundService.playSound('ranking');

                    // Check for rank up
                    if (result.rank !== data.rank || result.rankDivision !== data.rankDivision) {
                        // Only play rankup sound if it's actually an improvement or just any change as requested
                        // "Bronze 1 to Bronze 2" is a rank up in numeric terms (I is higher than II in this system?)
                        // Actually in most games I > II > III. In ranks.js: divisions: ['Bronze III', 'Bronze II', 'Bronze I']
                        // So III -> II is a rank up.
                        soundService.playSound('rankup');
                    }

                    // Animate RR counting
                    const rrAbs = Math.abs(result.rrChange);
                    let rrStep = 0;
                    const rrInterval = setInterval(() => {
                        rrStep++;
                        setDisplayRR(Math.floor((rrAbs / steps) * rrStep) * (result.rrChange > 0 ? 1 : -1));
                        if (rrStep >= steps) {
                            setDisplayRR(result.rrChange);
                            clearInterval(rrInterval);
                        }
                    }, 40);
                }

                await updateDoc(userRef, updateData);

                // Update Challenge Progress
                if (playerWon) {
                    await updateChallengeProgress(CHALLENGE_TYPES.WIN_DUELS);
                }
                await updateChallengeProgress(CHALLENGE_TYPES.PLAY_DUELS);

                // Save match to matches collection
                await addDoc(collection(db, 'matches'), {
                    player1: auth.currentUser.uid,
                    player2: opponentName,
                    winner: playerWon ? auth.currentUser.uid : opponentName,
                    topic: language,
                    player1Score: playerScore,
                    player2Score: botScore,
                    rankMatch: isRanked,
                    createdAt: serverTimestamp(),
                });

                if (levelGained) {
                    setLevelUp(true);
                    soundService.playSound('levelup');
                    Animated.sequence([
                        Animated.spring(levelUpScale, {
                            toValue: 1.3, tension: 100, friction: 4, useNativeDriver: true,
                        }),
                        Animated.spring(levelUpScale, {
                            toValue: 1, tension: 40, friction: 7, useNativeDriver: true,
                        }),
                    ]).start();
                }
            }
        } catch (error) {
            console.error('Error saving duel result:', error);
        } finally {
            setSaving(false);
        }
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const resultIcon = playerWon ? '🏆' : isDraw ? '🤝' : '💀';
    const resultTitle = playerWon ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT';
    const resultColor = playerWon ? COLORS.successGreen : isDraw ? COLORS.orange : COLORS.dangerRed;
    const isRanked = matchType === 'ranked';

    return (
        <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        {/* Result Circle */}
                        <Animated.View style={[styles.resultCircle, { transform: [{ scale: scaleAnim }], borderColor: resultColor }]}>
                            <Animated.View style={[styles.glowRing, { transform: [{ rotate: spin }] }]}>
                                <LinearGradient
                                    colors={['transparent', resultColor, 'transparent']}
                                    style={styles.glow}
                                />
                            </Animated.View>
                            <Text style={styles.resultIcon}>{resultIcon}</Text>
                        </Animated.View>

                        {/* Title */}
                        <Animated.Text style={[styles.resultTitle, { color: resultColor, opacity: scaleAnim }]}>
                            {resultTitle}
                        </Animated.Text>

                        {/* Score */}
                        <Animated.View style={[styles.scoreRow, { opacity: scaleAnim }]}>
                            <View style={styles.scoreBox}>
                                <Text style={styles.scoreBoxLabel}>You</Text>
                                <Text style={styles.scoreBoxValue}>{playerScore}</Text>
                            </View>
                            <Text style={styles.scoreSeparator}>-</Text>
                            <View style={styles.scoreBox}>
                                <Text style={styles.scoreBoxLabel}>{opponentName}</Text>
                                <Text style={styles.scoreBoxValue}>{botScore}</Text>
                            </View>
                        </Animated.View>

                        {/* Rewards */}
                        <Animated.View style={[styles.rewardsRow, { opacity: rewardFade, transform: [{ translateY: rewardSlide }] }]}>
                            <View style={styles.rewardCard}>
                                <Text style={styles.rewardValue}>+{displayXP}</Text>
                                <Text style={styles.rewardEmoji}>✨</Text>
                                <Text style={styles.rewardLabel}>XP Gained</Text>
                            </View>
                            {isRanked && (
                                <View style={styles.rewardCard}>
                                    <Text style={[
                                        styles.rewardValue,
                                        { color: rewards.rr >= 0 ? COLORS.successGreen : COLORS.dangerRed }
                                    ]}>
                                        {displayRR > 0 ? '+' : ''}{displayRR}
                                    </Text>
                                    <Text style={styles.rewardEmoji}>⚔️</Text>
                                    <Text style={styles.rewardLabel}>Rank Rating</Text>
                                </View>
                            )}
                        </Animated.View>

                        {/* Rank Update Card */}
                        {isRanked && rankChange && (
                            <RankUpdateCard
                                oldRR={rrData.oldRR}
                                newRR={rrData.newRR}
                            />
                        )}

                        {/* Level Up */}
                        {levelUp && (
                            <Animated.View style={[styles.levelUpBadge, { transform: [{ scale: levelUpScale }] }]}>
                                <Text style={styles.levelUpText}>⬆ LEVEL UP!</Text>
                            </Animated.View>
                        )}

                        {/* Match Info */}
                        <Animated.View style={[styles.matchInfo, { opacity: rewardFade }]}>
                            <Text style={styles.matchInfoText}>
                                {language.toUpperCase()} • {isRanked ? 'RANKED' : 'FRIENDLY'}
                            </Text>
                        </Animated.View>

                        {/* Continue Button */}
                        <View style={styles.footer}>
                            <GameButton
                                title="CONTINUE"
                                onPress={() => navigation.navigate('Dashboard')}
                                loading={saving}
                                style={styles.continueBtn}
                            />
                            <GameButton
                                title="PLAY AGAIN"
                                variant="secondary"
                                onPress={() => navigation.replace('DuelLobby')}
                                disabled={saving}
                                style={styles.playAgainBtn}
                            />
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: {
        flex: 1,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    scrollView: { flex: 1 },
    scrollContent: { flexGrow: 1 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingVertical: SPACING.xl },

    // Result Circle
    resultCircle: {
        width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.bgSecondary,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 3, marginBottom: 20,
        shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 25, elevation: 15,
    },
    glowRing: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed',
    },
    glow: { flex: 1, borderRadius: 100 },
    resultIcon: { fontSize: 56 },

    // Title
    resultTitle: { fontSize: 36, fontWeight: '900', letterSpacing: 4, marginBottom: 20 },

    // Score
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 30 },
    scoreBox: {
        backgroundColor: COLORS.bgSecondary, padding: 16, borderRadius: BORDER_RADIUS.md,
        alignItems: 'center', width: 100,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    scoreBoxLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    scoreBoxValue: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', marginTop: 4 },
    scoreSeparator: { color: COLORS.textDisabled, fontSize: 24, fontWeight: '300' },

    // Rewards
    rewardsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    rewardCard: {
        backgroundColor: COLORS.bgTertiary + '40', padding: 20, borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center', width: 130,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    rewardValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
    rewardEmoji: { fontSize: 22, marginVertical: 6 },
    rewardLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '600' },

    // Rank Badge
    rankBadge: {
        backgroundColor: COLORS.bgSecondary, paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: BORDER_RADIUS.full, marginBottom: 12,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    rankBadgeText: { fontSize: FONT_SIZES.sm, fontWeight: '800' },

    // Level Up
    levelUpBadge: {
        backgroundColor: COLORS.successGreen, paddingHorizontal: 20, paddingVertical: 8,
        borderRadius: BORDER_RADIUS.sm, marginBottom: 12,
    },
    levelUpText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: '900', letterSpacing: 1 },

    // Match Info
    matchInfo: { marginBottom: 20 },
    matchInfoText: { color: COLORS.textDisabled, fontSize: FONT_SIZES.xs, letterSpacing: 2 },

    // Footer
    footer: { width: '100%', gap: 10 },
    continueBtn: { width: '100%' },
    playAgainBtn: { width: '100%' },
});

export default DuelResultScreen;
