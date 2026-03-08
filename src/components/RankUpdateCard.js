import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Animated,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RANK_COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { getRankFromRR, getRankBounds } from '../constants/ranks';

const { width } = Dimensions.get('window');

const RankUpdateCard = ({ oldRR, newRR, onAnimationComplete }) => {
    const oldRank = getRankFromRR(oldRR);
    const newRank = getRankFromRR(newRR);
    const oldBounds = getRankBounds(oldRR);
    const newBounds = getRankBounds(newRR);

    const progressAnim = useRef(new Animated.Value(0)).current;
    const scoreAnim = useRef(new Animated.Value(oldRR)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [displayRR, setDisplayRR] = useState(oldRR);
    const [currentRank, setCurrentRank] = useState(oldRank);

    useEffect(() => {
        // Initial fade in
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();

        // Start RR animation after a short delay
        const timer = setTimeout(() => {
            const isRankUp = newRank.rank !== oldRank.rank || newRank.rankDivision !== oldRank.rankDivision;

            // Animation for the score number
            scoreAnim.addListener(({ value }) => {
                setDisplayRR(Math.floor(value));
            });

            // If rank up happens, we might want a sequential animation
            // For now, let's just animate to the final value
            Animated.parallel([
                Animated.timing(scoreAnim, {
                    toValue: newRR,
                    duration: 2000,
                    useNativeDriver: false,
                }),
                Animated.timing(progressAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: false,
                })
            ]).start(() => {
                if (isRankUp) {
                    // Flash effect for rank up
                    Animated.sequence([
                        Animated.timing(scaleAnim, { toValue: 1.2, duration: 200, useNativeDriver: true }),
                        Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true })
                    ]).start();
                    setCurrentRank(newRank);
                }
                if (onAnimationComplete) onAnimationComplete();
            });
        }, 800);

        return () => {
            scoreAnim.removeAllListeners();
            clearTimeout(timer);
        };
    }, []);

    // Calculate progress bar width
    // We normalize the RR within the current rank bounds
    const getProgress = (rr, bounds) => {
        const total = bounds.max - bounds.min;
        const current = rr - bounds.min;
        return Math.min(1, Math.max(0, current / total));
    };

    const startProgress = getProgress(oldRR, oldBounds);
    const endProgress = getProgress(newRR, newBounds);

    const barWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [`${startProgress * 100}%`, `${endProgress * 100}%`]
    });

    const rankColor = RANK_COLORS[currentRank.rank] || COLORS.textPrimary;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            {/* Rank Title */}
            <Animated.Text style={[
                styles.rankTitle,
                { color: rankColor, transform: [{ scale: scaleAnim }] }
            ]}>
                {currentRank.rank.toUpperCase()} {currentRank.rankDivision}
            </Animated.Text>

            {/* Badge Placeholder / Icon */}
            <View style={styles.badgeContainer}>
                <LinearGradient
                    colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                    style={styles.badgeBg}
                />
                {/* Simulated Badge with Stars */}
                <View style={[styles.badge, { borderColor: rankColor }]}>
                    <View style={styles.starsRow}>
                        <Text style={styles.star}>⭐</Text>
                        <Text style={[styles.star, { fontSize: 28, marginTop: -5 }]}>⭐</Text>
                        <Text style={styles.star}>⭐</Text>
                    </View>
                    <View style={[styles.badgeBottom, { backgroundColor: rankColor + '40' }]} />
                </View>
            </View>

            {/* Score Info */}
            <View style={styles.scoreRow}>
                <View style={styles.scoreLabelContainer}>
                    <View style={styles.dot} />
                    <Text style={styles.scoreLabel}>SCORE</Text>
                </View>
                <Text style={styles.scoreValue}>
                    <Text style={{ color: COLORS.orange }}>{displayRR}</Text>
                    <Text style={{ color: COLORS.textDisabled }}> / {newBounds.max}</Text>
                </Text>
            </View>

            {/* Progress Bar Container */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBg}>
                    <Animated.View style={[
                        styles.progressBarFill,
                        { width: barWidth, backgroundColor: COLORS.dangerRed }
                    ]}>
                        <LinearGradient
                            colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={StyleSheet.absoluteFill}
                        />
                        {/* Glow Tip */}
                        <View style={styles.glowTip} />
                    </Animated.View>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        paddingVertical: 20,
    },
    rankTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: 4,
        marginBottom: 20,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    badgeContainer: {
        width: 180,
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    badgeBg: {
        position: 'absolute',
        width: 220,
        height: 220,
        transform: [{ rotate: '45deg' }],
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    badge: {
        width: 100,
        height: 120,
        backgroundColor: '#1E1E2E',
        borderWidth: 3,
        borderRadius: 10,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    starsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    star: {
        fontSize: 20,
    },
    badgeBottom: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: '30%',
    },
    scoreRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    scoreLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.orange,
        marginRight: 8,
    },
    scoreLabel: {
        color: COLORS.textSecondary,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
    },
    scoreValue: {
        fontSize: 22,
        fontWeight: '900',
    },
    progressBarContainer: {
        width: '100%',
        height: 12,
        paddingHorizontal: 5,
    },
    progressBarBg: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    glowTip: {
        position: 'absolute',
        right: -5,
        top: -5,
        bottom: -5,
        width: 10,
        backgroundColor: '#fff',
        borderRadius: 5,
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10,
    }
});

export default RankUpdateCard;
