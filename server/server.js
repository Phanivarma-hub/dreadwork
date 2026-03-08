const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// ── Firebase Admin SDK ──
const admin = require("firebase-admin");

// ── Groq AI SDK for explanation grading ──
const Groq = require("groq-sdk");

// Groq API keys with rotation for rate-limit resilience
const GROQ_API_KEYS = [
    process.env.GROQ_KEY_1,
    process.env.GROQ_KEY_2,
    process.env.GROQ_KEY_3,
];
let currentKeyIndex = 0;

function getGroqClient() {
    const key = GROQ_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % GROQ_API_KEYS.length;
    return new Groq({ apiKey: key });
}

// Initialize Firebase Admin
try {
    admin.initializeApp({
        projectId: "dreadworrk",
    });
    console.log("✅ Firebase Admin initialized");
} catch (err) {
    console.log("Firebase Admin already initialized or error:", err.message);
}

const db = admin.firestore();

// ── Load Question Data ──
const mcqQuestions = require("../data/mcq_questions.json");
const codeQuestions = require("../data/code_questions.json");
const explanationQuestions = require("../data/explanation_questions.json");

// ── Express + Socket.io Setup ──
const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
});

// Health check endpoint
app.get("/", (req, res) => {
    res.json({ status: "DreadWork Duel Server running", players: Object.keys(connectedPlayers).length });
});

// ════════════════════════════════════════════════
//  IN-MEMORY STATE
// ════════════════════════════════════════════════

// Connected players: socketId -> { userId, username, rank, socketId }
const connectedPlayers = {};

// Matchmaking queues: topic -> [{ userId, username, rank, socketId, matchType }]
const matchQueues = {};

// Battle Royale matchmaking queues: topic -> { players: [], startTime: timestamp, timerId: timeoutId }
const brQueues = {};

// Active game rooms: roomId -> { players, questions, answers, currentRound, state, timers }
const gameRooms = {};

// Active Battle Royale rooms: roomId -> { state, topic, players, roundNumber, aliveCount, questionPool, timers }
const brRooms = {};

// ════════════════════════════════════════════════
//  QUESTION SELECTION
// ════════════════════════════════════════════════

function getRandomQuestion(pool, language) {
    const lang = language.toLowerCase();
    const filtered = pool.filter((q) => q.language.toLowerCase() === lang);
    const source = filtered.length > 0 ? filtered : pool;
    return source[Math.floor(Math.random() * source.length)];
}

function selectQuestionsForMatch(language, count = 3, excludeExplanation = false) {
    const lang = language.toLowerCase();
    let pool = [
        ...mcqQuestions.filter(q => q.language.toLowerCase() === lang),
        ...codeQuestions.filter(q => q.language.toLowerCase() === lang)
    ];

    if (!excludeExplanation) {
        pool = [...pool, ...explanationQuestions.filter(q => q.language.toLowerCase() === lang)];
    }

    const selected = [];
    const usedIndices = new Set();
    const maxToSelect = Math.min(count, pool.length);

    while (selected.length < maxToSelect && usedIndices.size < pool.length) {
        const idx = Math.floor(Math.random() * pool.length);
        if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            selected.push(pool[idx]);
        }
    }
    return selected;
}

// ════════════════════════════════════════════════
//  MATCHMAKING
// ════════════════════════════════════════════════

function findMatch(topic) {
    const queue = matchQueues[topic];
    if (!queue || queue.length < 2) return null;

    // Take the first two players from the queue
    const player1 = queue.shift();
    const player2 = queue.shift();

    return [player1, player2];
}

