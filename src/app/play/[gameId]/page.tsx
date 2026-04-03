'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';

export default function PlayDashboard({ params }: { params: Promise<{ gameId: string }> }) {
  // Now gameId in the URL is actually short_code
  const { gameId: shortCode } = use(params);

  const [game, setGame] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null); 
  const [name, setName] = useState('');
  const [isRestoring, setIsRestoring] = useState(true);
  
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [questions, setQuestions] = useState<any[]>([]);

  // 1. Initial game fetch and session check
  useEffect(() => {
    fetchGame();
    fetchQuestions();
  }, [shortCode]);

  useEffect(() => {
    if (game?.id) {
      checkExistingSession();
    }
  }, [game?.id]);

  // 2. Fetch leaderboard when needed
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

  // 3. Real-time game updates and question sync
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

  // 4. Presence Tracking
  useEffect(() => {
    if (!game?.id || !player?.id) return;

    const channel = supabase.channel(`game-presence-${game.id}`);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        // console.log('Presence sync', channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            player_id: player.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [game?.id, player?.id]);

  // Sync Countdown Logic
  useEffect(() => {
    if (!game || !game.is_round_active || !game.timer_ends_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(game.timer_ends_at).getTime();
      const diff = Math.max(0, Math.ceil((endTime - now) / 1000));
      setTimeLeft(diff);
    }, 100); // Fast check for accurate sync

    return () => clearInterval(interval);
  }, [game?.is_round_active, game?.timer_ends_at]);

  const fetchGame = async () => {
    const { data } = await supabase.from('games').select('*').eq('short_code', shortCode).single();
    if (data) {
      setGame(data);
      // Fetch questions if we have a game ID
      const { data: qData } = await supabase
        .from('questions')
        .select('*')
        .eq('game_id', data.id)
        .order('question_index', { ascending: true });
      if (qData) setQuestions(qData);
    }
  };

  const fetchQuestions = async () => {
     // This is now handled in fetchGame to ensure we have the game ID
  };

  const checkExistingSession = async () => {
    const sessionStr = localStorage.getItem('quiz_player_session');
    if (!sessionStr) {
      setIsRestoring(false);
      return;
    }

    try {
      const session = JSON.parse(sessionStr);
      if (session.gameId === game.id) {
        const { data: playerData } = await supabase
          .from('players')
          .select('*')
          .eq('id', session.playerId)
          .single();
        
        if (playerData) {
          setPlayer(playerData);
          await syncCurrentQuestionResponse(playerData.id, game.current_question);
        }
      }
    } catch (e) {
      console.error('Error restoring session:', e);
    } finally {
      setIsRestoring(false);
    }
  };

  const syncCurrentQuestionResponse = async (playerId: string, questionIndex: number) => {
    if (questionIndex === 0) return;

    const { data } = await supabase
      .from('player_responses')
      .select('*')
      .eq('player_id', playerId)
      .eq('question_index', questionIndex)
      .maybeSingle();
    
    if (data) {
      setSelectedAnswer(data.selected_answer);
      setHasSubmitted(true);
    } else {
      setHasSubmitted(false);
      setSelectedAnswer(null);
    }
  };

  const joinGame = async () => {
    if (!name.trim() || !game?.id) return;

    // Check if player name already exists in this game
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .eq('name', name.trim())
      .maybeSingle();

    if (existingPlayer) {
      // If name exists, just reconnect them
      setPlayer(existingPlayer);
      localStorage.setItem('quiz_player_session', JSON.stringify({
        playerId: existingPlayer.id,
        gameId: game.id
      }));
      await syncCurrentQuestionResponse(existingPlayer.id, game.current_question);
      return;
    }

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
    localStorage.setItem('quiz_player_session', JSON.stringify({
      playerId: data.id,
      gameId: game.id
    }));
    await syncCurrentQuestionResponse(data.id, game.current_question);
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
  if (isRestoring) return (
     <div className="screen active">
        <div className="waiting-msg">
           <div className="astronaut-float text-6xl">🛸</div>
           <p>Reconnecting your ship...</p>
        </div>
     </div>
  );

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

  // ── Active Game - Unified Header & Modes ──
  if (game.status === 'active') {
    const isUrgent = timeLeft <= 10 && game.is_round_active;
    
    return (
      <div className="screen active" style={{ flex: 1 }}>
        
        {/* Unified Header */}
        <div className="w-full flex flex-col items-center mb-6 pt-2">
           <h1 className={`text-6xl mb-2 transition-colors ${isUrgent ? 'text-red-500 blink-anim' : 'text-[var(--accent)]'}`}>
              {game.is_round_active ? timeLeft : '0'}
           </h1>
           <div className="flex items-center gap-4 text-sm font-bold opacity-80">
              <div className="bg-white/10 px-3 py-1 rounded-full uppercase">
                {questions.find(q => q.question_index === game.current_question)?.question_text || `Q${game.current_question}`} / {game.answers_key?.length || 0}
              </div>
              <div className="bar-line w-8"></div>
              <div className="text-[var(--text)]">{player.name}</div>
           </div>
        </div>

        {/* Mode 1: Answer Pad */}
        {game.is_round_active && !hasSubmitted && (
           <div className="mt-4 flex-1 flex flex-col justify-center w-full">
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

        {/* Mode 2: Locked In Waiting Screen */}
        {game.is_round_active && hasSubmitted && (
           <div className="flex-1 flex flex-col items-center w-full">
             <div className="locked-in mb-2 mt-4 flex flex-col items-center gap-2">
                <div className="flex justify-center mb-2">
                   <img src="/lockedinrocket.png" alt="Locked In" style={{ height: '200px', width: 'auto' }} className="astronaut-float" />
                </div>
                <h3 className="text-xl">LOCKED IN!</h3>
                <p className="text-center">Everyone is flipping their switches...</p>
             </div>
             
             {leaderboard.length > 0 && (
               <div className="leaderboard w-full flex-1 overflow-y-auto mt-4" style={{ maxHeight: '35vh' }}>
                 {leaderboard.map((p, idx) => (
                   <div key={p.id} className={`lb-row ${idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : ''}`}>
                     <div className="flex items-center gap-2">
                        <div className="lb-rank">#{idx + 1}</div>
                        <div className="lb-name">
                          {p.name}
                          {p.id === player?.id && <span className="text-[var(--accent)] ml-2 text-xs">(You)</span>}
                        </div>
                     </div>
                     <div className="lb-score">{p.score}</div>
                   </div>
                 ))}
               </div>
             )}
           </div>
        )}

        {/* Mode 3: Round Over Reveal */}
        {!game.is_round_active && (
           <div className="mt-4 flex-1 flex flex-col items-center w-full">
             <div className="flex flex-col items-center gap-2 mb-6">
                <div className="text-6xl mb-2">
                  {hasSubmitted && selectedAnswer === game.answers_key[game.current_question - 1] ? '✨' : '💫'}
                </div>
                <h3 className="text-2xl">ROUND OVER</h3>
             </div>

             <div className="flex flex-col gap-6 items-center w-full max-w-[300px]">
                {hasSubmitted && (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="label text-xs uppercase tracking-widest opacity-60">Your Pick</div>
                    <div className={`choice-card w-full m-0 ${selectedAnswer === game.answers_key[game.current_question - 1] ? 'border-accent bg-accent/20' : 'opacity-60'}`}>
                      {selectedAnswer}
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="label text-xs uppercase tracking-widest text-[var(--accent)]">Correct Answer</div>
                  <div className="choice-card w-full m-0 border-accent">
                    {game.answers_key[game.current_question - 1]}
                  </div>
                </div>

                {!hasSubmitted && <p className="mt-4 text-red-500 font-bold uppercase tracking-tighter">TIME IS UP!</p>}
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
