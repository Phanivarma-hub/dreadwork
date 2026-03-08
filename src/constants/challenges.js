export const CHALLENGE_TYPES = {
    WIN_DUELS: 'win_duels',
    PLAY_DUELS: 'play_duels',
    PLAY_BR: 'play_br',
    WIN_BR: 'win_br',
    STUDY_SESSION: 'study_session',
};

export const CHALLENGES = [
    {
        id: 'win_2_duels',
        type: CHALLENGE_TYPES.WIN_DUELS,
        description: 'Win 2 Duels',
        target: 2,
        rewardCoins: 100,
        rewardXP: 200,
    },
    {
        id: 'play_3_duels',
        type: CHALLENGE_TYPES.PLAY_DUELS,
        description: 'Play 3 Duels',
        target: 3,
        rewardCoins: 50,
        rewardXP: 100,
    },
    {
        id: 'play_2_br',
        type: CHALLENGE_TYPES.PLAY_BR,
        description: 'Play 2 Battle Royale matches',
        target: 2,
        rewardCoins: 150,
        rewardXP: 300,
    },
    {
        id: 'complete_study',
        type: CHALLENGE_TYPES.STUDY_SESSION,
        description: 'Complete a study session',
        target: 1,
        rewardCoins: 30,
        rewardXP: 60,
    },
];
