'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MASTER_ANSWER_KEY = [1, 2, 2, 4, 4, 1, 2, 2, 3, 4, 1, 2, 2, 3, 1, 4, 3, 3, 1, 4, 4, 1, 4, 2, 3, 3, 1, 3, 1, 2, 4, 4, 3, 3, 1, 4, 2, 2];

export default function HostLanding() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const createGame = async () => {
    setLoading(true);
    // Generate a random 4 digit code
    const shortCode = Math.floor(1000 + Math.random() * 9000).toString();

    const { data, error } = await supabase
      .from('games')
      .insert([{ status: 'setup', answers_key: [], current_question: 0, is_round_active: false, short_code: shortCode }])
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game. Ensure the database schema is fully updated.');
      setLoading(false);
      return;
    }

    if (data) {
       router.push(`/host/${data.id}`);
    }
  };

  const launchMasterQuiz = async () => {
    setLoading(true);
    const shortCode = '6767';

    // 1. Delete existing game with code 6767
    await supabase.from('games').delete().eq('short_code', shortCode);

    // 2. Insert new master game
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .insert([{ 
        status: 'lobby', 
        answers_key: MASTER_ANSWER_KEY, 
        current_question: 0, 
        is_round_active: false, 
        short_code: shortCode 
      }])
      .select()
      .single();

    if (gameError || !gameData) {
      console.error('Error creating master game:', gameError);
      alert('Failed to launch Master Quiz.');
      setLoading(false);
      return;
    }

    // 3. Bulk insert 38 question labels
    const questionsToInsert = MASTER_ANSWER_KEY.map((_, idx) => ({
      game_id: gameData.id,
      question_index: idx + 1,
      question_text: `Question ${idx + 1}`,
      options: ['1', '2', '3', '4']
    }));

    await supabase.from('questions').insert(questionsToInsert);

    // 4. Redirect
    router.push(`/host/${gameData.id}`);
  };

  return (
    <div className="screen active items-center justify-center p-4">
      <div className="space-deco flex justify-center mb-4 text-[80px]">
        🚀
      </div>
      <h1 className="text-center mb-12">REAL-TIME<br/>QUIZ</h1>

      <button 
        onClick={createGame} 
        disabled={loading}
        className="btn-ghost mb-4"
      >
        {loading ? 'INITIALIZING...' : 'HOST CUSTOM GAME'}
      </button>

      <button 
        onClick={launchMasterQuiz} 
        disabled={loading}
        className="btn-yellow"
      >
        {loading ? 'LAUNCHING...' : 'Launch Skibidi Quiz'}
      </button>
    </div>
  );
}