function startBRMatchmakingTimer(topic) {
    if (brQueues[topic].timerId) return;

    brQueues[topic].timerId = setTimeout(() => {
        const players = brQueues[topic].players;
        if (players.length >= 2) {
            console.log(`⏰ BR Queue timeout for ${topic}. Starting with ${players.length} players.`);
            const matchedPlayers = [...players];
            brQueues[topic].players = [];
            brQueues[topic].timerId = null;

            const room = createBRMatch(matchedPlayers, topic);
            startBRMatch(room);
        } else {
            console.log(`⏰ BR Queue timeout for ${topic}. Not enough players (< 2).`);
            brQueues[topic].timerId = null;
            // Timer will restart when next player joins
        }
    }, 5000); // 5 seconds
}

function createBRMatch(players, topic) {
    const roomId = "br_room_" + Date.now() + "_" + Math.random().toString(36).substring(7);

    // Prefetch 30 questions for the whole match, excluding short-answer/explanation types
    const questionPool = selectQuestionsForMatch(topic, 30, true);

    const roomPlayers = {};
    players.forEach(p => {
        roomPlayers[p.socketId] = {
            userId: p.userId,
            username: p.username,
            rank: p.rank,
            socketId: p.socketId,
            hp: 150,
            status: 'alive',
            placement: 0,
            targetId: null,
            attackers: []
        };
    });

    const room = {
        roomId,
        state: 'waiting',
        topic,
        players: roomPlayers,
        roundNumber: 0,
        aliveCount: players.length,
        questionPool,
        timers: {},
        combatData: {}, // { attackerId: { targetId, attackerCorrect, targetCorrect, ... } }
        createdAt: Date.now()
    };

    brRooms[roomId] = room;

    players.forEach(p => {
        const socket = io.sockets.sockets.get(p.socketId);
        if (socket) socket.join(roomId);
    });

    return room;
}

function createMatch(players, topic) {
    const roomId = "room_" + Date.now() + "_" + Math.random().toString(36).substring(7);
    const qArray = selectQuestionsForMatch(topic, 3);
    const questions = {
        round1: qArray[0],
        round2: qArray[1],
        round3: qArray[2]
    };

    const room = {
        roomId,
        topic,
        matchType: players[0].matchType || "ranked",
        players: {
            [players[0].socketId]: {
                userId: players[0].userId,
                username: players[0].username,
                rank: players[0].rank,
                socketId: players[0].socketId,
                score: 0,
                hp: 100,
            },
            [players[1].socketId]: {
                userId: players[1].userId,
                username: players[1].username,
                rank: players[1].rank,
                socketId: players[1].socketId,
                score: 0,
                hp: 100,
            },
        },
        questions,
        currentRound: 0,
        answers: {}, // { round: { socketId: answer } }
        state: "starting", // starting | playing | round_result | finished
        timers: {},
        createdAt: Date.now(),
    };

    gameRooms[roomId] = room;

    // Join Socket.io room
    players.forEach((p) => {
        const socket = io.sockets.sockets.get(p.socketId);
        if (socket) socket.join(roomId);
    });

    return room;
}

function startMatch(room) {
    const playerArray = Object.values(room.players);

    // For 1v1 Duels, send individual 'matchFound' with 'opponent' object
    playerArray.forEach(player => {
        const opponent = playerArray.find(p => p.socketId !== player.socketId);
        io.to(player.socketId).emit("matchFound", {
            roomId: room.roomId,
            topic: room.topic,
            matchType: room.matchType,
            opponent: {
                username: opponent?.username || "Opponent",
                rank: opponent?.rank || "Bronze"
            },
            players: playerArray.map(p => ({
                userId: p.userId,
                username: p.username,
                rank: p.rank,
                hp: p.hp
            }))
        });
    });

    setTimeout(() => {
        startRound(room.roomId);
    }, 3000);
}

