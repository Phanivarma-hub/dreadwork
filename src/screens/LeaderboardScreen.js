import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import RankBadge from '../components/RankBadge';

const LEADERBOARD_TYPES = [
    { id: 'rankPoints', label: 'RR', icon: '⚔️' },
    { id: 'level', label: 'LEVEL', icon: '✨' },
    { id: 'coins', label: 'COINS', icon: '🪙' },
];

const LeaderboardScreen = () => {
    const navigation = useNavigation();
    const [selectedType, setSelectedType] = useState('rankPoints');
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, [selectedType]);

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                orderBy(selectedType, 'desc'),
                limit(100)
            );
            const querySnapshot = await getDocs(q);
            const leaderboardData = [];
            querySnapshot.forEach((doc) => {
                leaderboardData.push({ id: doc.id, ...doc.data() });
            });
            setPlayers(leaderboardData);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderPlayer = ({ item, index }) => {
        const isTop3 = index < 3;
        const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

        return (
            <View style={[styles.playerRow, isTop3 && { borderColor: rankColors[index], borderWidth: 1 }]}>
                <View style={styles.rankContainer}>
                    {isTop3 ? (
                        <Text style={styles.medalIcon}>{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</Text>
                    ) : (
                        <Text style={styles.rankText}>{index + 1}</Text>
                    )}
                </View>

                <View style={styles.playerInfo}>
                    <Text style={styles.playerName} numberOfLines={1}>{item.username || 'Warrior'}</Text>
                    {selectedType === 'rankPoints' && (
                        <View style={styles.badgeWrapper}>
                            <RankBadge rank={item.rank} division={item.rankDivision} size="sm" />
                        </View>
                    )}
                </View>

                <View style={styles.valueContainer}>
                    <Text style={styles.valueText}>
                        {selectedType === 'rankPoints' ? `${item.rankPoints || 0} RR` :
                            selectedType === 'level' ? `LVL ${item.level || 1}` :
                                `${item.coins || 0} 🪙`}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Text style={styles.backText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>LEADERBOARD</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tags */}
                <View style={styles.tabsContainer}>
                    {LEADERBOARD_TYPES.map((type) => (
                        <TouchableOpacity
                            key={type.id}
                            style={[
                                styles.tab,
                                selectedType === type.id && styles.activeTab
                            ]}
                            onPress={() => setSelectedType(type.id)}
                        >
                            <Text style={styles.tabIcon}>{type.icon}</Text>
                            <Text style={[
                                styles.tabLabel,
                                selectedType === type.id && styles.activeTabLabel
                            ]}>
                                {type.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primaryBlue} />
                        <Text style={styles.loadingText}>Fetching Warriors...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={players}
                        renderItem={renderPlayer}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No warriors found.</Text>
                            </View>
                        }
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1, paddingTop: 10 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.lg,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    backText: {
        color: COLORS.textPrimary,
        fontSize: 32,
        fontWeight: '300',
        marginTop: -4,
    },
    title: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.lg,
        fontWeight: '900',
        letterSpacing: 2,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.bgTertiary + '40',
        paddingVertical: 12,
        borderRadius: BORDER_RADIUS.md,
        gap: 6,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    activeTab: {
        backgroundColor: COLORS.primaryBlue + '20',
        borderColor: COLORS.primaryBlue,
    },
    tabIcon: { fontSize: 16 },
    tabLabel: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
    },
    activeTabLabel: {
        color: COLORS.primaryBlue,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
        fontSize: FONT_SIZES.sm,
    },
    listContent: {
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.xl,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgSecondary,
        padding: 16,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    rankContainer: {
        width: 40,
        alignItems: 'center',
    },
    medalIcon: { fontSize: 24 },
    rankText: {
        color: COLORS.textSecondary,
        fontSize: 18,
        fontWeight: '900',
    },
    playerInfo: {
        flex: 1,
        marginLeft: 12,
    },
    playerName: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    badgeWrapper: {
        flexDirection: 'row',
        marginTop: 4,
    },
    valueContainer: {
        alignItems: 'flex-end',
    },
    valueText: {
        color: COLORS.primaryBlue,
        fontSize: 16,
        fontWeight: '800',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.md,
    },
});

export default LeaderboardScreen;
