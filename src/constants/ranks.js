// Rank definitions from the SRS
export const RANKS = [
    {
        name: 'Bronze',
        divisions: ['Bronze III', 'Bronze II', 'Bronze I'],
        color: '#CD7F32',
        minRR: 0,
        maxRR: 100,
    },
    {
        name: 'Silver',
        divisions: ['Silver III', 'Silver II', 'Silver I'],
        color: '#C0C0C0',
        minRR: 100,
        maxRR: 200,
    },
    {
        name: 'Gold',
        divisions: ['Gold III', 'Gold II', 'Gold I'],
        color: '#FFD700',
        minRR: 200,
        maxRR: 300,
    },
    {
        name: 'Platinum',
        divisions: ['Platinum III', 'Platinum II', 'Platinum I'],
        color: '#00E5FF',
        minRR: 300,
        maxRR: 400,
    },
    {
        name: 'Diamond',
        divisions: ['Diamond III', 'Diamond II', 'Diamond I'],
        color: '#7C3AED',
        minRR: 400,
        maxRR: 500,
    },
    {
        name: 'Master',
        divisions: ['Master III', 'Master II', 'Master I'],
        color: '#FF4D6D',
        minRR: 500,
        maxRR: 600,
    },
    {
        name: 'Grandmaster',
        divisions: ['Grandmaster III', 'Grandmaster II', 'Grandmaster I'],
        color: '#FF1E56',
        minRR: 600,
        maxRR: 999,
    },
];

export const getRankByName = (rankName) => {
    return RANKS.find((r) => r.name === rankName) || RANKS[0];
};

// XP formula: XP Required = 100 × (Level ^ 1.5)
export const getXPForLevel = (level) => {
    return Math.floor(100 * Math.pow(level, 1.5));
};
