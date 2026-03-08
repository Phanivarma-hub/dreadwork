import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
    Animated,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

const { width } = Dimensions.get('window');

const LoadingScreen = () => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Entrance animation
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            }),
        ]).start();

        // Continuous pulse for the text
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={[COLORS.bgPrimary, '#020617']}
                style={StyleSheet.absoluteFill}
            />

            <Animated.View style={[
                styles.content,
                {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }]
                }
            ]}>
                <View style={styles.logoContainer}>
                    <Image
                        source={require('../../assets/screen.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />
                </View>

                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <Text style={styles.title}>DREADWORK</Text>
                </Animated.View>

                <Text style={styles.subtitle}>MASTER YOUR CODE</Text>

                <View style={styles.loaderBarContainer}>
                    <View style={styles.loaderBar} />
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bgPrimary,
    },
    content: {
        alignItems: 'center',
    },
    logoContainer: {
        width: width * 0.5,
        height: width * 0.5,
        marginBottom: 20,
        // Glow effect
        shadowColor: COLORS.primaryBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    logo: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 40,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 4,
        textShadowColor: 'rgba(59, 130, 246, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primaryBlue,
        marginTop: 5,
        letterSpacing: 2,
        opacity: 0.8,
    },
    loaderBarContainer: {
        width: width * 0.6,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginTop: 40,
        borderRadius: 1,
        overflow: 'hidden',
    },
    loaderBar: {
        width: '30%',
        height: '100%',
        backgroundColor: COLORS.primaryBlue,
        // We could animate this but a static "loading" feel is fine for a start
    }
});

export default LoadingScreen;
