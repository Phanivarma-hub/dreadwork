import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/theme';

// Screens
import LoadingScreen from '../screens/LoadingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TopicSelectionScreen from '../screens/study/TopicSelectionScreen';
import StudyTimerScreen from '../screens/study/StudyTimerScreen';
import QuizScreen from '../screens/study/QuizScreen';
import RewardScreen from '../screens/study/RewardScreen';
import DuelLobbyScreen from '../screens/duel/DuelLobbyScreen';
import DuelBattleScreen from '../screens/duel/DuelBattleScreen';
import DuelResultScreen from '../screens/duel/DuelResultScreen';
import BattleRoyaleLobbyScreen from '../screens/br/BattleRoyaleLobbyScreen';
import BattleRoyaleBattleScreen from '../screens/br/BattleRoyaleBattleScreen';
import BattleRoyaleResultScreen from '../screens/br/BattleRoyaleResultScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);
    const [authLoaded, setAuthLoaded] = useState(false);
    const [timedOut, setTimedOut] = useState(false);

    useEffect(() => {
        // Minimum 3 second delay for branding
        const timer = setTimeout(() => {
            setTimedOut(true);
        }, 3000);

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoaded(true);
        });

        return () => {
            unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    useEffect(() => {
        if (authLoaded && timedOut) {
            setInitializing(false);
        }
    }, [authLoaded, timedOut]);

    if (initializing) {
        return <LoadingScreen />;
    }

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: COLORS.bgPrimary },
                    animation: 'fade',
                }}
            >
                {user ? (
                    // Authenticated screens
                    <>
                        <Stack.Screen name="Dashboard" component={DashboardScreen} />
                        {/* Study Mode Screens */}
                        <Stack.Screen name="TopicSelection" component={TopicSelectionScreen} />
                        <Stack.Screen name="StudyTimer" component={StudyTimerScreen} />
                        <Stack.Screen name="Quiz" component={QuizScreen} />
                        <Stack.Screen name="Reward" component={RewardScreen} />
                        {/* Duel Mode Screens */}
                        <Stack.Screen name="DuelLobby" component={DuelLobbyScreen} />
                        <Stack.Screen name="DuelBattle" component={DuelBattleScreen} />
                        <Stack.Screen name="DuelResult" component={DuelResultScreen} />
                        {/* Battle Royale Screens */}
                        <Stack.Screen name="BattleRoyaleLobby" component={BattleRoyaleLobbyScreen} />
                        <Stack.Screen name="BattleRoyaleBattle" component={BattleRoyaleBattleScreen} />
                        <Stack.Screen name="BattleRoyaleResult" component={BattleRoyaleResultScreen} />
                    </>
                ) : (
                    // Auth screens
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bgPrimary,
    },
});

export default AppNavigator;
