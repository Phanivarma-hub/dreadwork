import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Animated,
    Easing,
    TextInput,
    ScrollView,
    Alert,
    Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RANK_COLORS } from '../../constants/theme';
import { getSocket } from '../../services/socketService';

const { width } = Dimensions.get('window');

const BattleRoyaleBattleScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { roomId, language, players: initialPlayers, userData } = route.params;

    // Game state
    const [players, setPlayers] = useState(initialPlayers);
    const [phase, setPhase] = useState('waiting'); // 'waiting' | 'selecting_target' | 'combat' | 'round_result'
    const [currentRound, setCurrentRound] = useState(1);
    const [targetId, setTargetId] = useState(null);
    const [survivors, setSurvivors] = useState(initialPlayers);

    // Combat state
    const [attackQuestion, setAttackQuestion] = useState(null);
    const [defenseQuestion, setDefenseQuestion] = useState(null);
    const [activeAttackerId, setActiveAttackerId] = useState(null);
    const [attackAnswer, setAttackAnswer] = useState('');
    const [defenseAnswer, setDefenseAnswer] = useState(null);
    const [attackSubmitted, setAttackSubmitted] = useState(false);
    const [defenseSubmitted, setDefenseSubmitted] = useState(false);

    // Timers
    const [attackTime, setAttackTime] = useState(30);
    const [defenseTime, setDefenseTime] = useState(20);
    const [selectionTime, setSelectionTime] = useState(10);

    // My stats
    const [myHP, setMyHP] = useState(150);
    const [shakeAnim] = useState(new Animated.Value(0));

    const socket = getSocket();
    const timerRef = useRef(null);

    // Filter survivors
    useEffect(() => {
        setSurvivors(players.filter(p => p.status === 'alive'));
        const me = players.find(p => p.socketId === socket?.id);
        if (me) {
            if (me.hp < myHP) {
                triggerShake();
            }
            setMyHP(me.hp);
        }
    }, [players]);

    // Socket listeners
    useEffect(() => {
        if (!socket) return;

        const onTargetSelectionStart = (data) => {
            setPhase('selecting_target');
            setSelectionTime(10);
            setTargetId(null);
            setAttackSubmitted(false);
            setDefenseSubmitted(false);
            setAttackAnswer('');
            setDefenseAnswer(null);

            if (data.players) {
                setPlayers(data.players.map(p => ({
                    ...p,
                    status: p.status || 'alive',
                    hp: p.hp ?? 150
                })));
            }
            startSelectionTimer();
        };

        const onAttackQuestion = (data) => {
            setPhase('combat');
            setAttackQuestion(data.question);
            setTargetId(data.targetId); // Ensure target is reflected even if randomly assigned
            setAttackTime(data.timer || 30);
            startCombatTimers();
        };

        const onDefenseQuestion = (data) => {
            setPhase('combat');
            setDefenseQuestion(data.question);
            setActiveAttackerId(data.attackerId);
            setDefenseTime(data.timer || 20);
        };

        const onRoundResult = (data) => {
            setPhase('round_result');
            setCurrentRound(data.round);

            // Map the summary players array back to our local state
            setPlayers(prev => prev.map(p => {
                const update = data.players.find(up => up.socketId === p.socketId);
                return update ? { ...p, ...update } : p;
            }));

            // Show damage dealt/received if possible
            // results: { attackerId: { targetId, damage, ... } }
            const myResult = data.results[socket.id];
            if (myResult && myResult.damage > 0) {
                // Could show a "DEALT X DAMAGE" popup here
            }
        };

        const onPlayerEliminated = (data) => {
            // Toast or notification
        };

        const onPlayerUpdate = (data) => {
            setPlayers(prev => prev.map(p =>
                p.socketId === data.socketId ? { ...p, ...data } : p
            ));
        };

        const onGameOver = (data) => {
            navigation.replace('BattleRoyaleResult', {
                winner: data.winnerId,
                rankings: data.rankings,
                userData,
            });
        };

        socket.on('br:selectTarget', onTargetSelectionStart);
        socket.on('br:attackQuestion', onAttackQuestion);
        socket.on('br:defenseQuestion', onDefenseQuestion);
        socket.on('br:roundResult', onRoundResult);
        socket.on('br:playerUpdate', onPlayerUpdate);
        socket.on('br:playerEliminated', onPlayerEliminated);
        socket.on('br:gameOver', onGameOver);

        return () => {
            socket.off('br:selectTarget', onTargetSelectionStart);
            socket.off('br:attackQuestion', onAttackQuestion);
            socket.off('br:defenseQuestion', onDefenseQuestion);
            socket.off('br:roundResult', onRoundResult);
            socket.off('br:playerUpdate', onPlayerUpdate);
            socket.off('br:playerEliminated', onPlayerEliminated);
            socket.off('br:gameOver', onGameOver);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [socket, userData]);

    const startSelectionTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setSelectionTime(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const triggerShake = () => {
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true, easing: Easing.linear }),
        ]).start();
    };

    const startCombatTimers = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setAttackTime(prev => (prev > 0 ? prev - 1 : 0));
            setDefenseTime(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
    };

    const handleSelectTarget = (id) => {
        if (phase !== 'selecting_target' || id === socket.id) return;
        setTargetId(id);
        socket.emit('br:selectTarget', { roomId, targetId: id });
    };

    const submitAttack = () => {
        if (attackSubmitted || !attackAnswer.trim()) return;
        setAttackSubmitted(true);
        socket.emit('br:submitAttack', {
            roomId,
            answer: attackAnswer.trim(),
            questionId: attackQuestion?.id
        });
    };

    const submitDefense = (option) => {
        if (defenseSubmitted) return;
        setDefenseAnswer(option);
        setDefenseSubmitted(true);
        socket.emit('br:submitDefense', {
            roomId,
            answer: option,
            questionId: defenseQuestion?.id || defenseQuestion?._id,
            attackerId: activeAttackerId
        });
    };

    const usePowerup = (type) => {
        // Power-ups removed
    };

    const renderPlayerGrid = () => (
        <View style={styles.grid}>
            {players.map((p, index) => {
                const isMe = p.socketId === socket.id;
                const isSelected = targetId === p.socketId;
                const isEliminated = p.status === 'eliminated';
                return (
                    <TouchableOpacity
                        key={p.socketId || `player-${index}`}
                        style={[
                            styles.playerCard,
                            isMe && styles.myCard,
                            isSelected && styles.selectedCard,
                            isEliminated && styles.eliminatedCard
                        ]}
                        onPress={() => handleSelectTarget(p.socketId)}
                        disabled={phase !== 'selecting_target' || isMe || isEliminated}
                    >
                        <Text style={styles.playerEmoji}>{isEliminated ? '💀' : (isMe ? '👤' : '⚔️')}</Text>
                        <Text style={styles.playerName} numberOfLines={1}>{p.username}</Text>
                        <View style={styles.hpMiniBar}>
                            <View style={[styles.hpFill, { width: `${(p.hp / 150) * 100}%`, backgroundColor: p.hp > 75 ? '#10B981' : p.hp > 40 ? '#F59E0B' : '#EF4444' }]} />
                        </View>
                        <Text style={styles.hpText}>{p.hp} HP</Text>
                        {isSelected && <View style={styles.targetBadge}><Text style={styles.targetIcon}>🎯</Text></View>}
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    return (
        <LinearGradient colors={[COLORS.bgPrimary, '#0F172A']} style={styles.container}>
            <Animated.View style={[styles.safeArea, { transform: [{ translateX: shakeAnim }] }]}>
                <SafeAreaView style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.roundText}>ROUND {currentRound}</Text>
                        {currentRound >= 5 && <View style={styles.suddenDeath}><Text style={styles.sdText}>SUDDEN DEATH 🔥 1.5x DMG</Text></View>}
                        <View style={styles.survivorCount}>
                            <Text style={styles.countText}>👥 {survivors.length} ALIVE</Text>
                        </View>
                    </View>

                    {/* Player Grid */}
                    {renderPlayerGrid()}

                    <View style={styles.divider} />

                    {/* Lower Action Area */}
                    <ScrollView contentContainerStyle={styles.actionArea}>
                        {phase === 'waiting' && (
                            <View style={styles.centerBox}>
                                <Text style={styles.waitingTitle}>WARM UP</Text>
                                <Text style={styles.waitingSub}>Game starting shortly...</Text>
                            </View>
                        )}

                        {phase === 'selecting_target' && (
                            <View style={styles.selectionBox}>
                                <Text style={styles.selectionTime}>{selectionTime}s</Text>
                                <Text style={styles.selectionTitle}>SELECT YOUR TARGET</Text>
                                <Text style={styles.selectionSub}>{targetId ? "Target Locked!" : "Tap a player above to attack them"}</Text>
                            </View>
                        )}

                        {phase === 'combat' && (
                            <View style={styles.combatContainer}>
                                {/* Attack Section */}
                                <View style={[styles.combatSection, attackSubmitted && styles.submittedSection]}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>⚔️ ATTACK ({attackTime}s)</Text>
                                    </View>
                                    {attackQuestion?.code && (
                                        <View style={styles.codeBlock}>
                                            <Text style={styles.codeText}>{attackQuestion.code}</Text>
                                        </View>
                                    )}
                                    {attackQuestion?.type === 'explanation' ? (
                                        <>
                                            <Text style={styles.questionText}>{attackQuestion.question}</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="Explain..."
                                                placeholderTextColor="#64748B"
                                                multiline
                                                value={attackAnswer}
                                                onChangeText={setAttackAnswer}
                                                editable={!attackSubmitted}
                                            />
                                            {!attackSubmitted && (
                                                <TouchableOpacity style={styles.submitBtn} onPress={submitAttack}>
                                                    <Text style={styles.submitBtnText}>SUBMIT ATTACK</Text>
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    ) : attackQuestion?.type === 'mcq' ? (
                                        <>
                                            <Text style={styles.questionText}>{attackQuestion.question}</Text>
                                            <View style={styles.optionsRow}>
                                                {attackQuestion.options?.map((opt, i) => (
                                                    <TouchableOpacity
                                                        key={i}
                                                        style={[styles.optionBtn, attackAnswer === opt && styles.optionSelected]}
                                                        onPress={() => setAttackAnswer(opt)}
                                                        disabled={attackSubmitted}
                                                    >
                                                        <Text style={styles.optionText}>{opt}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                            {!attackSubmitted && (
                                                <TouchableOpacity style={styles.submitBtn} onPress={submitAttack}>
                                                    <Text style={styles.submitBtnText}>SUBMIT ATTACK</Text>
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    ) : (
                                        <View>
                                            <Text style={styles.questionText}>{attackQuestion?.question || "Loading task..."}</Text>
                                            <TextInput
                                                style={styles.textInput}
                                                placeholder="Enter output or solution..."
                                                placeholderTextColor="#64748B"
                                                value={attackAnswer}
                                                onChangeText={setAttackAnswer}
                                                editable={!attackSubmitted}
                                            />
                                            {!attackSubmitted && (
                                                <TouchableOpacity style={styles.submitBtn} onPress={submitAttack}>
                                                    <Text style={styles.submitBtnText}>SUBMIT ATTACK</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>

                                {/* Defense Section */}
                                <View style={[styles.combatSection, defenseSubmitted && styles.submittedSection]}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionTitle}>🛡️ DEFENSE ({defenseTime}s)</Text>
                                    </View>
                                    <Text style={styles.questionText}>{defenseQuestion?.question || (defenseQuestion?.code ? "What is the output of this code?" : "Loading...")}</Text>
                                    {defenseQuestion?.code && (
                                        <View style={styles.codeBlock}>
                                            <Text style={styles.codeText}>{defenseQuestion.code}</Text>
                                        </View>
                                    )}
                                    <View style={styles.optionsRow}>
                                        {defenseQuestion?.options?.map((opt, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={[styles.optionBtn, defenseAnswer === opt && styles.optionSelected]}
                                                onPress={() => submitDefense(opt)}
                                                disabled={defenseSubmitted}
                                            >
                                                <Text style={styles.optionText}>{opt}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            </View>
                        )}

                        {phase === 'round_result' && (
                            <View style={styles.centerBox}>
                                <Text style={styles.waitingTitle}>ROUND OVER</Text>
                                <Text style={styles.waitingSub}>Calculating damage...</Text>
                            </View>
                        )}
                    </ScrollView>

                </SafeAreaView>
            </Animated.View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        paddingHorizontal: SPACING.md, paddingTop: 10,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    roundText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '900' },
    suddenDeath: { backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    sdText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    survivorCount: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
    countText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },

    grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, justifyContent: 'space-between' },
    playerCard: {
        width: (width - 40) / 5, height: 80, backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8, padding: 5, alignItems: 'center', marginBottom: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
    },
    myCard: { borderColor: COLORS.primaryBlue, backgroundColor: 'rgba(59,130,246,0.1)' },
    selectedCard: { borderColor: COLORS.dangerRed, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    eliminatedCard: { opacity: 0.3 },
    playerEmoji: { fontSize: 20 },
    playerName: { color: COLORS.textPrimary, fontSize: 8, fontWeight: '700', marginTop: 2 },
    hpMiniBar: { height: 4, width: '100%', backgroundColor: '#1E293B', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
    hpFill: { height: '100%' },
    hpText: { color: COLORS.textSecondary, fontSize: 8, marginTop: 2 },
    targetBadge: { position: 'absolute', top: -5, right: -5 },
    targetIcon: { fontSize: 14 },

    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 15 },

    actionArea: { padding: 15, flexGrow: 1 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    waitingTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
    waitingSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10 },

    selectionBox: { alignItems: 'center', marginTop: 20 },
    selectionTime: { color: COLORS.dangerRed, fontSize: 48, fontWeight: '900' },
    selectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 10 },
    selectionSub: { color: COLORS.textSecondary, fontSize: 14, marginTop: 5 },

    combatContainer: { gap: 15 },
    combatSection: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    submittedSection: { opacity: 0.6, backgroundColor: 'rgba(0,0,0,0.2)' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    sectionTitle: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '900' },
    powerupActive: { color: COLORS.primaryBlue, fontSize: 10, fontWeight: '900' },
    questionText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', lineHeight: 20 },
    codeBlock: { backgroundColor: '#000', padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: '#334155' },
    codeText: { color: '#10B981', fontSize: 13, lineHeight: 18 },
    textInput: { backgroundColor: '#1E293B', borderRadius: 8, padding: 10, color: '#fff', fontSize: 14, height: 80, marginTop: 10, textAlignVertical: 'top' },
    submitBtn: { backgroundColor: COLORS.primaryBlue, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 10 },
    submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    optionsRow: { marginTop: 10, gap: 8 },
    optionBtn: { backgroundColor: '#1E293B', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    optionSelected: { borderColor: COLORS.primaryBlue, backgroundColor: 'rgba(59,130,246,0.1)' },
    optionText: { color: COLORS.textPrimary, fontSize: 12 },

    powerupBar: { flexDirection: 'row', justifyContent: 'center', gap: 20, paddingBottom: 20, paddingTop: 10 },
    pBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
    pActive: { borderColor: COLORS.primaryBlue, backgroundColor: 'rgba(59,130,246,0.2)' },
    pDisabled: { opacity: 0.2 },
    pIcon: { fontSize: 20 },
    pCount: { position: 'absolute', bottom: -5, right: -5, backgroundColor: COLORS.primaryBlue, color: '#fff', fontSize: 10, fontWeight: '900', paddingHorizontal: 5, borderRadius: 5 },
});

export default BattleRoyaleBattleScreen;