function startRound(roomId) {
    const room = gameRooms[roomId];
    if (!room || room.state === "finished") return;

    room.state = "playing";
    const roundIndex = room.currentRound;
    const roundNames = ["round1", "round2", "round3"];
    const roundTypes = ["mcq", "explanation", "code_output"];
    const question = room.questions[roundNames[roundIndex]];

    if (!question) return;

    io.to(roomId).emit("question", {
        round: roundIndex + 1,
        type: roundTypes[roundIndex],
        question: question.question,
        options: question.options || null,
        timer: roundTypes[roundIndex] === "mcq" ? 20 : 60,
    });

    const timeout = (roundTypes[roundIndex] === "mcq" ? 22 : 62) * 1000;
    room.timers[roundIndex] = setTimeout(() => {
        processRoundEnd(roomId);
    }, timeout);
}

function startBRMatch(room) {
    const playerArray = Object.values(room.players);

    // Notify all players
    io.to(room.roomId).emit("br:matchFound", {
        roomId: room.roomId,
        topic: room.topic,
        players: playerArray.map(p => ({
            userId: p.userId,
            username: p.username,
            rank: p.rank,
            hp: p.hp,
            socketId: p.socketId
        }))
    });

    // Start target selection after 5s intro
    setTimeout(() => {
        startBRTargetSelection(room.roomId);
    }, 5000);
}

// ════════════════════════════════════════════════
//  GAME FLOW
// ════════════════════════════════════════════════

function startBRTargetSelection(roomId) {
    const room = brRooms[roomId];
    if (!room || room.state === 'finished') return;

    room.state = 'selecting_target';
    room.combatData = {}; // Reset combat data for the new round

    // Clear previous attacker lists
    Object.values(room.players).forEach(p => p.attackers = []);

    io.to(roomId).emit("br:selectTarget", {
        endTime: Date.now() + 10000, // 10 seconds to select
        players: Object.values(room.players).map(p => ({
            socketId: p.socketId,
            username: p.username,
            hp: p.hp,
            status: p.status,
            attackersCount: p.attackers.length
        }))
    });

    // Plan to move to combat after 10s
    room.timers.targetSelection = setTimeout(() => {
        finalizeBRTargets(roomId);
    }, 11000); // 1s grace
}

function finalizeBRTargets(roomId) {
    const room = brRooms[roomId];
    if (!room || room.state !== 'selecting_target') return;

    // Assign random targets to players who haven't selected one
    const alivePlayers = Object.values(room.players).filter(p => p.status === 'alive');

    alivePlayers.forEach(player => {
        if (!player.targetId) {
            const potentialTargets = alivePlayers.filter(p =>
                p.socketId !== player.socketId &&
                p.attackers.length < 2
            );

            if (potentialTargets.length > 0) {
                const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)];
                player.targetId = target.socketId;
                target.attackers.push(player.socketId);
            } else {
                // If everyone is fully booked (rare with max 2 attackers), just pick someone randomly ignoring the limit if needed to ensure combat happens
                const fallbackTargets = alivePlayers.filter(p => p.socketId !== player.socketId);
                const target = fallbackTargets[Math.floor(Math.random() * fallbackTargets.length)];
                player.targetId = target.socketId;
                target.attackers.push(player.socketId);
            }
        }
    });

    startBRCombat(roomId);
}

function startBRCombat(roomId) {
    const room = brRooms[roomId];
    if (!room) return;

    room.state = 'combat';
    room.roundNumber += 1;

    const alivePlayers = Object.values(room.players).filter(p => p.status === 'alive');

    alivePlayers.forEach(player => {
        // Attack Question (30s)
        const attackQuestion = room.questionPool[Math.floor(Math.random() * room.questionPool.length)];

        // Target's Defense Question (20s) - same difficulty or same question type? 
        // Let's keep it simple: both get a question from the pool.
        const socket = io.sockets.sockets.get(player.socketId);
        if (socket) {
            socket.emit("br:attackQuestion", {
                question: attackQuestion,
                targetId: player.targetId,
                targetUsername: room.players[player.targetId].username,
                timer: 30
            });

            // Also notify the target they are being attacked
            const targetSocket = io.sockets.sockets.get(player.targetId);
            if (targetSocket) {
                const defenseQuestion = room.questionPool[Math.floor(Math.random() * room.questionPool.length)];
                targetSocket.emit("br:defenseQuestion", {
                    question: defenseQuestion,
                    attackerId: player.socketId,
                    attackerUsername: player.username,
                    timer: 20
                });
            }
        }
    });

    // Round resolution timer
    room.timers.combat = setTimeout(() => {
        resolveBRRound(roomId);
    }, 32000); // 30s + 2s grace
}

