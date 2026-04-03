'use client';

import { useEffect, useState, use } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function HostDashboard({ params }: { params: Promise<{ gameId: string }> }) {
  const router = useRouter();
  const { gameId } = use(params);

  const [game, setGame] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<Set<string>>(new Set());

  // Setup form states
  const [totalQuestions, setTotalQuestions] = useState<number | string>(1);
  const [answersKey, setAnswersKey] = useState<number[]>([1]);

  useEffect(() => {
    fetchGame();
    fetchPlayers();
    fetchResponses();

    const gameSub = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new);
      })
      .subscribe();

    const playerSub = supabase
      .channel(`players-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, (payload) => {
        setPlayers((prev) => [...prev, payload.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` }, (payload) => {
        setPlayers((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
      })
      .subscribe();

    const responseSub = supabase
      .channel(`responses-${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_responses', filter: `game_id=eq.${gameId}` }, (payload) => {
        setResponses((prev) => [...prev, payload.new]);
      })
      .subscribe();

    // Presence Subscription
    const presenceChannel = supabase.channel(`game-presence-${gameId}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const onlineIds = new Set<string>();
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.player_id) onlineIds.add(p.player_id);
          });
        });
        
        setOnlinePlayerIds(onlineIds);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gameSub);
      supabase.removeChannel(playerSub);
      supabase.removeChannel(responseSub);
      supabase.removeChannel(presenceChannel);
    };
  }, [gameId]);

  const fetchGame = async () => {
    const { data } = await supabase.from('games').select('*').eq('id', gameId).single();
    if (data) {
      setGame(data);
      if (data.answers_key && data.answers_key.length > 0) {
        setAnswersKey(data.answers_key);
        setTotalQuestions(data.answers_key.length);
      }
    }
    setLoading(false);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase.from('players').select('*').eq('game_id', gameId).order('score', { ascending: false });
    if (data) setPlayers(data);
  };

  const fetchResponses = async () => {
    const { data } = await supabase.from('player_responses').select('*').eq('game_id', gameId);
    if (data) setResponses(data);
  };

  const handleTotalQuestionsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setTotalQuestions('');
      setAnswersKey([]);
      return;
    }
    
    const total = parseInt(val);
    if (isNaN(total)) return;

    setTotalQuestions(total);
    // adjust answer key length
    setAnswersKey(prev => {
      if (total > prev.length) {
        return [...prev, ...Array(total - prev.length).fill(1)];
      } else {
        return prev.slice(0, total);
      }
    });
  };

  const updateAnswerKey = (index: number, value: number) => {
    const newAnswers = [...answersKey];
    newAnswers[index] = value;
    setAnswersKey(newAnswers);
  };

  const saveSetup = async () => {
    await supabase.from('games').update({
      status: 'lobby',
      answers_key: answersKey
    }).eq('id', gameId);
  };

  const startGame = async () => {
    await supabase.from('games').update({
      status: 'active',
      current_question: 1,
      is_round_active: true
    }).eq('id', gameId);
  };

  const endRound = async () => {
    await supabase.from('games').update({
      is_round_active: false
    }).eq('id', gameId);
    
    gradeRound();
  };

  const gradeRound = async () => {
    if (!game) return;
    const currentQIndex = game.current_question;
    const correctAnswer = game.answers_key[currentQIndex - 1];
    
    const roundResponses = responses.filter(r => r.question_index === currentQIndex);
      
    const correctPlayers = roundResponses.filter(r => r.selected_answer === correctAnswer).map(r => r.player_id);
    if (correctPlayers.length === 0) return;
    
    for (const playerId of correctPlayers) {
      const player = players.find(p => p.id === playerId);
      if (player) {
         await supabase.from('players').update({ score: player.score + 1 }).eq('id', playerId);
      }
    }
  };

  const nextQuestion = async () => {
    if (game.current_question >= game.answers_key.length) {
      await supabase.from('games').update({
        status: 'finished',
        is_round_active: false
      }).eq('id', gameId);
    } else {
      await supabase.from('games').update({
        current_question: game.current_question + 1,
        is_round_active: true
      }).eq('id', gameId);
    }
  };

  // Helper for active game tally
  const activeRoundResponses = game ? responses.filter(r => r.question_index === game.current_question) : [];
  const tally = [1, 2, 3, 4].map(opt => activeRoundResponses.filter(r => r.selected_answer === opt).length);

  if (loading) return null;
  if (!game) return <div className="screen active"><div className="error-msg">Game not found</div></div>;

  const playUrl = typeof window !== 'undefined' ? window.location.host : '';

  return (
    <div className={`screen active fade-in ${game.status === 'setup' ? 'h-[calc(100vh-40px)] max-h-[900px] !gap-4' : ''}`} style={{ display: 'flex' }}>
      
      {/* ── SETUP ── */}
      {game.status === 'setup' && (
        <>
          <div className="flex-none">
            <div className="question-header-bar">
              <span className="q-label-text">Game Setup</span>
              <div className="bar-line"></div>
            </div>
            
            <div className="mt-4">
              <div className="label mb-2">Total Questions</div>
              <input 
                type="number" 
                min="1" 
                max="50" 
                value={totalQuestions} 
                onChange={handleTotalQuestionsChange}
              />
            </div>
          </div>
          
          <div className="flex-1 flex flex-col min-h-0">
            <div className="label mb-2 flex-none">Answer Key</div>
            <div className="answer-inputs flex-1 overflow-y-auto pr-1">
              {answersKey.map((ans, idx) => (
                <div key={idx} className="answer-input-row flex-none">
                  <span className="q-label">Q{idx + 1}</span>
                  <div className="answer-options flex-1 justify-end">
                    {[1, 2, 3, 4].map(opt => (
                      <div 
                        key={opt}
                        onClick={() => updateAnswerKey(idx, opt)}
                        className={`ans-opt ${ans === opt ? 'selected' : ''}`}
                      >
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-none pt-2 mt-auto">
            <button onClick={saveSetup} className="btn">
              Open Lobby
            </button>
          </div>
        </>
      )}

      {/* ── LOBBY ── */}
      {game.status === 'lobby' && (
        <>
          <div className="host-code">
            <div className="label">JOIN AT {playUrl}</div>
            <div className="code text-2xl mt-4 mb-2 select-all">{game.short_code}</div>
            <div className="hint text-accent2">Tell players to enter this code</div>
          </div>
          
          <div className="flex-row">
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text)' }}>Players Connected</h2>
            <div className="q-counter">{players.length} JOINED</div>
          </div>
          
          <div className="player-list max-h-48 overflow-y-auto">
            {players.length === 0 ? (
              <div className="waiting-msg">
                <p>Waiting for players...</p>
              </div>
            ) : (
              players.map(p => {
                const isOnline = onlinePlayerIds.has(p.id);
                return (
                  <div key={p.id} className="player-row">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-500'}`}></div>
                      <span className="player-name">{p.name}</span>
                    </div>
                    <span className={`player-status ${isOnline ? 'voted' : 'waiting'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <button onClick={startGame} className="btn-yellow mt-auto" disabled={players.length === 0}>
            START GAME
          </button>
        </>
      )}

      {/* ── ACTIVE GAME ── */}
      {game.status === 'active' && (
        <>
          <div className="flex-row items-center mb-6">
            <div className="flex flex-col gap-2">
               <div className="question-label">Question</div>
               <div className="question-number">{game.current_question} / {game.answers_key.length}</div>
            </div>
            {game.is_round_active ? (
               <div className="status-pill active blink-anim self-start mt-1">Accepting Answers</div>
            ) : (
               <div className="status-pill text-red-400 border-red-400 self-start mt-1">Round Closed</div>
             )}
          </div>

          {!game.is_round_active && (
            <div className="locked-in mb-4 flex flex-col items-center gap-4">
              <span className="label">The correct answer was</span>
              <div className="choice-card mx-auto m-0">
                 {game.answers_key[game.current_question - 1]}
              </div>
            </div>
          )}

          <div className="flex-row mb-2">
            <span className="label">Live Responses</span>
            <span className="q-counter">{activeRoundResponses.length} / {players.length}</span>
          </div>

          <div className="progress-bar mb-6">
            <div 
              className="progress-fill" 
              style={{ width: `${players.length > 0 ? (activeRoundResponses.length / players.length) * 100 : 0}%` }}
            ></div>
          </div>

          <div className="vote-tally mb-6">
             {tally.map((count, i) => (
                <div key={i} className={`tally-box ${!game.is_round_active && game.answers_key[game.current_question - 1] === i + 1 ? 'border-accent2 bg-purple-dark text-white' : ''}`}>
                   <div className="tally-num" style={{ opacity: !game.is_round_active && game.answers_key[game.current_question - 1] !== i + 1 ? 0.3 : 1 }}>{count}</div>
                   <div className="tally-label">Option {i+1}</div>
                </div>
             ))}
          </div>
          
          {game.is_round_active && activeRoundResponses.length === players.length && players.length > 0 && (
             <div className="all-voted-banner mb-4">Everyone has voted!</div>
          )}

          <div className="mt-auto pt-6 flex flex-col gap-4">
            {game.is_round_active ? (
              <button onClick={endRound} className="btn">
                END ROUND & REVEAL
              </button>
            ) : (
              <button onClick={nextQuestion} className="btn-yellow">
                {game.current_question >= game.answers_key.length ? 'SEE LEADERBOARD' : 'NEXT QUESTION'}
              </button>
            )}
          </div>
        </>
      )}

      {/* ── LEADERBOARD ── */}
      {game.status === 'finished' && (
        <>
          <div className="question-number-big mt-8">GAME OVER</div>
          <div className="label mb-2 mt-4 text-center">Final Leaderboard</div>
          
          <div className="leaderboard">
            {[...players].sort((a,b) => b.score - a.score).map((p, idx) => {
              const isOnline = onlinePlayerIds.has(p.id);
              return (
                <div key={p.id} className={`lb-row ${idx === 0 ? 'first' : idx === 1 ? 'second' : idx === 2 ? 'third' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="lb-rank">#{idx + 1}</div>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_6px_#22c55e]' : 'bg-gray-500'}`}></div>
                    <div className="lb-name">{p.name}</div>
                  </div>
                  <div className="lb-score">{p.score}</div>
                </div>
              );
            })}
          </div>

          <button onClick={() => router.push('/')} className="btn-ghost mt-8">
            Create New Game
          </button>
        </>
      )}

    </div>
  );
}
