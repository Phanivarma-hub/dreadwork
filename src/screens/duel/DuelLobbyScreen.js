import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Animated,
    Easing,
    ScrollView,
    Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RANK_COLORS } from '../../constants/theme';
import { auth, db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { connectSocket, getSocket } from '../../services/socketService';
import GameButton from '../../components/GameButton';

const LANGUAGES = [
    { id: 'python', label: 'Python', icon: '🐍', gradient: ['#306998', '#1E293B'] },
    { id: 'java', label: 'Java', icon: '☕', gradient: ['#E76F00', '#1E293B'] },
    { id: 'c', label: 'C', icon: '⚙️', gradient: ['#555555', '#1E293B'] },
];

const DuelLobbyScreen = () => {
    const navigation = useNavigation();
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [matchType, setMatchType] = useState('ranked');
    const [searching, setSearching] = useState(false);
    const [userData, setUserData] = useState(null);
    const [queuePosition, setQueuePosition] = useState(null);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchUserData();
    }, []);

    // Socket event listeners
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onQueueJoined = (data) => {
            setQueuePosition(data.position);
        };

        const onMatchFound = (data) => {
            const { roomId, opponent, topic, matchType: mType } = data;
            navigation.replace('DuelBattle', {
                roomId,
                language: topic,
                matchType: mType,
                opponentName: opponent.username,
                opponentRank: opponent.rank,
                userData,
            });
        };

        const onError = (data) => {
            Alert.alert('Error', data.message);
            setSearching(false);
        };

        socket.on('queueJoined', onQueueJoined);
        socket.on('matchFound', onMatchFound);
        socket.on('error', onError);

        return () => {
            socket.off('queueJoined', onQueueJoined);
            socket.off('matchFound', onMatchFound);
            socket.off('error', onError);
        };
    }, [userData]);

    const fetchUserData = async () => {
        if (!auth.currentUser) return;
        try {
            const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (docSnap.exists()) {
                const data = { ...docSnap.data(), uid: auth.currentUser.uid };
                setUserData(data);
                // Connect to socket server and register
                connectSocket(data);
            }
        } catch (err) {
            console.error('Error fetching user data:', err);
        }
    };

    const startSearching = () => {
        if (!selectedLanguage || !userData) return;
        setSearching(true);

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();

        // Spin animation
        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true,
            })
        ).start();

        // Emit joinQueue to server
        const socket = getSocket();
        socket.emit('joinQueue', {
            userId: auth.currentUser.uid,
            username: userData.username || 'Player',
            rank: userData.rank || 'Bronze',
            topic: selectedLanguage,
            matchType,
        });
    };

    const cancelSearch = () => {
        setSearching(false);
        const socket = getSocket();
        socket.emit('leaveQueue', { topic: selectedLanguage });
    };

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const rank = userData?.rank || 'Bronze';
    const rankColor = RANK_COLORS[rank] || RANK_COLORS.Bronze;
    const equippedSword = userData?.equippedSword || 'None';

    return (
        <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { cancelSearch(); navigation.goBack(); }} style={styles.backBtn}>
                        <Text style={styles.backText}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>⚔️ DUEL MODE</Text>
                    <View style={{ width: 60 }} />
                </View>

                {searching ? (
                    /* ── Matchmaking Animation ── */
                    <View style={styles.searchingContainer}>
                        <Animated.View style={[styles.searchRing, { transform: [{ scale: pulseAnim }] }]}>
                            <Animated.View style={[styles.searchSpinner, { transform: [{ rotate: spin }] }]} />
                            <Text style={styles.searchIcon}>⚔️</Text>
                        </Animated.View>
                        <Text style={styles.searchTitle}>SEARCHING FOR OPPONENT</Text>
                        <Text style={styles.searchSubtitle}>
                            {selectedLanguage?.toUpperCase()} • {matchType === 'ranked' ? 'RANKED' : 'FRIENDLY'}
                        </Text>
                        {queuePosition && (
                            <Text style={styles.queueText}>
                                {queuePosition === 1 ? 'Waiting for another player...' : `Position in queue: ${queuePosition}`}
                            </Text>
                        )}
                        <TouchableOpacity style={styles.cancelBtn} onPress={cancelSearch}>
                            <Text style={styles.cancelText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* ── Lobby Content ── */
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Language Selection */}
                        <Text style={styles.sectionLabel}>CHOOSE LANGUAGE</Text>
                        <View style={styles.languageGrid}>
                            {LANGUAGES.map((lang) => (
                                <TouchableOpacity
                                    key={lang.id}
                                    activeOpacity={0.8}
                                    onPress={() => setSelectedLanguage(lang.id)}
                                >
                                    <LinearGradient
                                        colors={lang.gradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={[
                                            styles.langCard,
                                            selectedLanguage === lang.id && styles.langCardSelected,
                                        ]}
                                    >
                                        <Text style={styles.langIcon}>{lang.icon}</Text>
                                        <Text style={styles.langLabel}>{lang.label}</Text>
                                        {selectedLanguage === lang.id && (
                                            <View style={styles.checkBadge}>
                                                <Text style={styles.checkText}>✓</Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Match Type */}
                        <Text style={styles.sectionLabel}>MATCH TYPE</Text>
                        <View style={styles.matchTypeRow}>
                            <TouchableOpacity
                                style={[styles.matchTypeBtn, matchType === 'ranked' && styles.matchTypeBtnActive]}
                                onPress={() => setMatchType('ranked')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.matchTypeIcon}>🏆</Text>
                                <Text style={[styles.matchTypeText, matchType === 'ranked' && styles.matchTypeTextActive]}>
                                    Ranked
                                </Text>
                                <Text style={styles.matchTypeDesc}>Affects your RR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.matchTypeBtn, matchType === 'friendly' && styles.matchTypeBtnActive]}
                                onPress={() => setMatchType('friendly')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.matchTypeIcon}>🤝</Text>
                                <Text style={[styles.matchTypeText, matchType === 'friendly' && styles.matchTypeTextActive]}>
                                    Friendly
                                </Text>
                                <Text style={styles.matchTypeDesc}>Practice mode</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Loadout */}
                        <Text style={styles.sectionLabel}>YOUR LOADOUT</Text>
                        <View style={styles.loadoutCard}>
                            <View style={styles.loadoutRow}>
                                <Text style={styles.loadoutIcon}>🗡️</Text>
                                <View>
                                    <Text style={styles.loadoutLabel}>Sword</Text>
                                    <Text style={styles.loadoutValue}>{equippedSword.replace(/_/g, ' ') || 'None'}</Text>
                                </View>
                            </View>
                            <View style={styles.loadoutDivider} />
                            <View style={styles.loadoutRow}>
                                <Text style={styles.loadoutIcon}>⚡</Text>
                                <View>
                                    <Text style={styles.loadoutLabel}>Rank</Text>
                                    <Text style={[styles.loadoutValue, { color: rankColor }]}>{rank} {userData?.rankDivision || 'III'}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Find Match Button */}
                        <View style={styles.findMatchContainer}>
                            <GameButton
                                title="⚔️  FIND MATCH"
                                onPress={startSearching}
                                disabled={!selectedLanguage}
                                style={styles.findMatchBtn}
                            />
                            {!selectedLanguage && (
                                <Text style={styles.hintText}>Select a language to continue</Text>
                            )}
                        </View>
                    </ScrollView>
                )}
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

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl, paddingBottom: SPACING.md,
    },
    backBtn: { width: 60 },
    backText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
    headerTitle: {
        color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '900', letterSpacing: 2,
    },

    // Content
    content: { padding: SPACING.md, paddingBottom: SPACING.xxl },

    // Section Label
    sectionLabel: {
        color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '800',
        letterSpacing: 2, marginBottom: SPACING.sm, marginTop: SPACING.md,
    },

    // Language Cards
    languageGrid: { flexDirection: 'row', gap: SPACING.sm },
    langCard: {
        width: 105, height: 100, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    langCardSelected: {
        borderColor: COLORS.primaryBlue, borderWidth: 2,
        shadowColor: COLORS.primaryBlue, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    langIcon: { fontSize: 32, marginBottom: SPACING.xs },
    langLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
    checkBadge: {
        position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10,
        backgroundColor: COLORS.primaryBlue, alignItems: 'center', justifyContent: 'center',
    },
    checkText: { color: '#fff', fontSize: 12, fontWeight: '900' },

    // Match Type
    matchTypeRow: { flexDirection: 'row', gap: SPACING.sm },
    matchTypeBtn: {
        flex: 1, backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.bgTertiary + '60',
    },
    matchTypeBtnActive: {
        borderColor: COLORS.primaryBlue, backgroundColor: COLORS.primaryBlue + '15',
    },
    matchTypeIcon: { fontSize: 24, marginBottom: SPACING.xs },
    matchTypeText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, fontWeight: '700' },
    matchTypeTextActive: { color: COLORS.primaryBlue },
    matchTypeDesc: { color: COLORS.textDisabled, fontSize: FONT_SIZES.xs, marginTop: 2 },

    // Loadout
    loadoutCard: {
        backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
        borderWidth: 1, borderColor: COLORS.bgTertiary + '40',
    },
    loadoutRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
    loadoutIcon: { fontSize: 24 },
    loadoutLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs },
    loadoutValue: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700' },
    loadoutDivider: { height: 1, backgroundColor: COLORS.bgTertiary + '40', marginVertical: SPACING.xs },

    // Find Match
    findMatchContainer: { marginTop: SPACING.xl, alignItems: 'center' },
    findMatchBtn: { width: '100%' },
    hintText: { color: COLORS.textDisabled, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },

    // Searching
    searchingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    searchRing: {
        width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.bgSecondary, borderWidth: 2, borderColor: COLORS.primaryBlue + '40',
        marginBottom: 40,
    },
    searchSpinner: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        borderWidth: 3, borderColor: 'transparent', borderTopColor: COLORS.primaryBlue,
        borderRightColor: COLORS.purpleAccent,
    },
    searchIcon: { fontSize: 56 },
    searchTitle: {
        color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '900', letterSpacing: 2,
    },
    searchSubtitle: {
        color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm, letterSpacing: 1,
    },
    queueText: { color: COLORS.textDisabled, fontSize: FONT_SIZES.sm, marginTop: SPACING.md },
    cancelBtn: {
        marginTop: SPACING.xl, paddingHorizontal: 30, paddingVertical: 12,
        borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.dangerRed + '60',
        backgroundColor: COLORS.dangerRed + '15',
    },
    cancelText: { color: COLORS.dangerRed, fontSize: FONT_SIZES.sm, fontWeight: '800', letterSpacing: 1 },
});

export default DuelLobbyScreen;
