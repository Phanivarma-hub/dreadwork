import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RANK_COLORS } from '../constants/theme';
import { BORDER_RADIUS, SPACING, FONT_SIZES, COLORS } from '../constants/theme';

const RankBadge = ({ rank = 'Bronze', division = 'III', size = 'md' }) => {
    const rankColor = RANK_COLORS[rank] || RANK_COLORS.Bronze;
    const isSmall = size === 'sm';

    return (
        <View style={[styles.badge, { borderColor: rankColor }, isSmall && styles.badgeSmall]}>
            <View style={[styles.glowRing, { backgroundColor: rankColor + '20' }]} />
            <Text
                style={[
                    styles.rankText,
                    { color: rankColor },
                    isSmall && styles.rankTextSmall,
                ]}
            >
                {rank}
            </Text>
            {!isSmall && (
                <Text style={[styles.divisionText, { color: rankColor }]}>
                    {division}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 2,
        position: 'relative',
        overflow: 'hidden',
        minWidth: 80,
    },
    badgeSmall: {
        paddingVertical: SPACING.xs,
        paddingHorizontal: SPACING.sm,
        minWidth: 60,
    },
    glowRing: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: BORDER_RADIUS.md,
    },
    rankText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    rankTextSmall: {
        fontSize: FONT_SIZES.xs,
    },
    divisionText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        marginTop: 2,
    },
});

export default RankBadge;
