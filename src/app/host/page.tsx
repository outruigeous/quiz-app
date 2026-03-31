'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

  return (
    <div className="screen active items-center justify-center p-4">
      <div className="space-deco flex justify-center mb-4 text-[80px]">
        🚀
      </div>
      <h1 className="text-center mb-12">REAL-TIME<br/>QUIZ</h1>

      <button 
        onClick={createGame} 
        disabled={loading}
        className="btn"
      >
        {loading ? 'INITIALIZING...' : 'HOST NEW GAME'}
      </button>
    </div>
  );
}
