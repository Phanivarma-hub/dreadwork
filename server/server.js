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

// Active game rooms: roomId -> { players, questions, answers, currentRound, state, timers }
const gameRooms = {};

// ════════════════════════════════════════════════
//  QUESTION SELECTION
// ════════════════════════════════════════════════

function getRandomQuestion(pool, language) {
    const lang = language.toLowerCase();
    const filtered = pool.filter((q) => q.language.toLowerCase() === lang);
    const source = filtered.length > 0 ? filtered : pool;
    return source[Math.floor(Math.random() * source.length)];
}

function selectQuestionsForMatch(language) {
    return {
        round1: getRandomQuestion(mcqQuestions, language),       // MCQ
        round2: getRandomQuestion(explanationQuestions, language), // Explanation
        round3: getRandomQuestion(codeQuestions, language),       // Code Output
    };
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

function createMatch(players, topic) {
    const roomId = "room_" + Date.now() + "_" + Math.random().toString(36).substring(7);
    const questions = selectQuestionsForMatch(topic);

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

// ════════════════════════════════════════════════
//  GAME FLOW
// ════════════════════════════════════════════════

function startMatch(room) {
    const playerArray = Object.values(room.players);

    // Notify both players of match found
    playerArray.forEach((p) => {
        const opponent = playerArray.find((op) => op.socketId !== p.socketId);
        const socket = io.sockets.sockets.get(p.socketId);
        if (socket) {
            socket.emit("matchFound", {
                roomId: room.roomId,
                opponent: {
                    username: opponent.username,
                    rank: opponent.rank,
                },
                topic: room.topic,
                matchType: room.matchType,
            });
        }
    });

    // After intro delay, start round 1
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
    const roundTimers = [30, 45, 30];

    const question = room.questions[roundNames[roundIndex]];
    if (!question) return;

    // Reset answers for this round
    room.answers[roundIndex] = {};

    // Prepare question data for clients (don't send correctAnswer for MCQ/code)
    let questionData;
    if (roundTypes[roundIndex] === "mcq" || roundTypes[roundIndex] === "code_output") {
        questionData = {
            id: question.id,
            question: question.question || question.code || "",
            code: question.code || null,
            options: question.options,
            type: roundTypes[roundIndex],
            round: roundIndex + 1,
            timer: roundTimers[roundIndex],
        };
    } else {
        // Explanation round — only send the question text
        questionData = {
            id: question.id,
            question: question.question,
            type: "explanation",
            round: roundIndex + 1,
            timer: roundTimers[roundIndex],
        };
    }

    // Send question to both players
    io.to(roomId).emit("question", questionData);

    // Start server-side timer
    const timerDuration = roundTimers[roundIndex] * 1000;
    room.timers[roundIndex] = setTimeout(() => {
        // Time's up — process whatever answers we have
        processRoundEnd(roomId);
    }, timerDuration + 2000); // +2s grace
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

    // ── Submit Answer ──
    socket.on("submitAnswer", (data) => {
        const { roomId, answer } = data;
        const room = gameRooms[roomId];
        if (!room || room.state !== "playing") return;

        const roundIndex = room.currentRound;
        if (!room.answers[roundIndex]) room.answers[roundIndex] = {};

        // Only accept first answer per player per round
        if (room.answers[roundIndex][socket.id] !== undefined) return;

        room.answers[roundIndex][socket.id] = answer;
        console.log(`📝 Answer from ${socket.id} for round ${roundIndex + 1}: ${typeof answer === 'string' && answer.length > 30 ? answer.substring(0, 30) + '...' : answer}`);

        // Check if both players have answered
        const playerSockets = Object.keys(room.players);
        const answeredCount = Object.keys(room.answers[roundIndex]).length;

        if (answeredCount >= playerSockets.length) {
            // Both answered — process immediately
            processRoundEnd(roomId);
        }
    });

    // ── Disconnect ──
    socket.on("disconnect", () => {
        console.log(`🔌 Disconnected: ${socket.id}`);

        // Remove from all queues
        Object.keys(matchQueues).forEach((topic) => {
            matchQueues[topic] = matchQueues[topic].filter((p) => p.socketId !== socket.id);
        });

        // Handle active game disconnect
        Object.keys(gameRooms).forEach((roomId) => {
            const room = gameRooms[roomId];
            if (room.players[socket.id] && room.state !== "finished") {
                // Notify opponent
                const opponentSocketId = Object.keys(room.players).find((s) => s !== socket.id);
                if (opponentSocketId) {
                    const opponentSocket = io.sockets.sockets.get(opponentSocketId);
                    if (opponentSocket) {
                        opponentSocket.emit("opponentDisconnected", {
                            message: "Your opponent disconnected. You win!",
                        });
                        // Auto-win for remaining player
                        opponentSocket.emit("matchEnd", {
                            playerWon: true,
                            isDraw: false,
                            playerScore: room.players[opponentSocketId].score,
                            opponentScore: room.players[socket.id].score,
                            opponentName: room.players[socket.id].username,
                            language: room.topic,
                            matchType: room.matchType,
                        });
                    }
                }

                // Clear timers
                Object.values(room.timers).forEach(clearTimeout);
                room.state = "finished";
                delete gameRooms[roomId];
            }
        });

        // Remove from connected players
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
