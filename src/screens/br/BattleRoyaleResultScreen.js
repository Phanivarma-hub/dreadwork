import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import GameButton from '../../components/GameButton';

const BattleRoyaleResultScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { winner, rankings, userData } = route.params;

    const mySocketId = userData?.socketId;
    const myRank = rankings.findIndex(p => p.userId === userData?.uid) + 1;
    const amIWinner = myRank === 1;

    return (
        <LinearGradient colors={[COLORS.bgPrimary, '#0F172A']} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerEmoji}>{amIWinner ? '🏆' : '💀'}</Text>
                        <Text style={styles.headerTitle}>{amIWinner ? 'VICTORY SURVIVOR' : 'ELIMINATED'}</Text>
                        <View style={styles.placementBadge}>
                            <Text style={styles.placementText}>#{myRank} / {rankings.length}</Text>
                        </View>
                    </View>

                    {/* Rankings Table */}
                    <Text style={styles.sectionLabel}>FINAL STANDINGS</Text>
                    <ScrollView style={styles.rankingsScroll} showsVerticalScrollIndicator={false}>
                        {rankings.map((p, index) => {
                            const isMe = p.userId === userData?.uid;
                            return (
                                <View
                                    key={index}
                                    style={[
                                        styles.rankingRow,
                                        index === 0 && styles.winnerRow,
                                        isMe && styles.myRow
                                    ]}
                                >
                                    <Text style={styles.rankNum}>{index + 1}</Text>
                                    <View style={styles.playerInfo}>
                                        <Text style={styles.playerName}>{p.username}</Text>
                                        <Text style={styles.playerDetail}>{p.rank}</Text>
                                    </View>
                                    {index === 0 && <Text style={styles.winnerTag}>WINNER</Text>}
                                    {isMe && <Text style={styles.meTag}>YOU</Text>}
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Rewards/RR - Mocked for now */}
                    <View style={styles.rewardCard}>
                        <View style={styles.rewardRow}>
                            <Text style={styles.rewardLabel}>Rating Change</Text>
                            <Text style={[styles.rewardValue, { color: amIWinner ? COLORS.successGreen : COLORS.dangerRed }]}>
                                {amIWinner ? '+50 RR' : '-10 RR'}
                            </Text>
                        </View>
                        <View style={styles.rewardRow}>
                            <Text style={styles.rewardLabel}>Coins Earned</Text>
                            <Text style={[styles.rewardValue, { color: '#FFD700' }]}>
                                {amIWinner ? '250' : '50'} 🪙
                            </Text>
                        </View>
                    </View>

                    {/* Actions */}
                    <GameButton
                        title="RETURN TO DASHBOARD"
                        onPress={() => navigation.navigate('Dashboard')}
                        style={styles.actionBtn}
                    />
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    content: { flex: 1, padding: SPACING.xl, alignItems: 'center' },
    header: { alignItems: 'center', marginBottom: 30 },
    headerEmoji: { fontSize: 64, marginBottom: 10 },
    headerTitle: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: 2 },
    placementBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: BORDER_RADIUS.md, marginTop: 15 },
    placementText: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '800' },
    sectionLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 2, alignSelf: 'flex-start', marginBottom: 10 },
    rankingsScroll: { width: '100%', maxHeight: 300 },
    rankingRow: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
        padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    winnerRow: { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.1)' },
    myRow: { borderColor: COLORS.primaryBlue, backgroundColor: 'rgba(59, 130, 246, 0.1)' },
    rankNum: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '900', width: 30 },
    playerInfo: { flex: 1 },
    playerName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
    playerDetail: { color: COLORS.textSecondary, fontSize: 12 },
    winnerTag: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#000', fontSize: 10, fontWeight: '900' },
    meTag: { backgroundColor: COLORS.primaryBlue, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, color: '#fff', fontSize: 10, fontWeight: '900', marginLeft: 5 },
    rewardCard: {
        width: '100%', backgroundColor: COLORS.bgSecondary, padding: 20, borderRadius: 16,
        marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    rewardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    rewardLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    rewardValue: { fontSize: 16, fontWeight: '800' },
    actionBtn: { width: '100%', marginTop: 'auto' },
});

export default BattleRoyaleResultScreen;
