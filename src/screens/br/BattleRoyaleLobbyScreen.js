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

const BattleRoyaleLobbyScreen = () => {
    const navigation = useNavigation();
    const [selectedLanguage, setSelectedLanguage] = useState(null);
    const [searching, setSearching] = useState(false);
    const [userData, setUserData] = useState(null);
    const [playerCount, setPlayerCount] = useState(0);

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        fetchUserData();
    }, []);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        const onQueueUpdate = (data) => {
            if (data.topic === selectedLanguage) {
                setPlayerCount(data.count);
            }
        };

        const onMatchFound = (data) => {
            navigation.replace('BattleRoyaleBattle', {
                roomId: data.roomId,
                language: data.topic,
                players: data.players,
                userData,
            });
        };

        const onError = (data) => {
            Alert.alert('Error', data.message);
            setSearching(false);
        };

        socket.on('br:queueUpdate', onQueueUpdate);
        socket.on('br:matchFound', onMatchFound);
        socket.on('error', onError);

        return () => {
            socket.off('br:queueUpdate', onQueueUpdate);
            socket.off('br:matchFound', onMatchFound);
            socket.off('error', onError);
        };
    }, [userData, selectedLanguage]);

    const fetchUserData = async () => {
        if (!auth.currentUser) return;
        try {
            const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (docSnap.exists()) {
                const data = { ...docSnap.data(), uid: auth.currentUser.uid };
                setUserData(data);
                connectSocket(data);
            }
        } catch (err) {
            console.error('Error fetching user data:', err);
        }
    };

    const startSearching = () => {
        if (!selectedLanguage || !userData) return;
        setSearching(true);

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.timing(spinAnim, {
                toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true,
            })
        ).start();

        const socket = getSocket();
        socket.emit('br:joinQueue', {
            userId: auth.currentUser.uid,
            username: userData.username || 'Player',
            rank: userData.rank || 'Bronze',
            topic: selectedLanguage,
        });
    };

    const cancelSearch = () => {
        setSearching(false);
        const socket = getSocket();
        socket.emit('br:leaveQueue', { topic: selectedLanguage });
    };

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <LinearGradient colors={[COLORS.bgPrimary, '#111827']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { cancelSearch(); navigation.goBack(); }} style={styles.backBtn}>
                        <Text style={styles.backText}>‹ Back</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>💀 BATTLE ROYALE</Text>
                    <View style={{ width: 60 }} />
                </View>

                {searching ? (
                    <View style={styles.searchingContainer}>
                        <Animated.View style={[styles.searchRing, { transform: [{ scale: pulseAnim }] }]}>
                            <Animated.View style={[styles.searchSpinner, { transform: [{ rotate: spin }] }]} />
                            <Text style={styles.searchIcon}>💀</Text>
                        </Animated.View>
                        <Text style={styles.searchTitle}>WAITING FOR WARRIORS</Text>
                        <Text style={styles.searchSubtitle}>
                            {selectedLanguage?.toUpperCase()} • SURVIVAL MODE
                        </Text>

                        <View style={styles.playerCountContainer}>
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{playerCount} / 10</Text>
                            </View>
                            <Text style={styles.waitingHint}>Match starts in 5s or when full</Text>
                        </View>

                        <TouchableOpacity style={styles.cancelBtn} onPress={cancelSearch}>
                            <Text style={styles.cancelText}>LEAVE QUEUE</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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

                        <Text style={styles.sectionLabel}>MODE INFO</Text>
                        <View style={styles.infoCard}>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoIcon}>🏆</Text>
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoTitle}>Last Man Standing</Text>
                                    <Text style={styles.infoDesc}>Eliminate others to win massibe RR rewards.</Text>
                                </View>
                            </View>
                            <View style={styles.infoDivider} />
                            <View style={styles.infoRow}>
                                <Text style={styles.infoIcon}>⚡</Text>
                                <View style={styles.infoTextContainer}>
                                    <Text style={styles.infoTitle}>Sudden Death</Text>
                                    <Text style={styles.infoDesc}>Damage increases after Round 5.</Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.findMatchContainer}>
                            <GameButton
                                title="💀  ENTER ARENA"
                                onPress={startSearching}
                                disabled={!selectedLanguage}
                                style={styles.findMatchBtn}
                            />
                            {!selectedLanguage && (
                                <Text style={styles.hintText}>Select a language to enter</Text>
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
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl, paddingBottom: SPACING.md,
    },
    backBtn: { width: 60 },
    backText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
    headerTitle: {
        color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '900', letterSpacing: 2,
    },
    content: { padding: SPACING.md, paddingBottom: SPACING.xxl },
    sectionLabel: {
        color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '800',
        letterSpacing: 2, marginBottom: SPACING.sm, marginTop: SPACING.md,
    },
    languageGrid: { flexDirection: 'row', gap: SPACING.sm },
    langCard: {
        width: 105, height: 100, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    langCardSelected: {
        borderColor: COLORS.successGreen, borderWidth: 2,
        shadowColor: COLORS.successGreen, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
    },
    langIcon: { fontSize: 32, marginBottom: SPACING.xs },
    langLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
    checkBadge: {
        position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10,
        backgroundColor: COLORS.successGreen, alignItems: 'center', justifyContent: 'center',
    },
    checkText: { color: '#fff', fontSize: 12, fontWeight: '900' },
    infoCard: {
        backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
        borderWidth: 1, borderColor: COLORS.bgTertiary + '40',
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
    infoIcon: { fontSize: 24 },
    infoTextContainer: { flex: 1 },
    infoTitle: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '700' },
    infoDesc: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, marginTop: 2 },
    infoDivider: { height: 1, backgroundColor: COLORS.bgTertiary + '40', marginVertical: SPACING.xs },
    findMatchContainer: { marginTop: SPACING.xl, alignItems: 'center' },
    findMatchBtn: { width: '100%' },
    hintText: { color: COLORS.textDisabled, fontSize: FONT_SIZES.xs, marginTop: SPACING.sm },
    searchingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    searchRing: {
        width: 180, height: 180, borderRadius: 90, alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.bgSecondary, borderWidth: 2, borderColor: COLORS.successGreen + '40',
        marginBottom: 40,
    },
    searchSpinner: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        borderWidth: 3, borderColor: 'transparent', borderTopColor: COLORS.successGreen,
        borderRightColor: COLORS.dangerRed,
    },
    searchIcon: { fontSize: 56 },
    searchTitle: {
        color: COLORS.textPrimary, fontSize: FONT_SIZES.xl, fontWeight: '900', letterSpacing: 2, textAlign: 'center',
    },
    searchSubtitle: {
        color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm, letterSpacing: 1,
    },
    playerCountContainer: { alignItems: 'center', marginTop: SPACING.xl },
    countBadge: {
        backgroundColor: COLORS.successGreen + '20', paddingHorizontal: 20, paddingVertical: 10,
        borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.successGreen + '40',
    },
    countText: { color: COLORS.successGreen, fontSize: 24, fontWeight: '900' },
    waitingHint: { color: COLORS.textDisabled, fontSize: FONT_SIZES.xs, marginTop: 10 },
    cancelBtn: {
        marginTop: 40, paddingHorizontal: 30, paddingVertical: 12,
        borderRadius: BORDER_RADIUS.full, borderWidth: 1, borderColor: COLORS.dangerRed + '60',
        backgroundColor: COLORS.dangerRed + '15',
    },
    cancelText: { color: COLORS.dangerRed, fontSize: FONT_SIZES.sm, fontWeight: '800', letterSpacing: 1 },
});

export default BattleRoyaleLobbyScreen;
