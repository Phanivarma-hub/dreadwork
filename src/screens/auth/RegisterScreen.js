import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import GameButton from '../../components/GameButton';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

const RegisterScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        // Validation
        if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }
        if (username.trim().length < 3) {
            Alert.alert('Error', 'Username must be at least 3 characters');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            // 1. Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;

            // 2. Update display name
            await updateProfile(user, { displayName: username.trim() });

            // 3. Create Firestore user document with default values from SRS
            await setDoc(doc(db, 'users', user.uid), {
                userId: user.uid,
                username: username.trim(),
                email: email.trim(),

                // Progression
                level: 1,
                xp: 0,

                // Rank
                rank: 'Bronze',
                rankDivision: 'III',
                rankPoints: 0,

                // Economy
                coins: 0,

                // Equipment
                equippedSword: null,
                equippedPowerups: [],

                // Stats
                matchesPlayed: 0,
                wins: 0,
                losses: 0,
                studyHours: 0,
                accuracy: 0,

                // Streak
                streakDays: 0,
                lastLogin: serverTimestamp(),
                dailyClaimed: false,

                createdAt: serverTimestamp(),
            });

            // Navigation handled by auth state listener in AppNavigator
        } catch (error) {
            let message = 'Registration failed. Please try again.';
            if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
            else if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
            else if (error.code === 'auth/weak-password') message = 'Password is too weak. Use at least 6 characters.';
            Alert.alert('Registration Failed', message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo Area */}
                    <View style={styles.logoSection}>
                        <LinearGradient
                            colors={COLORS.gradientBlue}
                            style={styles.logoIcon}
                        >
                            <Text style={styles.logoEmoji}>⚔️</Text>
                        </LinearGradient>
                        <Text style={styles.title}>DREADWORK</Text>
                        <Text style={styles.subtitle}>Join the Arena</Text>
                    </View>

                    {/* Registration Form */}
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Create Your Warrior</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>USERNAME</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Choose a battle name"
                                placeholderTextColor={COLORS.textDisabled}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={20}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>EMAIL</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor={COLORS.textDisabled}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>PASSWORD</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Minimum 6 characters"
                                placeholderTextColor={COLORS.textDisabled}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Re-enter your password"
                                placeholderTextColor={COLORS.textDisabled}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry
                            />
                        </View>

                        <GameButton
                            title="FORGE YOUR WARRIOR"
                            onPress={handleRegister}
                            loading={loading}
                            style={styles.registerBtn}
                        />

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <GameButton
                            title="Already have an account? Login"
                            variant="ghost"
                            onPress={() => navigation.navigate('Login')}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.bgPrimary,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.xl,
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logoIcon: {
        width: 70,
        height: 70,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
    },
    logoEmoji: {
        fontSize: 36,
    },
    title: {
        fontSize: FONT_SIZES.xxl,
        fontWeight: '900',
        color: COLORS.textPrimary,
        letterSpacing: 4,
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.purpleAccent,
        letterSpacing: 2,
        marginTop: SPACING.xs,
        textTransform: 'uppercase',
    },
    formCard: {
        backgroundColor: COLORS.bgSecondary,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.bgTertiary,
    },
    formTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
    },
    inputGroup: {
        marginBottom: SPACING.md,
    },
    inputLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textSecondary,
        letterSpacing: 1.5,
        marginBottom: SPACING.xs,
    },
    input: {
        backgroundColor: COLORS.bgPrimary,
        borderRadius: BORDER_RADIUS.sm,
        padding: SPACING.md,
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.md,
        borderWidth: 1,
        borderColor: COLORS.bgTertiary,
    },
    registerBtn: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.md,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.bgTertiary,
    },
    dividerText: {
        color: COLORS.textDisabled,
        fontSize: FONT_SIZES.xs,
        marginHorizontal: SPACING.md,
        letterSpacing: 2,
    },
});

export default RegisterScreen;