function resolveBRRound(roomId) {
    const room = brRooms[roomId];
    if (!room || room.state !== 'combat') return;

    room.state = 'round_result';

    const alivePlayers = Object.values(room.players).filter(p => p.status === 'alive');
    const roundResults = {}; // attackerId -> { damage, killed, attackerCorrect, targetCorrect }

    alivePlayers.forEach(attacker => {
        const target = room.players[attacker.targetId];
        if (!target) return;

        const combatKey = `${attacker.socketId}_vs_${target.socketId}`;
        const data = room.combatData[combatKey] || { attackerCorrect: false, targetCorrect: false };

        let damage = 0;
        if (data.attackerCorrect) {
            damage = data.targetCorrect ? 5 : 20;
        }

        // Apply Sudden Death multiplier (Round 5+)
        if (room.roundNumber >= 5) {
            damage = Math.floor(damage * 1.5);
        }

        target.hp = Math.max(0, target.hp - damage);

        roundResults[attacker.socketId] = {
            targetId: target.socketId,
            damage,
            attackerCorrect: data.attackerCorrect,
            targetCorrect: data.targetCorrect
        };

        if (target.hp <= 0 && target.status === 'alive') {
            target.status = 'eliminated';
            target.placement = room.aliveCount;
            room.aliveCount -= 1;
        }
    });

    // Notify all players of results
    io.to(roomId).emit("br:roundResult", {
        round: room.roundNumber,
        results: roundResults,
        players: Object.values(room.players).map(p => ({
            socketId: p.socketId,
            hp: p.hp,
            status: p.status
        }))
    });

    // Check game over
    if (room.aliveCount <= 1) {
        setTimeout(() => endBRMatch(roomId), 4000);
    } else {
        setTimeout(() => startBRTargetSelection(roomId), 5000);
    }
}

async function endBRMatch(roomId) {
    const room = brRooms[roomId];
    if (!room) return;

    room.state = 'finished';
    const winner = Object.values(room.players).find(p => p.status === 'alive') ||
        Object.values(room.players).sort((a, b) => b.hp - a.hp)[0];

    if (winner) {
        winner.placement = 1;
    }

    io.to(roomId).emit("br:gameOver", {
        winnerId: winner?.socketId,
        rankings: Object.values(room.players).map(p => ({
            userId: p.userId,
            username: p.username,
            placement: p.placement || 1
        })).sort((a, b) => a.placement - b.placement)
    });

    // Save to Firestore (similar to duel matches but in brMatches collection)
    try {
        await db.collection("brMatches").add({
            topic: room.topic,
            winnerId: winner?.userId,
            players: Object.values(room.players).map(p => ({
                userId: p.userId,
                username: p.username,
                placement: p.placement || 1
            })),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error("Error saving BR match:", err.message);
    }

    // Cleanup
    delete brRooms[roomId];
}

/**
 * AI-based grading for explanation answers using Groq LLaMA.
 * Returns { score: 0-100, correct: boolean, feedback: string }
 */
async function gradeExplanationWithAI(question, correctAnswer, playerAnswer) {
    if (!playerAnswer || playerAnswer.trim().length < 5) {
        return { score: 0, correct: false, feedback: "Answer too short." };
    }

    try {
        const groq = getGroqClient();
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `You are a strict coding exam grader. Grade the student's explanation answer against the correct answer.
Evaluate on:
1. Accuracy (does it match the correct concept?)
2. Completeness (does it cover the key points?)
3. Relevance (is it on-topic?)

Respond ONLY with a JSON object, no other text:
{"score": <0-100>, "feedback": "<one line reason>"}`
                },
                {
                    role: "user",
                    content: `Question: ${question}\n\nCorrect Answer: ${correctAnswer}\n\nStudent's Answer: ${playerAnswer}`
                }
            ],
            temperature: 0.1,
            max_tokens: 150,
        });

        const responseText = completion.choices[0]?.message?.content || "";
        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const score = Math.min(100, Math.max(0, parseInt(parsed.score) || 0));
            return {
                score,
                correct: score >= 50,
                feedback: parsed.feedback || "Graded by AI.",
            };
        }
        // Fallback if JSON parsing fails
        return { score: 50, correct: true, feedback: "Could not parse AI response, accepted." };
    } catch (err) {
        console.error("⚠️ AI grading error:", err.message);
        // Fallback: accept if >= 15 chars
        const fallback = playerAnswer && playerAnswer.trim().length >= 15;
        return { score: fallback ? 60 : 0, correct: fallback, feedback: "AI unavailable, length-based fallback." };
    }
}

