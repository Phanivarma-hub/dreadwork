import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import XPBar from '../components/XPBar';
import RankBadge from '../components/RankBadge';
import GameButton from '../components/GameButton';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RANK_COLORS } from '../constants/theme';
import { getXPForLevel } from '../constants/ranks';

const DashboardScreen = () => {
    const [userData, setUserData] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const user = auth.currentUser;

    const fetchUserData = async () => {
        if (!user) return;
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setUserData(docSnap.data());
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchUserData();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const level = userData?.level || 1;
    const currentXP = userData?.xp || 0;
    const requiredXP = getXPForLevel(level);
    const rank = userData?.rank || 'Bronze';
    const rankDivision = userData?.rankDivision || 'III';
    const coins = userData?.coins || 0;
    const streakDays = userData?.streakDays || 0;
    const username = userData?.username || user?.displayName || 'Warrior';
    const rankColor = RANK_COLORS[rank] || RANK_COLORS.Bronze;

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryBlue} />
                }
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.avatarContainer}>
                            <LinearGradient colors={COLORS.gradientBlue} style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {username.charAt(0).toUpperCase()}
                                </Text>
                            </LinearGradient>
                            <View style={[styles.onlineDot, { backgroundColor: COLORS.successGreen }]} />
                        </View>
                        <View>
                            <Text style={styles.greeting}>Welcome back,</Text>
                            <Text style={styles.username}>{username}</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <View style={styles.coinBadge}>
                            <Text style={styles.coinIcon}>🪙</Text>
                            <Text style={styles.coinText}>{coins}</Text>
                        </View>
                    </View>
                </View>

                {/* ── Rank + XP Card ── */}
                <View style={styles.card}>
                    <View style={styles.rankRow}>
                        <RankBadge rank={rank} division={rankDivision} />
                        <View style={styles.rankInfo}>
                            <Text style={styles.rankLabel}>Rank Rating</Text>
                            <Text style={[styles.rankPoints, { color: rankColor }]}>
                                {userData?.rankPoints || 0} RR
                            </Text>
                        </View>
                        <View style={styles.levelBadge}>
                            <Text style={styles.levelNumber}>{level}</Text>
                            <Text style={styles.levelLabel}>LVL</Text>
                        </View>
                    </View>
                    <View style={styles.xpSection}>
                        <XPBar currentXP={currentXP} requiredXP={requiredXP} level={level} />
                    </View>
                </View>

                {/* ── Daily Challenge Card ── */}
                <TouchableOpacity activeOpacity={0.8}>
                    <LinearGradient
                        colors={['#1E293B', '#2D3A4F']}
                        style={styles.card}
                    >
                        <View style={styles.dailyHeader}>
                            <Text style={styles.dailyIcon}>🎯</Text>
                            <View>
                                <Text style={styles.cardTitle}>Daily Challenge</Text>
                                <Text style={styles.cardSubtitle}>Win 2 duels today</Text>
                            </View>
                            <View style={styles.rewardBadge}>
                                <Text style={styles.rewardText}>+100 🪙</Text>
                            </View>
                        </View>
                        <View style={styles.dailyProgress}>
                            <View style={styles.dailyBarBg}>
                                <View style={[styles.dailyBarFill, { width: '0%' }]} />
                            </View>
                            <Text style={styles.dailyProgressText}>0 / 2</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── Streak Card ── */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statIcon}>🔥</Text>
                        <Text style={styles.statValue}>{streakDays}</Text>
                        <Text style={styles.statLabel}>Day Streak</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statIcon}>⚔️</Text>
                        <Text style={styles.statValue}>{userData?.matchesPlayed || 0}</Text>
                        <Text style={styles.statLabel}>Matches</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 1 }]}>
                        <Text style={styles.statIcon}>🏆</Text>
                        <Text style={styles.statValue}>{userData?.wins || 0}</Text>
                        <Text style={styles.statLabel}>Wins</Text>
                    </View>
                </View>

                {/* ── Quick Play Section ── */}
                <Text style={styles.sectionTitle}>Quick Play</Text>

                <TouchableOpacity activeOpacity={0.85} style={styles.modeCard}>
                    <LinearGradient
                        colors={['#1E3A5F', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modeGradient}
                    >
                        <View style={styles.modeContent}>
                            <Text style={styles.modeIcon}>📖</Text>
                            <View style={styles.modeInfo}>
                                <Text style={styles.modeTitle}>Single Player Study</Text>
                                <Text style={styles.modeDesc}>Study a topic and earn XP + Coins</Text>
                            </View>
                            <Text style={styles.modeArrow}>›</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.85} style={styles.modeCard}>
                    <LinearGradient
                        colors={['#3B1F5E', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modeGradient}
                    >
                        <View style={styles.modeContent}>
                            <Text style={styles.modeIcon}>⚔️</Text>
                            <View style={styles.modeInfo}>
                                <Text style={styles.modeTitle}>Duel Mode</Text>
                                <Text style={styles.modeDesc}>Challenge another player in real-time</Text>
                            </View>
                            <Text style={styles.modeArrow}>›</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.85} style={styles.modeCard}>
                    <LinearGradient
                        colors={['#1F3B2E', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.modeGradient}
                    >
                        <View style={styles.modeContent}>
                            <Text style={styles.modeIcon}>💀</Text>
                            <View style={styles.modeInfo}>
                                <Text style={styles.modeTitle}>Battle Royale</Text>
                                <Text style={styles.modeDesc}>10 players. One survivor. Coming soon.</Text>
                            </View>
                            <Text style={styles.modeArrow}>›</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── Events Section ── */}
                <Text style={styles.sectionTitle}>Events</Text>

                <View style={styles.card}>
                    <View style={styles.eventRow}>
                        <Text style={styles.eventIcon}>🐉</Text>
                        <View style={styles.eventInfo}>
                            <Text style={styles.eventTitle}>Raid Boss: The Compiler</Text>
                            <Text style={styles.eventSubtitle}>Starts in 2 hours • 20,000 HP</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <View style={styles.eventRow}>
                        <Text style={styles.eventIcon}>🏅</Text>
                        <View style={styles.eventInfo}>
                            <Text style={styles.eventTitle}>Season 1</Text>
                            <Text style={styles.eventSubtitle}>Climb the ranks and earn exclusive rewards</Text>
                        </View>
                    </View>
                </View>

                {/* ── Logout ── */}
                <GameButton
                    title="Logout"
                    variant="danger"
                    onPress={handleLogout}
                    style={styles.logoutBtn}
                />

                <View style={{ height: SPACING.xxl }} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    scrollContent: {
        padding: SPACING.md,
        paddingTop: SPACING.xxl + SPACING.md,
    },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.lg,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: BORDER_RADIUS.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: COLORS.bgPrimary,
    },
    greeting: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
    },
    username: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    coinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgSecondary,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
        gap: 4,
    },
    coinIcon: {
        fontSize: 16,
    },
    coinText: {
        color: '#FFD700',
        fontWeight: '700',
        fontSize: FONT_SIZES.sm,
    },

    // Cards
    card: {
        backgroundColor: COLORS.bgSecondary,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.bgTertiary + '40',
    },

    // Rank Row
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    rankInfo: {
        flex: 1,
        alignItems: 'center',
    },
    rankLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginBottom: 2,
    },
    rankPoints: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
    },
    levelBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 56,
        height: 56,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        borderColor: COLORS.primaryBlue,
        backgroundColor: COLORS.primaryBlue + '15',
    },
    levelNumber: {
        color: COLORS.primaryBlue,
        fontSize: FONT_SIZES.xl,
        fontWeight: '900',
    },
    levelLabel: {
        color: COLORS.primaryBlue,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    xpSection: {
        marginTop: SPACING.xs,
    },

    // Daily Challenge
    dailyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    dailyIcon: {
        fontSize: 28,
    },
    cardTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    cardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginTop: 2,
    },
    rewardBadge: {
        marginLeft: 'auto',
        backgroundColor: COLORS.successGreen + '20',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
    },
    rewardText: {
        color: COLORS.successGreen,
        fontWeight: '700',
        fontSize: FONT_SIZES.xs,
    },
    dailyProgress: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: SPACING.sm,
        gap: SPACING.sm,
    },
    dailyBarBg: {
        flex: 1,
        height: 6,
        backgroundColor: COLORS.bgTertiary,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
    },
    dailyBarFill: {
        height: '100%',
        backgroundColor: COLORS.primaryBlue,
        borderRadius: BORDER_RADIUS.full,
    },
    dailyProgressText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    statCard: {
        backgroundColor: COLORS.bgSecondary,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.bgTertiary + '40',
    },
    statIcon: {
        fontSize: 24,
        marginBottom: SPACING.xs,
    },
    statValue: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
    },
    statLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginTop: 2,
    },

    // Section Title
    sectionTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: '800',
        marginBottom: SPACING.sm,
        marginTop: SPACING.sm,
        letterSpacing: 0.5,
    },

    // Mode Cards
    modeCard: {
        marginBottom: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    modeGradient: {
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.bgTertiary + '40',
    },
    modeContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    modeIcon: {
        fontSize: 32,
    },
    modeInfo: {
        flex: 1,
    },
    modeTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    modeDesc: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginTop: 2,
    },
    modeArrow: {
        color: COLORS.textSecondary,
        fontSize: 28,
        fontWeight: '300',
    },

    // Events
    eventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    eventIcon: {
        fontSize: 28,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    eventSubtitle: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        marginTop: 2,
    },

    // Logout
    logoutBtn: {
        marginTop: SPACING.lg,
    },
});

export default DashboardScreen;
