import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Animated, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme, COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';
import mcqQuestions from '../../../data/mcq_questions.json';
import { db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import soundService from '../../services/soundService';

const QuizScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { language, topic, duration, sessionId } = route.params;

    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const timerRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const filterQuestions = () => {
            console.log(`QuizScreen: Filtering for ${language} - ${topic}`);
            const studyTopic = topic.toLowerCase();

            // Extract keywords. Keep 'c' if that's the language.
            const keywords = studyTopic
                .split(/[ &(/,)]+/)
                .filter(k => k.length > 2 || (language.toLowerCase() === 'c' && k === 'c'));

            console.log('QuizScreen: Searching with keywords:', keywords);

            // 1. Level 1: Strict match - topic or tag match
            const exactMatches = mcqQuestions.filter(q => {
                if (q.language.toLowerCase() !== language.toLowerCase()) return false;
                const qTopic = q.topic.toLowerCase();
                const qTags = (q.tags || []).map(t => t.toLowerCase());

                // Exact topic match
                if (qTopic === studyTopic) return true;

                // Any keyword matches the question's topic or tags
                return keywords.some(k => qTopic.includes(k) || qTags.some(tag => tag.includes(k)));
            });

            console.log(`QuizScreen: Found ${exactMatches.length} exact matches`);
            let pool = [...exactMatches];

            // 2. Level 2: Related match - if not enough, search in question text
            if (pool.length < 5) {
                const related = mcqQuestions.filter(q => {
                    if (q.language.toLowerCase() !== language.toLowerCase()) return false;
                    if (pool.some(p => p.id === q.id)) return false;

                    const qText = q.question.toLowerCase();
                    const qExp = (q.explanation || "").toLowerCase();
                    return keywords.some(k => qText.includes(k) || qExp.includes(k));
                });
                console.log(`QuizScreen: Found ${related.length} related matches via text`);
                pool = [...pool, ...related];
            }

            // 3. Level 3: Language fallback - if still < 5, fill with random from same language
            if (pool.length < 5) {
                console.log('QuizScreen: Not enough questions found, falling back to language pool');
                const others = mcqQuestions.filter(q =>
                    q.language.toLowerCase() === language.toLowerCase() &&
                    !pool.some(p => p.id === q.id)
                );
                pool = [...pool, ...others];
            }

            // Shuffle and take 5
            const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 5);
            console.log('QuizScreen: Selected pool size:', shuffled.length);
            setQuestions(shuffled);
        };

        filterQuestions();
        startTimer();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const startTimer = () => {
        setTimeLeft(30);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    handleAnswer(null); // Time out
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleAnswer = (option) => {
        if (isAnswered) return;

        clearInterval(timerRef.current);
        setSelectedOption(option);
        setIsAnswered(true);

        const currentQuestion = questions[currentQuestionIndex];
        if (option === currentQuestion.correctAnswer) {
            setScore(prev => prev + 1);
            soundService.playSound('correct');
        } else {
            soundService.playSound('wrong');
        }

        setTimeout(() => {
            if (currentQuestionIndex < questions.length - 1) {
                // Next question with animation
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true
                }).start(() => {
                    setCurrentQuestionIndex(prev => prev + 1);
                    setSelectedOption(null);
                    setIsAnswered(false);
                    startTimer();
                    Animated.timing(fadeAnim, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true
                    }).start();
                });
            } else {
                finishQuiz();
            }
        }, 1500);
    };

    const finishQuiz = async () => {
        try {
            if (sessionId) {
                await updateDoc(doc(db, 'studySessions', sessionId), {
                    completed: true,
                    score: score + (selectedOption === questions[currentQuestionIndex].correctAnswer ? 1 : 0),
                    totalQuestions: questions.length,
                    endTime: new Date(),
                });
            }
        } catch (error) {
            console.error('Error updating session:', error);
        }

        navigation.replace('Reward', {
            score: score + (selectedOption === questions[currentQuestionIndex].correctAnswer ? 1 : 0),
            totalQuestions: questions.length,
            language,
            topic,
            duration
        });
    };

    if (questions.length === 0) {
        return (
            <LinearGradient colors={theme.colors.background} style={styles.container}>
                <SafeAreaView style={styles.center}>
                    <Text style={{ color: theme.colors.text }}>Loading Questions...</Text>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];

    return (
        <LinearGradient colors={theme.colors.background} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>Question {currentQuestionIndex + 1}/5</Text>
                        <View style={styles.progressBarBg}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${((currentQuestionIndex + 1) / 5) * 100}%` }
                                ]}
                            />
                        </View>
                    </View>
                    <View style={styles.timerContainer}>
                        <Text style={[
                            styles.timerText,
                            timeLeft < 10 && { color: COLORS.dangerRed }
                        ]}>
                            {timeLeft}s
                        </Text>
                    </View>
                </View>

                <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                    <View style={styles.questionCard}>
                        <Text style={styles.questionText}>{currentQuestion.question}</Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {currentQuestion.options.map((option, index) => {
                            let optionStyle = [styles.optionButton];
                            let textStyle = [styles.optionText];

                            if (isAnswered) {
                                if (option === currentQuestion.correctAnswer) {
                                    optionStyle.push(styles.correctOption);
                                    textStyle.push(styles.whiteText);
                                } else if (option === selectedOption) {
                                    optionStyle.push(styles.wrongOption);
                                    textStyle.push(styles.whiteText);
                                } else {
                                    optionStyle.push(styles.disabledOption);
                                }
                            } else if (selectedOption === option) {
                                optionStyle.push(styles.selectedOption);
                            }

                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={optionStyle}
                                    onPress={() => handleAnswer(option)}
                                    disabled={isAnswered}
                                >
                                    <Text style={textStyle}>{option}</Text>
                                    {isAnswered && option === currentQuestion.correctAnswer && (
                                        <Text style={styles.statusLabel}>CORRECT</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>

                {isAnswered && (
                    <View style={styles.explanationCard}>
                        <Text style={styles.explanationTitle}>EXPLANATION</Text>
                        <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
                    </View>
                )}
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
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.lg,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        padding: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    progressContainer: {
        flex: 1,
        marginRight: 20,
    },
    progressText: {
        color: COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 8,
        letterSpacing: 1,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: COLORS.bgTertiary,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primaryBlue,
    },
    timerContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        borderColor: COLORS.primaryBlue,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    timerText: {
        color: COLORS.primaryBlue,
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
    },
    questionCard: {
        backgroundColor: COLORS.bgSecondary,
        padding: 25,
        borderRadius: 20,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    questionText: {
        color: COLORS.textPrimary,
        fontSize: 20,
        lineHeight: 28,
        fontWeight: '600',
    },
    optionsContainer: {
        gap: 12,
    },
    optionButton: {
        backgroundColor: COLORS.bgSecondary,
        padding: 18,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionText: {
        color: COLORS.textPrimary,
        fontSize: 16,
        fontWeight: '500',
    },
    selectedOption: {
        borderColor: COLORS.primaryBlue,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    correctOption: {
        backgroundColor: COLORS.successGreen,
        borderColor: COLORS.successGreen,
    },
    wrongOption: {
        backgroundColor: COLORS.dangerRed,
        borderColor: COLORS.dangerRed,
    },
    disabledOption: {
        opacity: 0.5,
    },
    whiteText: {
        color: '#FFF',
    },
    statusLabel: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    explanationCard: {
        padding: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        margin: 20,
        borderRadius: 15,
    },
    explanationTitle: {
        color: COLORS.primaryBlue,
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 5,
        letterSpacing: 2,
    },
    explanationText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
});

export default QuizScreen;
