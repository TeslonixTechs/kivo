# Kivo

A full-stack AI study workspace built with React, Tailwind CSS, Node.js, and Express.

## Features

- Create named study kits with a learning difficulty
- Store study kits and uploaded files locally in IndexedDB
- Generate organized AI study guides
- Read guides aloud and use clickable key-term definitions
- Practice with instant-feedback smart-study questions and accuracy tracking
- Configure MCQ or theory tests with difficulty, question count, and timer
- Review test scores and learning achievements
- Track streaks and recent activity

## Run locally

1. Install dependencies:
   `npm run install:all`
2. Start both applications:
   `npm run dev`
3. Open `http://localhost:5173`.

The API runs at `http://localhost:4000`.

## AI provider

The included API generates a useful built-in study guide when no provider credentials are configured.
Set `OPENAI_API_KEY` or `GEMINI_API_KEY` in your environment before connecting provider-specific document analysis.
