-- Enable the UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'lobby', 'active', 'finished')),
    answers_key INT[] NOT NULL DEFAULT '{}',
    current_question INT NOT NULL DEFAULT 0,
    is_round_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create the player_responses table
CREATE TABLE player_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    question_index INT NOT NULL,
    selected_answer INT NOT NULL CHECK (selected_answer IN (1, 2, 3, 4)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(game_id, player_id, question_index)
);

-- Enable Realtime for all three tables
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE player_responses;

-- RLS Policies (For simplicity, we are allowing anonymous access since this is purely a casual tool without auth. 
-- In a production app, you would want to restrict these or use Row Level Security).
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select for games" ON games FOR SELECT USING (true);
CREATE POLICY "Allow all insert for games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update for games" ON games FOR UPDATE USING (true);

CREATE POLICY "Allow all select for players" ON players FOR SELECT USING (true);
CREATE POLICY "Allow all insert for players" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update for players" ON players FOR UPDATE USING (true);

CREATE POLICY "Allow all select for responses" ON player_responses FOR SELECT USING (true);
CREATE POLICY "Allow all insert for responses" ON player_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update for responses" ON player_responses FOR UPDATE USING (true);
