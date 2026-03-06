import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZES } from '../constants/theme';

const XPBar = ({ currentXP, requiredXP, level }) => {
    const progress = requiredXP > 0 ? Math.min(currentXP / requiredXP, 1) : 0;

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={styles.levelText}>Level {level}</Text>
                <Text style={styles.xpText}>
                    {currentXP} / {requiredXP} XP
                </Text>
            </View>
            <View style={styles.barBackground}>
                <LinearGradient
                    colors={COLORS.gradientGreen}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.barFill, { width: `${progress * 100}%` }]}
                />
                {/* Glow overlay */}
                {progress > 0 && (
                    <View
                        style={[
                            styles.glowDot,
                            { left: `${progress * 100}%` },
                        ]}
                    />
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    levelText: {
        color: COLORS.textPrimary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    xpText: {
        color: COLORS.textSecondary,
        fontSize: FONT_SIZES.xs,
    },
    barBackground: {
        height: 10,
        backgroundColor: COLORS.xpBarBg,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
        position: 'relative',
    },
    barFill: {
        height: '100%',
        borderRadius: BORDER_RADIUS.full,
    },
    glowDot: {
        position: 'absolute',
        top: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.successGreen,
        marginLeft: -7,
        opacity: 0.6,
    },
});

export default XPBar;
