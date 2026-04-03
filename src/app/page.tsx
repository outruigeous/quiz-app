'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');

  const joinGame = () => {
    if (joinCode.length === 4) {
      router.push(`/play/${joinCode}`);
    } else {
      alert('Please enter a 4-digit code.');
    }
  };

  return (
    <div className="screen active items-center justify-center p-4">
      <div className="flex flex-col items-center gap-2 mb-8 w-full">
        <div className="space-deco flex justify-center">
          <img src="/landingmascot.png" alt="Quiz Mascot" style={{ height: '200px', width: 'auto' }} className="astronaut-float" />
        </div>
        <div className="text-center">
          <h2>Skibidi Boys and Girls</h2>
          <h1 style={{ marginTop: '4px' }}>WHO SAID WHAT?!</h1>
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        <div className="label text-center">JOIN A GAME</div>
        <input
          type="text"
          maxLength={4}
          pattern="\d{4}"
          placeholder="4-DIGIT CODE"
          className="text-center text-2xl tracking-[0.4em] uppercase"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
        />
        <button onClick={joinGame} className="btn-yellow mt-2">JOIN</button>
      </div>
    </div>
  );
}