async function processRoundEnd(roomId) {
    const room = gameRooms[roomId];
    if (!room || room.state === "finished") return;

    // Clear timer
    if (room.timers[room.currentRound]) {
        clearTimeout(room.timers[room.currentRound]);
    }

    const roundIndex = room.currentRound;
    const roundNames = ["round1", "round2", "round3"];
    const roundTypes = ["mcq", "explanation", "code_output"];
    const question = room.questions[roundNames[roundIndex]];
    const answers = room.answers[roundIndex] || {};

    const playerSockets = Object.keys(room.players);
    const results = {};

    // ── Grade all answers (AI for explanation, exact match for others) ──
    const isExplanationRound = roundTypes[roundIndex] === "explanation";

    if (isExplanationRound) {
        // Grade both players' explanations in parallel using AI
        const gradingPromises = playerSockets.map(async (socketId) => {
            const answer = answers[socketId];
            const gradeResult = await gradeExplanationWithAI(
                question.question,
                question.correctAnswer || question.answer || "",
                answer
            );
            console.log(`🤖 AI Grade for ${room.players[socketId].username}: ${gradeResult.score}/100 - ${gradeResult.feedback}`);
            results[socketId] = {
                answer: answer || null,
                correct: gradeResult.correct,
                aiScore: gradeResult.score,
                aiFeedback: gradeResult.feedback,
                username: room.players[socketId].username,
            };
            if (gradeResult.correct) {
                room.players[socketId].score += 1;
            }
            if (!gradeResult.correct) {
                room.players[socketId].hp = Math.max(0, room.players[socketId].hp - 33);
            }
        });
        await Promise.all(gradingPromises);
    } else {
        // MCQ or Code Output: exact match
        playerSockets.forEach((socketId) => {
            const answer = answers[socketId];
            const isCorrect = answer === question.correctAnswer;
            results[socketId] = {
                answer: answer || null,
                correct: isCorrect,
                username: room.players[socketId].username,
            };
            if (isCorrect) {
                room.players[socketId].score += 1;
            }
            if (!isCorrect) {
                room.players[socketId].hp = Math.max(0, room.players[socketId].hp - 33);
            }
        });
    }

    room.state = "round_result";

    // Build result data for each player
    playerSockets.forEach((socketId) => {
        const opponent = playerSockets.find((s) => s !== socketId);
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit("roundResult", {
                round: roundIndex + 1,
                yourResult: results[socketId].correct,
                opponentResult: results[opponent]?.correct || false,
                opponentUsername: room.players[opponent]?.username || "Opponent",
                scores: {
                    you: room.players[socketId].score,
                    opponent: room.players[opponent]?.score || 0,
                },
                hp: {
                    you: room.players[socketId].hp,
                    opponent: room.players[opponent]?.hp || 0,
                },
                correctAnswer: question.correctAnswer || null,
                // AI grading details (only for explanation rounds)
                aiScore: results[socketId].aiScore || null,
                aiFeedback: results[socketId].aiFeedback || null,
            });
        }
    });

    // Check if match is over
    if (roundIndex >= 2) {
        // Match finished after round 3
        setTimeout(() => endMatch(roomId), 3000);
    } else {
        // Next round after delay
        room.currentRound += 1;
        setTimeout(() => startRound(roomId), 3500);
    }
}

