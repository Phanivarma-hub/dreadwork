import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../constants/theme';
import GameButton from '../../components/GameButton';
import studyTopics from '../../../data/study_topics.json';

const DURATIONS = [30, 45, 60, 90, 120, 180];

const TopicSelectionScreen = () => {
    const navigation = useNavigation();
    const [selectedLanguage, setSelectedLanguage] = useState(studyTopics[0]);
    const [selectedTopic, setSelectedTopic] = useState(null);
    const [selectedDuration, setSelectedDuration] = useState(30);

    const handleStartSession = () => {
        if (!selectedTopic) {
            alert('Please select a topic first!');
            return;
        }
        navigation.navigate('StudyTimer', {
            language: selectedLanguage.language,
            topic: selectedTopic,
            duration: selectedDuration,
        });
    };

    return (
        <LinearGradient colors={theme.colors.background} style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Study Mode</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                    {/* Language Selection */}
                    <Text style={styles.sectionTitle}>Select Language</Text>
                    <View style={styles.languageContainer}>
                        {studyTopics.map((lang) => (
                            <TouchableOpacity
                                key={lang.language}
                                style={[
                                    styles.languageCard,
                                    selectedLanguage.language === lang.language && styles.selectedCard,
                                ]}
                                onPress={() => {
                                    setSelectedLanguage(lang);
                                    setSelectedTopic(null);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.languageText,
                                        selectedLanguage.language === lang.language && styles.selectedText,
                                    ]}
                                >
                                    {lang.language.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Topic Selection */}
                    <Text style={styles.sectionTitle}>Select Topic</Text>
                    <View style={styles.topicContainer}>
                        {selectedLanguage.topics.map((topic) => (
                            <TouchableOpacity
                                key={topic}
                                style={[
                                    styles.topicCard,
                                    selectedTopic === topic && styles.selectedCard,
                                ]}
                                onPress={() => setSelectedTopic(topic)}
                            >
                                <Text
                                    style={[
                                        styles.topicText,
                                        selectedTopic === topic && styles.selectedText,
                                    ]}
                                >
                                    {topic}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Duration Selection */}
                    <Text style={styles.sectionTitle}>Session Duration (Minutes)</Text>
                    <View style={styles.durationContainer}>
                        {DURATIONS.map((duration) => (
                            <TouchableOpacity
                                key={duration}
                                style={[
                                    styles.durationCard,
                                    selectedDuration === duration && styles.selectedCard,
                                ]}
                                onPress={() => setSelectedDuration(duration)}
                            >
                                <Text
                                    style={[
                                        styles.durationText,
                                        selectedDuration === duration && styles.selectedText,
                                    ]}
                                >
                                    {duration}m
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.footer}>
                        <GameButton
                            title="START STUDY SESSION"
                            onPress={handleStartSession}
                            style={styles.startButton}
                        />
                    </View>
                </ScrollView>
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
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        color: theme.colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        marginLeft: 15,
        letterSpacing: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        color: theme.colors.primary,
        fontSize: 18,
        fontWeight: '600',
        marginTop: 25,
        marginBottom: 15,
        letterSpacing: 0.5,
    },
    languageContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    languageCard: {
        width: '48%',
        backgroundColor: theme.colors.surface,
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    topicContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    topicCard: {
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    durationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
    },
    durationCard: {
        width: '30%',
        backgroundColor: theme.colors.surface,
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
    },
    selectedCard: {
        borderColor: theme.colors.accent,
        backgroundColor: 'rgba(0, 243, 255, 0.1)',
    },
    languageText: {
        color: theme.colors.text,
        fontWeight: 'bold',
    },
    topicText: {
        color: theme.colors.text,
        fontSize: 14,
    },
    durationText: {
        color: theme.colors.text,
        fontWeight: 'bold',
    },
    selectedText: {
        color: theme.colors.accent,
    },
    footer: {
        marginTop: 30,
    },
    startButton: {
        height: 55,
    },
});

export default TopicSelectionScreen;
