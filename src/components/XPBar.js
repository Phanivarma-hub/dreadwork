import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, BORDER_RADIUS, SPACING, FONT_SIZES } from '../constants/theme';

const XPBar = ({ currentXP, requiredXP, level }) => {
    const progress = requiredXP > 0 ? Math.min(currentXP / requiredXP, 1) : 0;
    const animatedWidth = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedWidth, {
            toValue: progress,
            duration: 800,
            useNativeDriver: false, // width is not supported by native driver
        }).start();
    }, [progress]);

    return (
        <View style={styles.container}>
            <View style={styles.labelRow}>
                <Text style={styles.levelText}>Level {level}</Text>
                <Text style={styles.xpText}>
                    {currentXP} / {requiredXP} XP
                </Text>
            </View>
            <View style={styles.barBackground}>
                <Animated.View
                    style={[
                        styles.barFillContainer,
                        {
                            width: animatedWidth.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%']
                            })
                        }
                    ]}
                >
                    <LinearGradient
                        colors={COLORS.gradientGreen}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.barFill}
                    />
                </Animated.View>

                {/* Dynamic Glow dot */}
                <Animated.View
                    style={[
                        styles.glowDot,
                        {
                            left: animatedWidth.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%']
                            })
                        },
                        {
                            opacity: animatedWidth.interpolate({
                                inputRange: [0, 0.05],
                                outputRange: [0, 0.6],
                                extrapolate: 'clamp'
                            })
                        }
                    ]}
                />
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
    barFillContainer: {
        height: '100%',
        borderRadius: BORDER_RADIUS.full,
        overflow: 'hidden',
    },
    barFill: {
        width: '100%',
        height: '100%',
    },
    glowDot: {
        position: 'absolute',
        top: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: COLORS.successGreen,
        marginLeft: -7,
        shadowColor: COLORS.successGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 5,
    },
});

export default XPBar;
