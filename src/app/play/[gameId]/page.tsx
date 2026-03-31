'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';

export default function PlayDashboard({ params }: { params: Promise<{ gameId: string }> }) {
  // Now gameId in the URL is actually short_code
  const { gameId: shortCode } = use(params);

  const [game, setGame] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null); 
  const [name, setName] = useState('');
  
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if ((game?.status === 'active' || game?.status === 'finished') && game?.id) {
      supabase
        .from('players')
        .select('*')
        .eq('game_id', game.id)
        .order('score', { ascending: false })
        .then(({ data }) => {
          if (data) setLeaderboard(data);
        });
    }
  }, [game?.status, game?.id, hasSubmitted, game?.current_question]);

  useEffect(() => {
    fetchGame();
  }, [shortCode]);

  useEffect(() => {
    if (!game?.id) return;
    
    const gameSub = supabase
      .channel(`game-play-${game.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${game.id}` }, (payload) => {
        setGame((prevGame: any) => {
          if (prevGame && payload.new.current_question > prevGame.current_question) {
            setHasSubmitted(false);
            setSelectedAnswer(null);
          }
          return payload.new;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameSub);
    };
  }, [game?.id]);

  const fetchGame = async () => {
    const { data } = await supabase.from('games').select('*').eq('short_code', shortCode).single();
    if (data) setGame(data);
  };

  const joinGame = async () => {
    if (!name.trim() || !game?.id) return;
    const { data, error } = await supabase
      .from('players')
      .insert([{ game_id: game.id, name: name.trim() }])
      .select()
      .single();

    if (error) {
      alert('Error joining game.');
      return;
    }
    
    setPlayer(data);
  };

  const submitAnswer = async (answer: number) => {
    if (!game.is_round_active || hasSubmitted) return;
    
    setSelectedAnswer(answer);
    setHasSubmitted(true);
    
    await supabase.from('player_responses').insert([{
      game_id: game.id,
      player_id: player.id,
      question_index: game.current_question,
      selected_answer: answer
    }]);
  };

  if (!game) return (
     <div className="screen active">
        <div className="error-msg mt-12">Checking code availability...</div>
     </div>
  );

  // ── Render Join Form ──
  if (!player) {
    if (game.status === 'setup') {
      return (
        <div className="screen active">
          <div className="waiting-msg">
            <div className="astronaut-float text-6xl">🚀</div>
            <p>The host is still preparing the questions...</p>
          </div>
        </div>
      );
    }
    if (game.status === 'finished') {
       return (
        <div className="screen active">
          <div className="locked-in">
             <span className="checkmark text-red-500">🏁</span>
             <h3>GAME OVER</h3>
             <p>This match has already finished!</p>
          </div>
        </div>
       );
    }

    return (
      <div className="screen active">
        <div className="space-deco flex justify-center mb-4">
           <img src="/roomplanet.png" alt="Join Room" style={{ height: '200px', width: 'auto' }} className="planet-float" />
        </div>
        <h1 className="text-center mb-2">Room: {shortCode}</h1>
        <div className="label text-center mb-6">What's your name?</div>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="e.g. Skibideep"
          maxLength={15}
        />
        <button 
          onClick={joinGame} 
          className="btn-yellow mt-4"
          disabled={!name.trim()}
        >
          ENTER LOBBY
        </button>
      </div>
    );
  }

  // ── Waiting in lobby ──
  if (game.status === 'lobby') {
    return (
      <div className="screen active">
        <div className="waiting-msg">
          <div className="flex justify-center mb-6">
             <img src="/whatsyournameastsro.png" alt="In Lobby" style={{ height: '200px', width: 'auto' }} className="astronaut-float" />
          </div>
          <h1 className="mb-4">YOU ARE IN!</h1>
          <p>Hang tight, waiting for the host to start the game...</p>
        </div>
        <div className="player-row mt-auto">
          <span className="player-name">{player.name}</span>
          <span className="player-status voted">READY</span>
        </div>
      </div>
    );
  }

  // ── Active Game - Answer Pad ──
  if (game.status === 'active') {
    return (
      <div className="screen active" style={{ flex: 1 }}>
        <div className="question-header-bar">
          <div className="q-label-text">Q{game.current_question} / {game.answers_key?.length || 0}</div>
          <div className="bar-line"></div>
          <div className="q-label-text" style={{ color: 'var(--text)' }}>{player.name}</div>
        </div>

        {!game.is_round_active && (
           <div className="locked-in mt-4 flex-1 flex flex-col items-center">
             <div className="flex flex-col items-center gap-2 mb-6">
                <div className="text-6xl mb-2">
                  {hasSubmitted && selectedAnswer === game.answers_key[game.current_question - 1] ? '✨' : '💫'}
                </div>
                <h3>ROUND OVER</h3>
             </div>

             <div className="flex flex-col gap-6 items-center w-full">
                {hasSubmitted && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="label">Your Pick</div>
                    <div className={`choice-card m-0 ${selectedAnswer === game.answers_key[game.current_question - 1] ? 'border-accent bg-accent/20' : 'opacity-60'}`}>
                      {selectedAnswer}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2">
                  <div className="label text-[var(--accent)]">Correct Answer</div>
                  <div className="choice-card m-0 border-accent">
                    {game.answers_key[game.current_question - 1]}
                  </div>
                </div>

                {!hasSubmitted && <p className="mt-4 text-red-400">You didn't lock in an answer!</p>}
             </div>
           </div>
        )}

        {game.is_round_active && hasSubmitted && (
           <div className="flex-1 flex flex-col items-center">
             <div className="locked-in mb-2 mt-4 flex flex-col items-center gap-2">
                <div className="flex justify-center mb-2">
                   <img src="/lockedinrocket.png" alt="Locked In" style={{ height: '200px', width: 'auto' }} className="astronaut-float" />
                </div>
                <h3>LOCKED IN!</h3>
                <p>Waiting for everyone to flip their switch...</p>
             </div>
             
             {leaderboard.length > 0 && (
               <div className="leaderboard w-full flex-1 overflow-y-auto" style={{ maxHeight: '45vh' }}>
                 {leaderboard.map((p, idx) => (
                   <div key={p.id} className={`lb-row ${idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : ''}`}>
                     <div className="lb-rank">#{idx + 1}</div>
                     <div className="lb-name">
                       {p.name}
                       {p.id === player?.id && <span className="text-[var(--accent)] ml-2 text-xs">(You)</span>}
                     </div>
                     <div className="lb-score">{p.score}</div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

        {game.is_round_active && !hasSubmitted && (
           <div className="mt-8 flex-1 flex flex-col justify-center">
             <div className="answer-grid h-[60vh] md:h-auto md:aspect-square">
               {[1, 2, 3, 4].map((ans) => {
                 const isSelected = selectedAnswer === ans;
                 return (
                   <button 
                     key={ans}
                     disabled={!game.is_round_active || (hasSubmitted && !isSelected)}
                     onClick={() => submitAnswer(ans)}
                     className={`answer-btn ${isSelected ? 'selected' : ''}`}
                   >
                     {ans}
                   </button>
                 )
               })}
             </div>
           </div>
        )}

      </div>
    );
  }

  // ── Finished Game ──
  if (game.status === 'finished') {
    return (
      <div className="screen active">
        <div className="locked-in mb-2 mt-4">
           <div className="flex justify-center mb-4">
              <img src="/leaderboardastronaut.png" alt="Mission Complete" style={{ height: '200px', width: 'auto' }} className="astronaut-float" />
           </div>
           <h1>GAME OVER</h1>
        </div>
        
        <div className="label text-center mb-2">Final Standings</div>

        {leaderboard.length > 0 ? (
          <div className="leaderboard w-full mt-0 overflow-y-auto" style={{ maxHeight: '55vh' }}>
            {leaderboard.map((p, idx) => (
              <div key={p.id} className={`lb-row ${idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : ''}`}>
                <div className="lb-rank">#{idx + 1}</div>
                <div className="lb-name">
                  {p.name}
                  {p.id === player?.id && <span className="text-[var(--accent)] ml-2 text-xs">(You)</span>}
                </div>
                <div className="lb-score">{p.score}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center mt-8 text-[var(--accent)] blink-anim">Loading results...</div>
        )}
      </div>
    );
  }

  return null;
}
