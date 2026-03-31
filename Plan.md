Mission: Build a Real-Time Quiz "Answer Clicker" Web App
1. Project Overview
Build a synchronized, multi-device web app where a Host verbalizes questions and Players use their phones as answer pads.

Host Role: Sets the number of questions, inputs a numerical Answer Key (1-4), manages the lobby, and controls the game flow (Start/End Round).

Player Role: Joins via a URL, enters a name, and sees 4 large numbered buttons (1, 2, 3, 4) that match the current question.

2. Tech Stack & Environment
Framework: Next.js (App Router).

Styling: Tailwind CSS. NOTE: I have a custom CSS file; please build the components first, then ask me to paste my CSS code to style them.

Database/Real-time: Supabase. Use Supabase Realtime to sync the "Active Question" state and the Lobby across all devices.

3. Core Features & Logic
Host Setup: - Host chooses the total number of questions.

Host inputs the correct number (1, 2, 3, or 4) for each question before starting.

App generates a shareable URL (e.g., /play/[game-id]) for players to join.

The Lobby: - Players enter a display name and join a "Live Lobby."

Host sees a real-time list of names as they join.

Game Flow:

Both Host and Player screens display "Question X of Y".

Player sees 4 buttons labeled 1, 2, 3, and 4.

Host clicks "End Round" to stop submissions and reveal the correct number on all screens.

Host clicks "Next Question" to advance.

Leaderboard Logic:

The app compares the player's selected number against the Host's Answer Key.

Final Results: Only after the last question is finished, show a sorted list of players by "Total Correct Answers" from highest to lowest.

4. Implementation Steps for the Agent
Project Initialization: Create the Next.js structure and define a Supabase schema for games, players, and responses.

Host Setup Form: Build the dynamic form for the Host to input the Answer Key using numbers 1-4.

Real-time Lobby: Set up Supabase subscriptions so players appear instantly on the Host's screen.

Game State Controller: Build the logic that pushes the "Active Question" number to all connected players simultaneously.

Scoring Engine: Write the logic to grade numerical answers and calculate the final leaderboard.

STYLING PAUSE: Stop here and ask me for my custom CSS code before finalizing the UI.