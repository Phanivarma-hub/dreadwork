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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import GameButton from '../../components/GameButton';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (error) {
            let message = 'Login failed. Please try again.';
            if (error.code === 'auth/user-not-found') message = 'No account found with this email.';
            else if (error.code === 'auth/wrong-password') message = 'Incorrect password.';
            else if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
            else if (error.code === 'auth/invalid-credential') message = 'Invalid email or password.';
            Alert.alert('Login Failed', message);
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
                        <Text style={styles.subtitle}>Code. Fight. Conquer.</Text>
                    </View>

                    {/* Login Form */}
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Welcome Back, Warrior</Text>

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
                                placeholder="Enter your password"
                                placeholderTextColor={COLORS.textDisabled}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <GameButton
                            title="ENTER THE ARENA"
                            onPress={handleLogin}
                            loading={loading}
                            style={styles.loginBtn}
                        />

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <GameButton
                            title="Create New Account"
                            variant="secondary"
                            onPress={() => navigation.navigate('Register')}
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
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    logoIcon: {
        width: 80,
        height: 80,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    logoEmoji: {
        fontSize: 40,
    },
    title: {
        fontSize: FONT_SIZES.hero,
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
    loginBtn: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.md,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: SPACING.md,
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

export default LoginScreen;
