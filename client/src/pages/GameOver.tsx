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
  }, [navigate]);

  if (!state?.analytics) {
    // If no analytics data, redirect immediately
    navigate('/');
    return null;
  }

  const { analytics, finalScores } = state;
  const isWinner = analytics.placement === 1;
  const isTopThree = analytics.placement <= 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={`text-6xl font-black mb-4 ${
            isWinner ? 'text-yellow-400' : isTopThree ? 'text-blue-400' : 'text-white'
          }`}>
            {isWinner && '🏆 VICTORY! 🏆'}
            {!isWinner && isTopThree && '🥈 TOP 3! 🥉'}
            {!isWinner && !isTopThree && 'GAME OVER'}
          </h1>
          <p className="text-white text-xl opacity-75">
            Redirecting to home in {countdown}s...
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center">
            <div className="text-4xl font-black text-yellow-400 mb-2">
              #{analytics.placement}
            </div>
            <div className="text-white text-sm opacity-75">Placement</div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center">
            <div className="text-4xl font-black text-blue-400 mb-2">
              {analytics.finalScore}
            </div>
            <div className="text-white text-sm opacity-75">Score</div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center">
            <div className="text-4xl font-black text-green-400 mb-2">
              {analytics.survived}s
            </div>
            <div className="text-white text-sm opacity-75">Survived</div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center">
            <div className="text-4xl font-black text-purple-400 mb-2">
              {analytics.pipesCleared}
            </div>
            <div className="text-white text-sm opacity-75">Pipes Cleared</div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-8">
          <h2 className="text-white text-2xl font-bold mb-4">Final Leaderboard</h2>
          <div className="space-y-2">
            {finalScores.map((player, index) => (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  index === 0
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-500'
                    : index === 1
                    ? 'bg-gradient-to-r from-gray-400 to-gray-300'
                    : index === 2
                    ? 'bg-gradient-to-r from-orange-600 to-orange-500'
                    : 'bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-4">
                  <div className="text-2xl font-black text-white w-8">
                    #{index + 1}
                  </div>
                  <div className="text-white font-bold">
                    {player.name || `Player ${player.id.substring(0, 6)}`}
                  </div>
                </div>
                <div className="text-white text-xl font-bold">
                  {player.score} pts
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance breakdown */}
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 mb-8">
          <h3 className="text-white text-xl font-bold mb-4">Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-white">
              <span className="opacity-75">Average pipes/minute:</span>
              <span className="font-bold">
                {analytics.survived > 0
                  ? ((analytics.pipesCleared / analytics.survived) * 60).toFixed(1)
                  : 0}
              </span>
            </div>
            <div className="flex justify-between text-white">
              <span className="opacity-75">Players defeated:</span>
              <span className="font-bold">
                {analytics.totalPlayers - analytics.placement}
              </span>
            </div>
            <div className="flex justify-between text-white">
              <span className="opacity-75">Beat percentage:</span>
              <span className="font-bold">
                {analytics.totalPlayers > 1
                  ? (((analytics.totalPlayers - analytics.placement) / (analytics.totalPlayers - 1)) * 100).toFixed(0)
                  : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all"
          >
            Play Again
          </button>
          <button
            onClick={() => {
              // Share results (could integrate with social media)
              const text = `I scored ${analytics.finalScore} points and placed #${analytics.placement} in Flappy Cakes! 🎮`;
              navigator.clipboard.writeText(text);
              alert('Results copied to clipboard!');
            }}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg text-xl transition-all"
          >
            Share 📋
          </button>
        </div>
      </div>
    </div>
  );
}
