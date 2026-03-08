import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, AppState, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, SPACING } from '../../constants/theme';
import GameButton from '../../components/GameButton';
import { auth, db } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const StudyTimerScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { language, topic, duration } = route.params;

    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [isActive, setIsActive] = useState(true);
    const appState = useRef(AppState.currentState);
    const startTimeRef = useRef(Date.now());
    const [sessionId, setSessionId] = useState(null);

    useEffect(() => {
        // Create study session in Firestore
        const createSession = async () => {
            try {
                const docRef = await addDoc(collection(db, 'studySessions'), {
                    userId: auth.currentUser.uid,
                    language,
                    topic,
                    duration,
                    startTime: serverTimestamp(),
                    completed: false,
                });
                setSessionId(docRef.id);
            } catch (error) {
                console.error('Error creating study session:', error);
            }
        };

        createSession();

        const interval = setInterval(() => {
            if (isActive && timeLeft > 0) {
                setTimeLeft((prev) => prev - 1);
            } else if (timeLeft === 0) {
                clearInterval(interval);
                handleSessionComplete();
            }
        }, 1000);

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/active/) && nextAppState === 'background') {
                // Moving to background, store current time
                startTimeRef.current = Date.now();
            } else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // Moving to foreground, calculate elapsed time
                const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
                setTimeLeft((prev) => Math.max(0, prev - elapsed));
            }
            appState.current = nextAppState;
        });

        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, [isActive, timeLeft]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleSessionComplete = () => {
        setIsActive(false);
        navigation.replace('Quiz', { language, topic, duration, sessionId });
    };

    const handleEndSession = () => {
        Alert.alert(
            'End Session?',
            'You will not receive any rewards if you end the session early.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'End Anyway',
                    style: 'destructive',
                    onPress: () => navigation.navigate('Dashboard')
                },
            ]
        );
    };

    const progress = 1 - (timeLeft / (duration * 60));

    return (
        <LinearGradient colors={theme.colors.background} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Study Session</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.infoCard}>
                        <Text style={styles.label}>TOPIC</Text>
                        <Text style={styles.topicText}>{topic}</Text>
                        <Text style={styles.languageText}>{language.toUpperCase()}</Text>
                    </View>

                    <View style={styles.timerContainer}>
                        <View style={styles.timerCircle}>
                            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
                            <Text style={styles.remainingLabel}>REMAINING</Text>
                        </View>

                        {/* Simple Progress Bar */}
                        <View style={styles.progressBarContainer}>
                            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
                        </View>
                    </View>

                    <Text style={styles.hintText}>
                        You can leave the app to study. The timer will continue tracking your progress.
                    </Text>

                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleEndSession} style={styles.endButton}>
                            <Text style={styles.endButtonText}>END SESSION</Text>
                        </TouchableOpacity>

                        {/* For testing purposes, added a skip button */}
                        {__DEV__ && (
                            <TouchableOpacity
                                onPress={() => setTimeLeft(5)}
                                style={{ marginTop: 20, opacity: 0.5 }}
                            >
                                <Text style={{ color: theme.colors.text }}>[DEV] Skip to 5s</Text>
                            </TouchableOpacity>
                        )}
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
    header: {
        alignItems: 'center',
        padding: 20,
    },
    headerTitle: {
        color: theme.colors.accent,
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    content: {
        flex: 1,
        paddingHorizontal: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoCard: {
        backgroundColor: theme.colors.surface,
        width: '100%',
        padding: 25,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    label: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 5,
    },
    topicText: {
        color: theme.colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 5,
    },
    languageText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    timerContainer: {
        alignItems: 'center',
        width: '100%',
    },
    timerCircle: {
        width: 250,
        height: 250,
        borderRadius: 125,
        borderWidth: 4,
        borderColor: theme.colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 243, 255, 0.05)',
        shadowColor: theme.colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
    },
    timerText: {
        color: theme.colors.text,
        fontSize: 56,
        fontWeight: 'bold',
        fontVariant: ['tabular-nums'],
    },
    remainingLabel: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginTop: 5,
    },
    progressBarContainer: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 3,
        marginTop: 40,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: theme.colors.accent,
    },
    hintText: {
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
        fontSize: 14,
        marginTop: 30,
        lineHeight: 20,
    },
    footer: {
        marginTop: 50,
        width: '100%',
        alignItems: 'center',
    },
    endButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
    },
    endButtonText: {
        color: theme.colors.error,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});

export default StudyTimerScreen;