async function endMatch(roomId) {
    const room = gameRooms[roomId];
    if (!room) return;

    room.state = "finished";
    const playerSockets = Object.keys(room.players);

    // Determine winner
    const p1 = room.players[playerSockets[0]];
    const p2 = room.players[playerSockets[1]];

    let winner, loser, isDraw = false;
    if (p1.score > p2.score) {
        winner = p1; loser = p2;
    } else if (p2.score > p1.score) {
        winner = p2; loser = p1;
    } else {
        isDraw = true;
        winner = p1; loser = p2; // arbitrary for draw
    }

    // Send match end to each player
    playerSockets.forEach((socketId) => {
        const me = room.players[socketId];
        const opponent = playerSockets.find((s) => s !== socketId);
        const opponentData = room.players[opponent];

        const playerWon = !isDraw && me.userId === winner.userId;

        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            socket.emit("matchEnd", {
                playerWon,
                isDraw,
                playerScore: me.score,
                opponentScore: opponentData?.score || 0,
                opponentName: opponentData?.username || "Opponent",
                language: room.topic,
                matchType: room.matchType,
            });

            // Leave the room
            socket.leave(roomId);
        }
    });

    // Save match to Firestore
    try {
        await db.collection("matches").add({
            player1: p1.userId,
            player2: p2.userId,
            player1Username: p1.username,
            player2Username: p2.username,
            winner: isDraw ? "draw" : winner.userId,
            topic: room.topic,
            player1Score: p1.score,
            player2Score: p2.score,
            rankMatch: room.matchType === "ranked",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`📝 Match saved: ${p1.username} vs ${p2.username}`);
    } catch (err) {
        console.error("Error saving match:", err.message);
    }

    // Cleanup
    delete gameRooms[roomId];
}

// ════════════════════════════════════════════════
//  SOCKET.IO EVENT HANDLERS
// ════════════════════════════════════════════════

