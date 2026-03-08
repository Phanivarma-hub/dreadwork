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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, RANK_COLORS } from '../../constants/theme';
import { getSocket } from '../../services/socketService';

const ROUND_CONFIG = [
    { type: 'mcq', label: 'Multiple Choice', timer: 30, icon: '📝' },
    { type: 'explanation', label: 'Short Explanation', timer: 45, icon: '💬' },
    { type: 'code_output', label: 'Code Output', timer: 30, icon: '💻' },
];

const DuelBattleScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { roomId, language, matchType, opponentName, opponentRank, userData } = route.params;

    // Game state
    const [currentRound, setCurrentRound] = useState(0);
    const [phase, setPhase] = useState('intro'); // 'intro' | 'round_intro' | 'playing' | 'round_result' | 'finished'
    const [playerScore, setPlayerScore] = useState(0);
    const [opponentScore, setOpponentScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [explanationAnswer, setExplanationAnswer] = useState('');
    const [roundResult, setRoundResult] = useState(null);
    const [playerHP, setPlayerHP] = useState(100);
    const [opponentHP, setOpponentHP] = useState(100);
    const [waitingForOpponent, setWaitingForOpponent] = useState(false);

    // Powerups
    const [hintUsed, setHintUsed] = useState(false);
    const [timeWarpUsed, setTimeWarpUsed] = useState(false);
    const [hiddenOptions, setHiddenOptions] = useState([]);

    const timerRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const roundIntroScale = useRef(new Animated.Value(0)).current;

    const username = userData?.username || 'You';
    const playerRank = userData?.rank || 'Bronze';
    const socket = getSocket();

    // ── SOCKET EVENT LISTENERS ──
    useEffect(() => {
        if (!socket) return;

        const onQuestion = (data) => {
            const { round, type, timer } = data;
            setCurrentRound(round - 1);
            setCurrentQuestion(data);
            setSelectedOption(null);
            setIsAnswered(false);
            setExplanationAnswer('');
            setHiddenOptions([]);
            setWaitingForOpponent(false);
            setRoundResult(null);

            // Show round intro first
            setPhase('round_intro');
        };

        const onRoundResult = (data) => {
            const { yourResult, opponentResult, opponentUsername, scores, hp, correctAnswer, aiScore, aiFeedback } = data;

            setPlayerScore(scores.you);
            setOpponentScore(scores.opponent);
            setPlayerHP(hp.you);
            setOpponentHP(hp.opponent);

            setRoundResult({
                playerCorrect: yourResult,
                opponentCorrect: opponentResult,
                opponentUsername: opponentUsername || opponentName,
                correctAnswer,
                aiScore: aiScore || null,
                aiFeedback: aiFeedback || null,
            });
            setPhase('round_result');
        };

        const onMatchEnd = (data) => {
            const { playerWon, isDraw, playerScore: pScore, opponentScore: oScore, opponentName: oName, language: lang, matchType: mType } = data;
            navigation.replace('DuelResult', {
                playerWon,
                isDraw,
                playerScore: pScore,
                botScore: oScore,
                opponentName: oName || opponentName,
                language: lang || language,
                matchType: mType || matchType,
                userData,
            });
        };

        const onOpponentDisconnected = (data) => {
            Alert.alert('Opponent Left', data.message || 'Your opponent disconnected.');
        };

        socket.on('question', onQuestion);
        socket.on('roundResult', onRoundResult);
        socket.on('matchEnd', onMatchEnd);
        socket.on('opponentDisconnected', onOpponentDisconnected);

        return () => {
            socket.off('question', onQuestion);
            socket.off('roundResult', onRoundResult);
            socket.off('matchEnd', onMatchEnd);
            socket.off('opponentDisconnected', onOpponentDisconnected);
        };
    }, [socket]);

    // ── Intro → wait for first question from server ──
    useEffect(() => {
        setTimeout(() => {
            // Server sends first question after ~3s, just keep intro until then
        }, 1800);
    }, []);

    // ── Round Intro Animation ──
    useEffect(() => {
        if (phase === 'round_intro') {
            roundIntroScale.setValue(0);
            Animated.sequence([
                Animated.spring(roundIntroScale, {
                    toValue: 1, tension: 60, friction: 6, useNativeDriver: true,
                }),
                Animated.delay(1200),
                Animated.timing(roundIntroScale, {
                    toValue: 0, duration: 300, useNativeDriver: true,
                }),
            ]).start(() => {
                setPhase('playing');
                startTimer();
                animateContentIn();
            });
        }
    }, [phase]);

    const animateContentIn = () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
    };

    // ── CLIENT-SIDE TIMER (display only, server enforces) ──
    const startTimer = () => {
        if (!currentQuestion) return;
        const roundTimer = currentQuestion.timer || ROUND_CONFIG[currentRound].timer;
        setTimeLeft(roundTimer);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleTimeUp();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleTimeUp = () => {
        if (phase !== 'playing' || isAnswered) return;
        // Submit null answer on timeout
        submitAnswer(null);
    };

    // ── POWERUPS (client-side only — cosmetic) ──
    const useHint = () => {
        if (hintUsed || !currentQuestion || currentQuestion.type !== 'mcq' || isAnswered) return;
        setHintUsed(true);
        if (currentQuestion.options) {
            // Hide 2 random wrong options (we don't know the correct answer from server, so hide 2 random)
            const shuffled = [...currentQuestion.options].sort(() => 0.5 - Math.random());
            setHiddenOptions(shuffled.slice(0, 2));
        }
    };

    const useTimeWarp = () => {
        if (timeWarpUsed || isAnswered) return;
        setTimeWarpUsed(true);
        setTimeLeft(prev => prev + 10);
    };

    // ── SUBMIT ANSWER TO SERVER ──
    const submitAnswer = (answer) => {
        if (isAnswered) return;
        clearInterval(timerRef.current);
        setIsAnswered(true);
        setWaitingForOpponent(true);

        socket.emit('submitAnswer', {
            roomId,
            answer,
        });
    };

    // ── ANSWER HANDLERS ──
    const handleMCQAnswer = (option) => {
        if (isAnswered) return;
        setSelectedOption(option);
        submitAnswer(option);
    };

    const handleExplanationSubmit = () => {
        if (isAnswered || !explanationAnswer.trim()) return;
        submitAnswer(explanationAnswer.trim());
    };

    const handleCodeAnswer = (option) => {
        if (isAnswered) return;
        setSelectedOption(option);
        submitAnswer(option);
    };

    // Cleanup
    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // ── RENDER HELPERS ──
    const renderHPBar = (label, hp, rankLabel, rankClr, isOpponent = false) => (
        <View style={[styles.hpContainer, isOpponent && { alignItems: 'flex-end' }]}>
            <View style={styles.hpNameRow}>
                <Text style={styles.hpName}>{label}</Text>
                <Text style={[styles.hpRank, { color: rankClr }]}>{rankLabel}</Text>
            </View>
            <View style={styles.hpBarBg}>
                <View style={[
                    styles.hpBarFill,
                    {
                        width: `${hp}%`,
                        backgroundColor: hp > 60 ? COLORS.successGreen : hp > 30 ? COLORS.orange : COLORS.dangerRed,
                    },
                ]} />
            </View>
            <Text style={styles.hpText}>{Math.round(hp)} HP</Text>
        </View>
    );

    const renderTimer = () => (
        <View style={[styles.timerCircle, timeLeft <= 10 && { borderColor: COLORS.dangerRed }]}>
            <Text style={[styles.timerText, timeLeft <= 10 && { color: COLORS.dangerRed }]}>{timeLeft}s</Text>
        </View>
    );

    const renderPowerups = () => (
        <View style={styles.powerupRow}>
            {currentQuestion?.type === 'mcq' && (
                <TouchableOpacity
                    style={[styles.powerupBtn, hintUsed && styles.powerupUsed]}
                    onPress={useHint}
                    disabled={hintUsed}
                >
                    <Text style={styles.powerupIcon}>🔍</Text>
                    <Text style={styles.powerupLabel}>Hint</Text>
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={[styles.powerupBtn, timeWarpUsed && styles.powerupUsed]}
                onPress={useTimeWarp}
                disabled={timeWarpUsed}
            >
                <Text style={styles.powerupIcon}>⏰</Text>
                <Text style={styles.powerupLabel}>+10s</Text>
            </TouchableOpacity>
        </View>
    );

    // ── RENDER PHASES ──

    // Intro — VS screen
    if (phase === 'intro') {
        return (
            <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
                <SafeAreaView style={styles.centerFull}>
                    <Text style={styles.vsIcon}>⚔️</Text>
                    <View style={styles.vsRow}>
                        <View style={styles.vsPlayer}>
                            <Text style={styles.vsName}>{username}</Text>
                            <Text style={[styles.vsRank, { color: RANK_COLORS[playerRank] }]}>{playerRank}</Text>
                        </View>
                        <Text style={styles.vsText}>VS</Text>
                        <View style={styles.vsPlayer}>
                            <Text style={styles.vsName}>{opponentName}</Text>
                            <Text style={[styles.vsRank, { color: RANK_COLORS[opponentRank] }]}>{opponentRank}</Text>
                        </View>
                    </View>
                    <Text style={styles.vsSub}>{language.toUpperCase()} • {matchType === 'ranked' ? 'RANKED' : 'FRIENDLY'}</Text>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // Round Intro
    if (phase === 'round_intro') {
        return (
            <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
                <SafeAreaView style={styles.centerFull}>
                    <Animated.View style={{ transform: [{ scale: roundIntroScale }], alignItems: 'center' }}>
                        <Text style={styles.roundIntroIcon}>{ROUND_CONFIG[currentRound]?.icon || '📝'}</Text>
                        <Text style={styles.roundIntroTitle}>ROUND {currentRound + 1}</Text>
                        <Text style={styles.roundIntroSub}>{ROUND_CONFIG[currentRound]?.label || 'Question'}</Text>
                    </Animated.View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // Round Result
    if (phase === 'round_result' && roundResult) {
        return (
            <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
                <SafeAreaView style={styles.centerFull}>
                    <Text style={styles.roundResultIcon}>
                        {roundResult.playerCorrect ? '✅' : '❌'}
                    </Text>
                    <Text style={styles.roundResultTitle}>
                        {roundResult.playerCorrect ? 'CORRECT!' : 'WRONG!'}
                    </Text>
                    <Text style={styles.roundResultSub}>
                        {roundResult.opponentUsername}: {roundResult.opponentCorrect ? '✅ Correct' : '❌ Wrong'}
                    </Text>
                    {/* AI Grading Feedback (Explanation rounds) */}
                    {roundResult.aiScore !== null && (
                        <View style={styles.aiFeedbackCard}>
                            <Text style={styles.aiFeedbackHeader}>🤖 AI Grading</Text>
                            <Text style={styles.aiScoreText}>
                                Score: {roundResult.aiScore}/100
                            </Text>
                            {roundResult.aiFeedback && (
                                <Text style={styles.aiFeedbackText}>{roundResult.aiFeedback}</Text>
                            )}
                        </View>
                    )}
                    <View style={styles.scoreRow}>
                        <View style={styles.scoreCard}>
                            <Text style={styles.scoreCardLabel}>You</Text>
                            <Text style={styles.scoreCardValue}>{playerScore}</Text>
                        </View>
                        <Text style={styles.scoreDash}>-</Text>
                        <View style={styles.scoreCard}>
                            <Text style={styles.scoreCardLabel}>{opponentName}</Text>
                            <Text style={styles.scoreCardValue}>{opponentScore}</Text>
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    // ── Main Playing Phase ──
    if (!currentQuestion) {
        return (
            <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
                <SafeAreaView style={styles.centerFull}>
                    <Text style={{ color: COLORS.textPrimary, fontSize: FONT_SIZES.md }}>Waiting for question...</Text>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={[COLORS.bgPrimary, COLORS.bgSecondary]} style={styles.container}>
            <SafeAreaView style={styles.battleSafe}>
                {/* Top Bar — HP Bars */}
                <View style={styles.topBar}>
                    {renderHPBar(username, playerHP, playerRank, RANK_COLORS[playerRank])}
                    <View style={styles.roundBadge}>
                        <Text style={styles.roundBadgeText}>R{currentRound + 1}</Text>
                    </View>
                    {renderHPBar(opponentName, opponentHP, opponentRank, RANK_COLORS[opponentRank], true)}
                </View>

                {/* Timer */}
                <View style={styles.timerRow}>
                    {renderTimer()}
                </View>

                {/* Waiting for opponent indicator */}
                {waitingForOpponent && (
                    <View style={styles.waitingBanner}>
                        <Text style={styles.waitingText}>⏳ Waiting for opponent...</Text>
                    </View>
                )}

                {/* Question Area */}
                <Animated.View style={[styles.questionArea, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                        {/* Round Label */}
                        <View style={styles.roundLabelRow}>
                            <Text style={styles.roundLabelIcon}>{ROUND_CONFIG[currentRound]?.icon || '📝'}</Text>
                            <Text style={styles.roundLabelText}>{ROUND_CONFIG[currentRound]?.label || 'Question'}</Text>
                        </View>

                        {/* MCQ Round */}
                        {currentQuestion.type === 'mcq' && (
                            <>
                                <View style={styles.questionCard}>
                                    <Text style={styles.questionText}>{currentQuestion.question}</Text>
                                </View>
                                <View style={styles.optionsContainer}>
                                    {currentQuestion?.options && Array.isArray(currentQuestion.options) ? (
                                        currentQuestion.options.map((option, index) => {
                                            if (hiddenOptions.includes(option)) return null;
                                            let optStyle = [styles.optionBtn];
                                            let txtStyle = [styles.optionText];
                                            if (isAnswered && option === selectedOption) {
                                                optStyle.push({ borderColor: COLORS.primaryBlue, borderWidth: 2 });
                                            }
                                            return (
                                                <TouchableOpacity
                                                    key={index} style={optStyle}
                                                    onPress={() => handleMCQAnswer(option)}
                                                    disabled={isAnswered}
                                                >
                                                    <Text style={txtStyle}>{option}</Text>
                                                </TouchableOpacity>
                                            );
                                        })
                                    ) : (
                                        <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>No options available</Text>
                                    )}
                                </View>
                            </>
                        )}

                        {/* Explanation Round */}
                        {currentQuestion.type === 'explanation' && (
                            <>
                                <View style={styles.questionCard}>
                                    <Text style={styles.questionText}>{currentQuestion.question}</Text>
                                </View>
                                <TextInput
                                    style={styles.explanationInput}
                                    multiline
                                    placeholder="Type your explanation here..."
                                    placeholderTextColor={COLORS.textDisabled}
                                    value={explanationAnswer}
                                    onChangeText={setExplanationAnswer}
                                    editable={!isAnswered}
                                />
                                {!isAnswered && (
                                    <TouchableOpacity
                                        style={[styles.submitBtn, !explanationAnswer.trim() && { opacity: 0.4 }]}
                                        onPress={handleExplanationSubmit}
                                        disabled={!explanationAnswer.trim()}
                                    >
                                        <LinearGradient colors={COLORS.gradientBlue} style={styles.submitGradient}>
                                            <Text style={styles.submitText}>SUBMIT ANSWER</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}

                        {/* Code Output Round */}
                        {currentQuestion.type === 'code_output' && (
                            <>
                                <View style={styles.codeCard}>
                                    <Text style={styles.codeLabel}>What does this code output?</Text>
                                    <View style={styles.codeBlock}>
                                        <Text style={styles.codeText}>{currentQuestion.code || currentQuestion.question}</Text>
                                    </View>
                                </View>
                                <View style={styles.optionsContainer}>
                                    {currentQuestion?.options && Array.isArray(currentQuestion.options) ? (
                                        currentQuestion.options.map((option, index) => {
                                            let optStyle = [styles.optionBtn];
                                            let txtStyle = [styles.optionText];
                                            if (isAnswered && option === selectedOption) {
                                                optStyle.push({ borderColor: COLORS.primaryBlue, borderWidth: 2 });
                                            }
                                            return (
                                                <TouchableOpacity
                                                    key={index} style={optStyle}
                                                    onPress={() => handleCodeAnswer(option)}
                                                    disabled={isAnswered}
                                                >
                                                    <Text style={txtStyle}>{option}</Text>
                                                </TouchableOpacity>
                                            );
                                        })
                                    ) : (
                                        <Text style={{ color: COLORS.textSecondary, textAlign: 'center' }}>No options available</Text>
                                    )}
                                </View>
                            </>
                        )}
                    </ScrollView>
                </Animated.View>

                {/* Powerups */}
                {phase === 'playing' && !isAnswered && renderPowerups()}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerFull: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
    battleSafe: { flex: 1 },

    // VS Intro
    vsIcon: { fontSize: 64, marginBottom: 30 },
    vsRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
    vsPlayer: { alignItems: 'center', width: 120 },
    vsName: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '800' },
    vsRank: { fontSize: FONT_SIZES.sm, fontWeight: '700', marginTop: 4 },
    vsText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xxl, fontWeight: '900', letterSpacing: 4 },
    vsSub: { color: COLORS.textDisabled, fontSize: FONT_SIZES.sm, letterSpacing: 2 },

    // Round Intro
    roundIntroIcon: { fontSize: 64, marginBottom: 20 },
    roundIntroTitle: { color: COLORS.textPrimary, fontSize: 36, fontWeight: '900', letterSpacing: 4 },
    roundIntroSub: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, marginTop: 8 },

    // Top Bar
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md, paddingTop: SPACING.xxl,
    },
    hpContainer: { flex: 1 },
    hpNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    hpName: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs, fontWeight: '700' },
    hpRank: { fontSize: 10, fontWeight: '700' },
    hpBarBg: { height: 8, backgroundColor: COLORS.hpBarBg, borderRadius: 4, overflow: 'hidden' },
    hpBarFill: { height: '100%', borderRadius: 4 },
    hpText: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
    roundBadge: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.purpleAccent,
        alignItems: 'center', justifyContent: 'center', marginHorizontal: SPACING.sm,
    },
    roundBadgeText: { color: '#fff', fontSize: FONT_SIZES.sm, fontWeight: '900' },

    // Timer
    timerRow: { alignItems: 'center', marginVertical: SPACING.sm },
    timerCircle: {
        width: 56, height: 56, borderRadius: 28, borderWidth: 3, borderColor: COLORS.primaryBlue,
        alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(59,130,246,0.1)',
    },
    timerText: { color: COLORS.primaryBlue, fontSize: FONT_SIZES.lg, fontWeight: '900' },

    // Waiting
    waitingBanner: {
        backgroundColor: COLORS.primaryBlue + '20', paddingVertical: 8,
        alignItems: 'center', marginHorizontan: SPACING.md,
    },
    waitingText: { color: COLORS.primaryBlue, fontSize: FONT_SIZES.xs, fontWeight: '700' },

    // Round Label
    roundLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
    roundLabelIcon: { fontSize: 20 },
    roundLabelText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '800', letterSpacing: 2 },

    // Question Area
    questionArea: { flex: 1, paddingHorizontal: SPACING.md },
    questionCard: {
        backgroundColor: COLORS.bgSecondary, padding: 20, borderRadius: BORDER_RADIUS.lg,
        marginBottom: SPACING.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    questionText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, lineHeight: 28, fontWeight: '600' },

    // Options
    optionsContainer: { gap: 10 },
    optionBtn: {
        backgroundColor: COLORS.bgSecondary, padding: 16, borderRadius: BORDER_RADIUS.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    optionText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.md, fontWeight: '500', flex: 1 },

    // Explanation
    explanationInput: {
        backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, color: COLORS.textPrimary, fontSize: FONT_SIZES.md,
        minHeight: 120, textAlignVertical: 'top',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: SPACING.md,
    },
    submitBtn: { borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
    submitGradient: { paddingVertical: SPACING.md, alignItems: 'center', borderRadius: BORDER_RADIUS.md },
    submitText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: '800', letterSpacing: 1 },

    // Code Output
    codeCard: {
        backgroundColor: COLORS.bgSecondary, borderRadius: BORDER_RADIUS.lg,
        padding: 20, marginBottom: SPACING.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    },
    codeLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '700', marginBottom: SPACING.sm },
    codeBlock: { backgroundColor: '#0D1117', padding: SPACING.md, borderRadius: BORDER_RADIUS.sm },
    codeText: { color: '#79C0FF', fontSize: FONT_SIZES.sm, fontFamily: 'monospace', lineHeight: 22 },

    // Round Result
    roundResultIcon: { fontSize: 64, marginBottom: 20 },
    roundResultTitle: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', letterSpacing: 2 },
    roundResultSub: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, marginTop: SPACING.sm },
    aiFeedbackCard: {
        backgroundColor: 'rgba(139,92,246,0.15)', borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, marginTop: SPACING.md, width: '100%',
        borderWidth: 1, borderColor: 'rgba(139,92,246,0.3)', alignItems: 'center',
    },
    aiFeedbackHeader: { color: '#A78BFA', fontSize: FONT_SIZES.sm, fontWeight: '800', letterSpacing: 1 },
    aiScoreText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: '900', marginTop: 4 },
    aiFeedbackText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, marginTop: 4, textAlign: 'center' },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 30 },
    scoreCard: {
        backgroundColor: COLORS.bgSecondary, padding: 20, borderRadius: BORDER_RADIUS.md,
        alignItems: 'center', width: 100,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    scoreCardLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, fontWeight: '600' },
    scoreCardValue: { color: COLORS.textPrimary, fontSize: 32, fontWeight: '900', marginTop: 4 },
    scoreDash: { color: COLORS.textSecondary, fontSize: 24, fontWeight: '300' },

    // Powerups
    powerupRow: {
        flexDirection: 'row', justifyContent: 'center', gap: SPACING.md,
        paddingBottom: SPACING.lg, paddingTop: SPACING.sm,
    },
    powerupBtn: {
        backgroundColor: COLORS.purpleAccent + '30', paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.full,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: COLORS.purpleAccent + '60',
    },
    powerupUsed: { opacity: 0.3, backgroundColor: COLORS.bgTertiary },
    powerupIcon: { fontSize: 18 },
    powerupLabel: { color: COLORS.textPrimary, fontSize: FONT_SIZES.xs, fontWeight: '700' },
});

export default DuelBattleScreen;
