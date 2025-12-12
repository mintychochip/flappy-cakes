import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GameAnalytics } from '../types/game';

interface GameOverState {
  analytics: GameAnalytics;
  finalScores: Array<{ id: string; name?: string; score: number }>;
}

export default function GameOver() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as GameOverState | null;

  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    // If no analytics data, redirect immediately
    if (!state?.analytics) {
      navigate('/');
      return;
    }

    // Redirect to home after 15 seconds
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate, state]);

  if (!state?.analytics) {
    // Show loading while redirecting
    return null;
  }

  const { analytics, finalScores } = state;
  const isWinner = analytics.placement === 1;
  const isTopThree = analytics.placement <= 3;

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col">
      {/* Header */}
      <div className="bg-purple-800 border-b-4 border-black p-6">
        <div className="text-center">
          <h1 className="text-7xl font-black text-yellow-400 leading-none mb-4">
            FLAPPY CAKES
          </h1>
          <div className={`text-5xl font-black ${
            isWinner ? 'text-yellow-400' : isTopThree ? 'text-blue-400' : 'text-white'
          }`}>
            {isWinner && 'VICTORY!'}
            {!isWinner && isTopThree && 'TOP 3!'}
            {!isWinner && !isTopThree && 'GAME OVER'}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-5xl w-full space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-yellow-400 border-4 border-black p-6 text-center">
              <div className="text-purple-900 text-xs font-bold mb-1">PLACEMENT</div>
              <div className="text-6xl font-black text-purple-900">
                #{analytics.placement}
              </div>
            </div>

            <div className="bg-yellow-400 border-4 border-black p-6 text-center">
              <div className="text-purple-900 text-xs font-bold mb-1">SCORE</div>
              <div className="text-6xl font-black text-purple-900">
                {analytics.finalScore}
              </div>
            </div>

            <div className="bg-yellow-400 border-4 border-black p-6 text-center">
              <div className="text-purple-900 text-xs font-bold mb-1">SURVIVED</div>
              <div className="text-6xl font-black text-purple-900">
                {analytics.survived}s
              </div>
            </div>

            <div className="bg-yellow-400 border-4 border-black p-6 text-center">
              <div className="text-purple-900 text-xs font-bold mb-1">PIPES</div>
              <div className="text-6xl font-black text-purple-900">
                {analytics.pipesCleared}
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="bg-yellow-400 border-4 border-black p-6">
            <h2 className="text-purple-900 text-3xl font-black mb-4">FINAL STANDINGS</h2>
            <div className="space-y-2">
              {finalScores.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-4 border-4 border-black font-bold ${
                    index === 0
                      ? 'bg-yellow-500'
                      : index === 1
                      ? 'bg-gray-300'
                      : index === 2
                      ? 'bg-orange-400'
                      : 'bg-purple-600'
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`text-3xl font-black w-12 ${index < 3 ? 'text-purple-900' : 'text-yellow-400'}`}>
                      #{index + 1}
                    </div>
                    <div className={`font-black text-lg ${index < 3 ? 'text-purple-900' : 'text-white'}`}>
                      {player.name || `Player ${player.id.substring(0, 6)}`}
                    </div>
                  </div>
                  <div className={`text-2xl font-black ${index < 3 ? 'text-purple-900' : 'text-yellow-400'}`}>
                    {player.score}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Stats */}
          <div className="bg-yellow-400 border-4 border-black p-6">
            <h3 className="text-purple-900 text-2xl font-black mb-4">YOUR STATS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-600 border-4 border-black p-4 text-center">
                <div className="text-yellow-400 text-sm font-bold mb-1">PIPES/MIN</div>
                <div className="text-white text-3xl font-black">
                  {analytics.survived > 0
                    ? ((analytics.pipesCleared / analytics.survived) * 60).toFixed(1)
                    : 0}
                </div>
              </div>
              <div className="bg-purple-600 border-4 border-black p-4 text-center">
                <div className="text-yellow-400 text-sm font-bold mb-1">DEFEATED</div>
                <div className="text-white text-3xl font-black">
                  {analytics.totalPlayers - analytics.placement}
                </div>
              </div>
              <div className="bg-purple-600 border-4 border-black p-4 text-center">
                <div className="text-yellow-400 text-sm font-bold mb-1">WIN RATE</div>
                <div className="text-white text-3xl font-black">
                  {analytics.totalPlayers > 1
                    ? (((analytics.totalPlayers - analytics.placement) / (analytics.totalPlayers - 1)) * 100).toFixed(0)
                    : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-6 px-8 border-4 border-black text-2xl"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={() => {
                const text = `I placed #${analytics.placement} with ${analytics.finalScore} points in Flappy Cakes!`;
                navigator.clipboard.writeText(text);
                alert('Results copied to clipboard!');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black py-6 px-8 border-4 border-black text-2xl"
            >
              SHARE
            </button>
          </div>

          {/* Countdown */}
          <div className="text-center">
            <div className="text-yellow-400 font-bold text-lg">
              Returning home in {countdown}s...
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-purple-800 border-t-4 border-black p-6 text-center">
        <p className="text-yellow-400 font-bold text-lg">
          Thanks for playing!
        </p>
      </div>
    </div>
  );
}
