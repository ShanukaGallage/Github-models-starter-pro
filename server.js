// Import necessary packages
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path'; // <-- ADD THIS LINE
import { fileURLToPath } from 'url'; // <-- AND ADD THIS LINE

// Load environment variables from .env file
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.GITHUB_TOKEN,
    baseURL: 'https://models.github.ai/inference',
});
const modelName = 'openai/gpt-4o';

// Create an Express application
const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());

// Setup for serving static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Serve the index.html file for any root-level request
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store conversation history
let conversationHistory = [
    {
        role: 'system',
        content: 'You are a helpful and knowledgeable coding assistant. Provide answers in Markdown format, especially for code.',
    },
];

// Chat endpoint for streaming
app.post('/chat', async (req, res) => {
    try {
        const userInput = req.body.message;
        if (!userInput) {
            return res.status(400).json({ error: 'Message is required' });
        }
        conversationHistory.push({ role: 'user', content: userInput });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const stream = await openai.chat.completions.create({
            model: modelName,
            messages: conversationHistory,
            stream: true,
        });

        let fullResponse = "";
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }

        if (fullResponse) {
            conversationHistory.push({ role: 'assistant', content: fullResponse });
        }
        res.end();
    } catch (error) {
        console.error('Error processing chat:', error);
        res.write(`data: ${JSON.stringify({ error: "An error occurred." })}\n\n`);
        res.end();
    }
});

// Endpoint to reset conversation history
app.post('/reset', (req, res) => {
    conversationHistory = [
        {
            role: 'system',
            content: 'You are a helpful and knowledgeable coding assistant. Provide answers in Markdown format, especially for code.',
        },
    ];
    res.json({ message: 'Conversation history has been reset.' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

