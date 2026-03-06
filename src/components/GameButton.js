import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZES } from '../constants/theme';

const GameButton = ({
    title,
    onPress,
    variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
    icon,
    loading = false,
    disabled = false,
    style,
    textStyle,
}) => {
    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[disabled && styles.disabled, style]}
            >
                <LinearGradient
                    colors={disabled ? [COLORS.bgTertiary, COLORS.bgTertiary] : COLORS.gradientBlue}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryBtn}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            {icon}
                            <Text style={[styles.primaryText, textStyle]}>{title}</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    if (variant === 'secondary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[styles.secondaryBtn, disabled && styles.disabled, style]}
            >
                {loading ? (
                    <ActivityIndicator color={COLORS.primaryBlue} />
                ) : (
                    <>
                        {icon}
                        <Text style={[styles.secondaryText, textStyle]}>{title}</Text>
                    </>
                )}
            </TouchableOpacity>
        );
    }

    if (variant === 'danger') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                activeOpacity={0.8}
                style={[styles.dangerBtn, disabled && styles.disabled, style]}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <>
                        {icon}
                        <Text style={[styles.primaryText, textStyle]}>{title}</Text>
                    </>
                )}
            </TouchableOpacity>
        );
    }

    // ghost variant
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.7}
            style={[styles.ghostBtn, disabled && styles.disabled, style]}
        >
            <Text style={[styles.ghostText, textStyle]}>{title}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        gap: SPACING.sm,
    },
    primaryText: {
        color: '#FFFFFF',
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        borderColor: COLORS.primaryBlue,
        backgroundColor: COLORS.bgSecondary,
        gap: SPACING.sm,
    },
    secondaryText: {
        color: COLORS.primaryBlue,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    dangerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.dangerRed,
        gap: SPACING.sm,
    },
    ghostBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
    },
    ghostText: {
        color: COLORS.primaryBlue,
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    disabled: {
        opacity: 0.5,
    },
});

export default GameButton;
