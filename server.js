const express = require("express");
const dotenv = require("dotenv");
const { GoogleGenAI } = require("@google/genai");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

dotenv.config();

const app = express();

const PORT = 5000;

// ==========================================
// Middleware
// ==========================================

app.use(cors());
app.use(express.json());

// ==========================================
// Gemini API Key
// ==========================================

if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: GEMINI_API_KEY is missing in .env");
} else {
    console.log("Gemini API key loaded successfully");
}

// ==========================================
// Gemini Client
// ==========================================

const client = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    })
    : null;

// ==========================================
// Models
// ==========================================

// Primary model first.
// If it is temporarily unavailable,
// the server automatically tries the next one.

const GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
];

// ==========================================
// Conversation History
// ==========================================

const conversations = {};

// ==========================================
// Rate Limiter
// ==========================================

const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,

    message: {
        message: "Too many requests. Please try again later."
    },

    standardHeaders: true,
    legacyHeaders: false
});

// ==========================================
// Test Route
// ==========================================

app.get("/", (req, res) => {

    return res.status(200).json({
        message: "AI Chatbot server is running"
    });
});

// ==========================================
// Chat Route
// ==========================================

app.post("/api/chat", chatLimiter, async (req, res) => {

    console.log("--------------------------------");
    console.log("POST /api/chat received");

    try {

        // ==========================================
        // Validate Request
        // ==========================================

        if (!req.body || typeof req.body !== "object") {

            return res.status(400).json({
                message: "Invalid request"
            });
        }

        const message = req.body.message;

        const conversationId =
            req.body.conversationId || "default";

        console.log("Message:", message);
        console.log("Conversation ID:", conversationId);

        // ==========================================
        // Validate Message
        // ==========================================

        if (message === undefined || message === null) {

            return res.status(400).json({
                message: "Message is required"
            });
        }

        if (typeof message !== "string") {

            return res.status(400).json({
                message: "Message must be a string"
            });
        }

        const trimmedMessage = message.trim();

        if (trimmedMessage.length === 0) {

            return res.status(400).json({
                message: "Message cannot be empty"
            });
        }

        const MAX_MESSAGE_LENGTH = 2000;

        if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {

            return res.status(400).json({
                message:
                    "Message cannot exceed 2000 characters"
            });
        }

        // ==========================================
        // Check Gemini Client
        // ==========================================

        if (!client) {

            console.error(
                "Gemini client is not available"
            );

            return res.status(500).json({
                message:
                    "Gemini API key is missing"
            });
        }

        // ==========================================
        // Create Conversation
        // ==========================================

        if (!conversations[conversationId]) {

            conversations[conversationId] = [];

            console.log(
                "Created conversation:",
                conversationId
            );
        }

        // ==========================================
        // Prepare Conversation
        // ==========================================

        const userMessage = {
            role: "user",
            parts: [
                {
                    text: trimmedMessage
                }
            ]
        };

        const conversationContents = [
            ...conversations[conversationId],
            userMessage
        ];

        // ==========================================
        // Limit Conversation History
        // ==========================================

        const MAX_HISTORY_MESSAGES = 20;

        const limitedContents =
            conversationContents.slice(
                -MAX_HISTORY_MESSAGES
            );

        // ==========================================
        // System Instruction
        // ==========================================

        const systemInstruction = `
You are a helpful, friendly AI assistant.

Answer the user's questions clearly and accurately.

You can help with:
- Programming
- Java
- JavaScript
- Python
- HTML and CSS
- Databases
- Data structures and algorithms
- College subjects
- General knowledge
- Explanations
- Study plans
- Writing and brainstorming
- Everyday questions

If the user asks a technical question, explain it in
simple language when appropriate and provide examples
when useful.

If you do not know something, say so instead of making
up information.

Be helpful and conversational.
`;

        // ==========================================
        // Ask Gemini
        // ==========================================

        let response = null;
        let successfulModel = null;

        for (const model of GEMINI_MODELS) {

            console.log(
                `Trying Gemini model: ${model}`
            );

            try {

                response =
                    await client.models.generateContent({

                        model: model,

                        contents: limitedContents,

                        config: {
                            systemInstruction:
                                systemInstruction
                        }
                    });

                if (response) {

                    successfulModel = model;

                    console.log(
                        `Gemini response received from ${model}`
                    );

                    break;
                }

            } catch (error) {

                const errorMessage =
                    error?.message || "";

                console.error(
                    `Model ${model} failed:`
                );

                console.error(errorMessage);

                // ======================================
                // Temporary API Errors
                // ======================================

                const temporaryError =
                    errorMessage.includes("503") ||
                    errorMessage.includes("429") ||
                    errorMessage.includes("UNAVAILABLE") ||
                    errorMessage.includes("RESOURCE_EXHAUSTED") ||
                    errorMessage.includes("high demand") ||
                    errorMessage.includes("overloaded");

                // Try next model for temporary errors
                if (temporaryError) {

                    console.log(
                        `${model} is temporarily unavailable.`
                    );

                    console.log(
                        "Trying another Gemini model..."
                    );

                    continue;
                }

                // ======================================
                // Model Not Available
                // ======================================

                if (
                    errorMessage.includes("404") ||
                    errorMessage.includes("NOT_FOUND") ||
                    errorMessage.includes("no longer available")
                ) {

                    console.log(
                        `${model} is not available.`
                    );

                    console.log(
                        "Trying another Gemini model..."
                    );

                    continue;
                }

                // ======================================
                // Other API Errors
                // ======================================

                console.error(
                    "Non-recoverable Gemini error."
                );

                return res.status(502).json({
                    message:
                        "Gemini API error. Please try again later."
                });
            }
        }

        // ==========================================
        // No Model Worked
        // ==========================================

        if (!response || !successfulModel) {

            console.error(
                "All Gemini models failed."
            );

            return res.status(502).json({
                message:
                    "Gemini is temporarily unavailable. Please try again later."
            });
        }

        // ==========================================
        // Get AI Response
        // ==========================================

        const aiResponse = response.text;

        if (
            typeof aiResponse !== "string" ||
            aiResponse.trim() === ""
        ) {

            console.error(
                "Gemini returned an empty response."
            );

            return res.status(502).json({
                message:
                    "Gemini returned an empty response."
            });
        }

        // ==========================================
        // Save Conversation
        // ==========================================

        conversations[conversationId].push(
            userMessage
        );

        conversations[conversationId].push({
            role: "model",
            parts: [
                {
                    text: aiResponse
                }
            ]
        });

        // Keep history from growing forever
        if (
            conversations[conversationId].length >
            MAX_HISTORY_MESSAGES
        ) {

            conversations[conversationId] =
                conversations[conversationId].slice(
                    -MAX_HISTORY_MESSAGES
                );
        }

        // ==========================================
        // Send Response
        // ==========================================

        console.log(
            `Response sent using ${successfulModel}`
        );

        return res.status(200).json({

            success: true,

            conversationId:
                conversationId,

            message:
                aiResponse,

            model:
                successfulModel
        });

    } catch (error) {

        console.error(
            "SERVER ERROR"
        );

        console.error(
            "Error name:",
            error.name
        );

        console.error(
            "Error message:",
            error.message
        );

        console.error(
            "Stack:",
            error.stack
        );

        return res.status(500).json({
            message:
                "Unable to process your request."
        });
    }
});

// ==========================================
// Unknown Route
// ==========================================

app.use((req, res) => {

    return res.status(404).json({
        message: "Route not found"
    });
});

// ==========================================
// Start Server
// ==========================================

app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log(
        `Server running on http://localhost:${PORT}`
    );
    console.log("--------------------------------");

});