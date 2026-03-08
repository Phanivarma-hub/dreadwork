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

// Convert total RR to rank name + division
export const getRankFromRR = (totalRR) => {
    const rr = Math.max(0, totalRR);
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (rr >= RANKS[i].minRR) {
            const rrInTier = rr - RANKS[i].minRR;
            const divisionSize = (RANKS[i].maxRR - RANKS[i].minRR) / 3;
            let divIndex = Math.min(2, Math.floor(rrInTier / divisionSize));
            const divisions = ['III', 'II', 'I'];
            return {
                rank: RANKS[i].name,
                rankDivision: divisions[divIndex],
                color: RANKS[i].color,
            };
        }
    }
    return { rank: 'Bronze', rankDivision: 'III', color: RANKS[0].color };
};

// Calculate new RR and rank after a duel match
// Win: +25 RR, Loss: -15 RR (from SRS Section 10)
export const updateRankAfterMatch = (currentRR, isWin) => {
    const rrChange = isWin ? 25 : -15;
    const newRR = Math.max(0, currentRR + rrChange);
    const { rank, rankDivision } = getRankFromRR(newRR);
    return { rankPoints: newRR, rank, rankDivision, rrChange };
};