io.on("connection", (socket) => {
    console.log(`🔌 Connected: ${socket.id}`);

    // ── Register Player ──
    socket.on("register", (data) => {
        const { userId, username, rank } = data;
        connectedPlayers[socket.id] = { userId, username, rank, socketId: socket.id };
        console.log(`👤 Registered: ${username} (${socket.id})`);
    });

    // ── Join Matchmaking Queue ──
    socket.on("joinQueue", (data) => {
        const { userId, username, rank, topic, matchType } = data;

        // Add to topic queue
        if (!matchQueues[topic]) matchQueues[topic] = [];

        // Check if already in queue
        const alreadyQueued = matchQueues[topic].some((p) => p.userId === userId);
        if (alreadyQueued) {
            socket.emit("error", { message: "Already in queue" });
            return;
        }

        const playerData = { userId, username, rank, socketId: socket.id, matchType };
        matchQueues[topic].push(playerData);
        console.log(`📥 ${username} joined queue for ${topic} (${matchQueues[topic].length} in queue)`);

        socket.emit("queueJoined", { position: matchQueues[topic].length });

        // Try to find a match
        const matched = findMatch(topic);
        if (matched) {
            console.log(`⚔️  Match found: ${matched[0].username} vs ${matched[1].username}`);
            const room = createMatch(matched, topic);
            startMatch(room);
        }
    });

    // ── Leave Queue ──
    socket.on("leaveQueue", (data) => {
        const { topic } = data;
        if (matchQueues[topic]) {
            matchQueues[topic] = matchQueues[topic].filter((p) => p.socketId !== socket.id);
        }
        console.log(`📤 ${socket.id} left queue for ${topic}`);
    });

    // ── Join Battle Royale Queue ──
    socket.on("br:joinQueue", (data) => {
        const { userId, username, rank, topic } = data;

        if (!brQueues[topic]) {
            brQueues[topic] = { players: [], startTime: Date.now(), timerId: null };
        }

        const alreadyQueued = brQueues[topic].players.some(p => p.userId === userId);
        if (alreadyQueued) {
            socket.emit("error", { message: "Already in BR queue" });
            return;
        }

        const playerData = { userId, username, rank, socketId: socket.id };
        brQueues[topic].players.push(playerData);
        console.log(`🏆 ${username} joined BR queue for ${topic} (${brQueues[topic].players.length}/10)`);

        socket.emit("br:queueJoined", {
            position: brQueues[topic].players.length,
            startTime: brQueues[topic].startTime
        });

        // Broadcast queue update to all in this topic queue
        io.emit("br:queueUpdate", {
            topic,
            count: brQueues[topic].players.length
        });

        // Start 30s timer if this is the first player
        if (brQueues[topic].players.length === 1) {
            brQueues[topic].startTime = Date.now();
            startBRMatchmakingTimer(topic);
        }

        // Check if full (10 players)
        if (brQueues[topic].players.length >= 10) {
            if (brQueues[topic].timerId) {
                clearTimeout(brQueues[topic].timerId);
                brQueues[topic].timerId = null;
            }
            const matchedPlayers = [...brQueues[topic].players];
            brQueues[topic].players = [];

            console.log(`🔥 BR Match full! Starting match for ${topic}.`);
            const room = createBRMatch(matchedPlayers, topic);
            startBRMatch(room);
        }
    });

    socket.on("br:leaveQueue", (data) => {
        const { topic } = data;
        if (brQueues[topic]) {
            brQueues[topic].players = brQueues[topic].players.filter(p => p.socketId !== socket.id);
            console.log(`📤 ${socket.id} left BR queue for ${topic}`);

            io.emit("br:queueUpdate", {
                topic,
                count: brQueues[topic].players.length
            });

            // If queue empty, clear timer
            if (brQueues[topic].players.length === 0 && brQueues[topic].timerId) {
                clearTimeout(brQueues[topic].timerId);
                brQueues[topic].timerId = null;
            }
        }
    });

    // ── Submit Answer (Duel) ──
    socket.on("submitAnswer", (data) => {
        const { roomId, answer } = data;
        const room = gameRooms[roomId];
        if (!room || room.state !== "playing") return;

        const roundIndex = room.currentRound;
        if (!room.answers[roundIndex]) room.answers[roundIndex] = {};
        if (room.answers[roundIndex][socket.id] !== undefined) return;

        room.answers[roundIndex][socket.id] = answer;
        console.log(`📝 Duel answer from ${socket.id}`);

        const playerSockets = Object.keys(room.players);
        if (Object.keys(room.answers[roundIndex]).length >= playerSockets.length) {
            processRoundEnd(roomId);
        }
    });

    // ── BR Target Selection ──
    socket.on("br:selectTarget", (data) => {
        const { roomId, targetId } = data;
        const room = brRooms[roomId];
        if (!room || room.state !== 'selecting_target') return;

        const player = room.players[socket.id];
        if (!player || player.status !== 'alive') return;

        const target = room.players[targetId];
        if (!target || target.status !== 'alive' || targetId === socket.id) return;

        if (target.attackers.length >= 2) {
            socket.emit("error", { message: "Target already has 2 attackers!" });
            return;
        }

        if (player.targetId) {
            const oldTarget = room.players[player.targetId];
            if (oldTarget) oldTarget.attackers = oldTarget.attackers.filter(id => id !== socket.id);
        }

        player.targetId = targetId;
        target.attackers.push(socket.id);
        socket.emit("br:targetSelected", { targetId, targetUsername: target.username });
        io.to(roomId).emit("br:playerUpdate", { socketId: targetId, attackersCount: target.attackers.length });
    });

    // ── BR Combat Submissions ──
    socket.on("br:submitAttack", (data) => {
        const { roomId, answer, questionId } = data;
        const room = brRooms[roomId];
        if (!room || room.state !== 'combat') return;

        const player = room.players[socket.id];
        if (!player || player.status !== 'alive') return;

        const combatKey = `${socket.id}_vs_${player.targetId}`;
        if (!room.combatData[combatKey]) room.combatData[combatKey] = { attackerCorrect: false, targetCorrect: false };

        const question = room.questionPool.find(q => q.id === questionId);
        if (question && answer === question.correctAnswer) {
            room.combatData[combatKey].attackerCorrect = true;
        }
        console.log(`⚔️ BR Attack from ${player.username}`);
    });

    socket.on("br:submitDefense", (data) => {
        const { roomId, answer, questionId, attackerId } = data;
        const room = brRooms[roomId];
        if (!room || room.state !== 'combat') return;

        const player = room.players[socket.id];
        if (!player || player.status !== 'alive') return;

        const combatKey = `${attackerId}_vs_${socket.id}`;
        if (!room.combatData[combatKey]) room.combatData[combatKey] = { attackerCorrect: false, targetCorrect: false };

        const question = room.questionPool.find(q => q.id === questionId);
        if (question && answer === question.correctAnswer) {
            room.combatData[combatKey].targetCorrect = true;
        }
        console.log(`🛡️ BR Defense from ${player.username}`);
    });


    // ── Disconnect ──
    socket.on("disconnect", () => {
        console.log(`� Disconnected: ${socket.id}`);

        Object.keys(matchQueues).forEach(topic => {
            matchQueues[topic] = matchQueues[topic].filter(p => p.socketId !== socket.id);
        });

        Object.keys(brQueues).forEach(topic => {
            if (brQueues[topic]) brQueues[topic].players = brQueues[topic].players.filter(p => p.socketId !== socket.id);
        });

        // Handle Duel disconnect
        Object.keys(gameRooms).forEach(roomId => {
            const room = gameRooms[roomId];
            if (room.players[socket.id] && room.state !== "finished") {
                const opponentSocketId = Object.keys(room.players).find(s => s !== socket.id);
                if (opponentSocketId) {
                    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
                    if (opponentSocket) {
                        opponentSocket.emit("opponentDisconnected", { message: "Opponent disconnected. You win!" });
                        opponentSocket.emit("matchEnd", { playerWon: true, isDraw: false, playerScore: room.players[opponentSocketId].score, opponentScore: room.players[socket.id].score, opponentName: room.players[socket.id].username, language: room.topic, matchType: room.matchType });
                    }
                }
                Object.values(room.timers).forEach(clearTimeout);
                room.state = "finished";
                delete gameRooms[roomId];
            }
        });

        // Handle BR disconnect
        Object.keys(brRooms).forEach(roomId => {
            const room = brRooms[roomId];
            if (room.players[socket.id] && room.state !== "finished") {
                const player = room.players[socket.id];
                if (player.status === 'alive') {
                    player.status = 'disconnected';
                    player.hp = 0;
                    player.placement = room.aliveCount;
                    room.aliveCount -= 1;
                    io.to(roomId).emit("br:playerDisconnected", { socketId: socket.id, username: player.username, aliveCount: room.aliveCount });
                    if (room.aliveCount <= 1) endBRMatch(roomId);
                }
            }
        });

        delete connectedPlayers[socket.id];
    });
});

// ── Start Server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🚀 DreadWork Duel Server running on port ${PORT}`);
    console.log(`   📊 Health: http://localhost:${PORT}/`);
    console.log(`   🔌 WebSocket: ws://localhost:${PORT}\n`);
});
