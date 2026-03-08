import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Animated, Easing } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import { auth, db } from '../../config/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { getXPForLevel } from '../../constants/ranks';
import { updateChallengeProgress } from '../../services/userService';
import { CHALLENGE_TYPES } from '../../constants/challenges';
import GameButton from '../../components/GameButton';

const RewardScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { score, totalQuestions, language, topic, duration } = route.params;

    const [displayXP, setDisplayXP] = useState(0);
    const [displayCoins, setDisplayCoins] = useState(0);
    const [rewards, setRewards] = useState({ xp: 0, coins: 0, bonus: false });
    const [loading, setLoading] = useState(true);
    const [levelUp, setLevelUp] = useState(false);

    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const rewardCardAnim = useRef(new Animated.Value(0)).current;
    const levelUpScale = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        calculateAndApplyRewards();

        // Entrance sequence
        Animated.sequence([
            // 1. Initial scale in
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 7,
                useNativeDriver: true,
            }),
            // 2. Staggered card appearance
            Animated.spring(rewardCardAnim, {
                toValue: 1,
                tension: 40,
                friction: 8,
                useNativeDriver: true,
            })
        ]).start();

        // Infinite rotation
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 15000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const calculateAndApplyRewards = async () => {
        const xpReward = (duration * 2) + (score * 20);
        const coinReward = (duration * 1) + (score * 10);
        const isPerfect = score === totalQuestions;

        const finalXP = isPerfect ? xpReward + 100 : xpReward;
        const finalCoins = isPerfect ? coinReward + 50 : coinReward;

        setRewards({ xp: finalXP, coins: finalCoins, bonus: isPerfect });

        // Animate counting up
        const duration_ms = 1500;
        const steps = 30;
        const xpStep = finalXP / steps;
        const coinStep = finalCoins / steps;

        let currentStep = 0;
        const interval = setInterval(() => {
            currentStep++;
            setDisplayXP(Math.floor(xpStep * currentStep));
            setDisplayCoins(Math.floor(coinStep * currentStep));

            if (currentStep >= steps) {
                setDisplayXP(finalXP);
                setDisplayCoins(finalCoins);
                clearInterval(interval);
            }
        }, duration_ms / steps);

        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                let currentXP = (userData.xp || 0) + finalXP;
                let currentLevel = userData.level || 1;
                let requiredXP = getXPForLevel(currentLevel);

                let levelGained = false;
                if (currentXP >= requiredXP) {
                    currentLevel += 1;
                    currentXP -= requiredXP;
                    levelGained = true;
                }

                await updateDoc(userRef, {
                    xp: currentXP,
                    level: currentLevel,
                    coins: (userData.coins || 0) + finalCoins,
                    studySessionsCompleted: increment(1),
                    totalStudyMinutes: increment(duration),
                    [`study_stats.${language}`]: increment(finalXP),
                });
                console.log('Rewards applied to Firestore successfully');

                // Update Challenge Progress
                await updateChallengeProgress(CHALLENGE_TYPES.STUDY_SESSION);

                if (levelGained) {
                    setLevelUp(true);
                    Animated.sequence([
                        Animated.spring(levelUpScale, {
                            toValue: 1.2,
                            tension: 100,
                            friction: 4,
                            useNativeDriver: true,
                        }),
                        Animated.spring(levelUpScale, {
                            toValue: 1,
                            tension: 40,
                            friction: 7,
                            useNativeDriver: true,
                        })
                    ]).start();
                }
            }
        } catch (error) {
            console.error('Error applying rewards:', error);
        } finally {
            setLoading(false);
        }
    };

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const rewardY = rewardCardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [50, 0],
    });

    return (
        <LinearGradient colors={theme.colors.background} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    <Animated.View style={[styles.rewardCircle, { transform: [{ scale: scaleAnim }] }]}>
                        <Animated.View style={[styles.glowRing, { transform: [{ rotate: spin }] }]}>
                            <LinearGradient
                                colors={['transparent', COLORS.primaryBlue, 'transparent']}
                                style={styles.glow}
                            />
                        </Animated.View>
                        <Text style={styles.scoreText}>{score}/{totalQuestions}</Text>
                        <Text style={styles.scoreLabel}>CORRECT</Text>
                    </Animated.View>

                    <Animated.Text style={[styles.congratsText, { opacity: scaleAnim }]}>
                        {score === 5 ? 'PERFECT SESSION!' : score >= 3 ? 'WELL DONE!' : 'KEEP IT UP!'}
                    </Animated.Text>

                    <View style={styles.rewardsContainer}>
                        <Animated.View style={[
                            styles.rewardItem,
                            { opacity: rewardCardAnim, transform: [{ translateY: rewardY }] }
                        ]}>
                            <Text style={styles.rewardValue}>+{displayXP}</Text>
                            <Text style={styles.rewardIcon}>✨</Text>
                            <Text style={styles.rewardType}>XP Gained</Text>
                        </Animated.View>
                        <Animated.View style={[
                            styles.rewardItem,
                            { opacity: rewardCardAnim, transform: [{ translateY: rewardY }] }
                        ]}>
                            <Text style={styles.rewardValue}>+{displayCoins}</Text>
                            <Text style={styles.rewardIcon}>🪙</Text>
                            <Text style={styles.rewardType}>Coins Earned</Text>
                        </Animated.View>
                    </View>

                    {levelUp && (
                        <Animated.View style={[styles.levelUpBadge, { transform: [{ scale: levelUpScale }] }]}>
                            <Text style={styles.levelUpText}>LEVEL UP!</Text>
                        </Animated.View>
                    )}

                    {rewards.bonus && (
                        <Animated.View style={[styles.bonusBadge, { opacity: rewardCardAnim }]}>
                            <Text style={styles.bonusText}>+ PERFECT BONUS</Text>
                        </Animated.View>
                    )}

                    <View style={styles.footer}>
                        <GameButton
                            title="CONTINUE"
                            onPress={() => navigation.navigate('Dashboard')}
                            style={styles.continueBtn}
                        />
                    </View>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.lg,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    rewardCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: COLORS.bgSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.primaryBlue,
        shadowColor: COLORS.primaryBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
        marginBottom: 40,
    },
    glowRing: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
        borderWidth: 2,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        borderStyle: 'dashed',
    },
    glow: {
        flex: 1,
        borderRadius: 120,
    },
    scoreText: {
        color: COLORS.textPrimary,
        fontSize: 48,
        fontWeight: '900',
    },
    scoreLabel: {
        color: COLORS.primaryBlue,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    congratsText: {
        color: COLORS.textPrimary,
        fontSize: 24,
        fontWeight: '800',
        marginBottom: 40,
        letterSpacing: 1,
    },
    rewardsContainer: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 40,
    },
    rewardItem: {
        backgroundColor: COLORS.bgTertiary + '40',
        padding: 20,
        borderRadius: 20,
        alignItems: 'center',
        width: 140,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    rewardValue: {
        color: '#FFF',
        fontSize: 24,
        fontWeight: 'bold',
    },
    rewardIcon: {
        fontSize: 24,
        marginVertical: 10,
    },
    rewardType: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: '600',
    },
    levelUpBadge: {
        backgroundColor: COLORS.successGreen,
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 10,
        marginBottom: 10,
    },
    levelUpText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    bonusBadge: {
        backgroundColor: COLORS.purpleAccent,
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 10,
    },
    bonusText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '900',
    },
    footer: {
        marginTop: 40,
        width: '100%',
    },
    continueBtn: {
        width: '100%',
    },
});

export default RewardScreen;
