import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { COLORS } from '../constants/theme';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TopicSelectionScreen from '../screens/study/TopicSelectionScreen';
import StudyTimerScreen from '../screens/study/StudyTimerScreen';
import QuizScreen from '../screens/study/QuizScreen';
import RewardScreen from '../screens/study/RewardScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
    const [user, setUser] = useState(null);
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (initializing) setInitializing(false);
        });
        return unsubscribe;
    }, []);

    if (initializing) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={COLORS.primaryBlue} />
            </View>
        );
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
