import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GameClient } from '../game-client'
import { GameOverMessage } from '../types/game'

export default function Controller() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const gameClientRef = useRef<GameClient | null>(null)

  const [connected, setConnected] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [isDead, setIsDead] = useState(false)
  const [score, setScore] = useState(0)
  const [isPressed, setIsPressed] = useState(false)

  useEffect(() => {
    const gameClient = new GameClient()
    gameClientRef.current = gameClient

    gameClient.connect('wss://flappy-royale-server-839616896872.us-central1.run.app/ws', roomCode)

    gameClient.on('joined', () => {
      setConnected(true)
    })

    gameClient.on('gameStart', () => {
      setGameStarted(true)
      setIsDead(false)
      setScore(0)
    })

    gameClient.on('gameState', (data) => {
      const myPlayer = data.players.find((p: any) => p.id === gameClient.playerId)
      if (myPlayer) {
        setScore(myPlayer.score)
        if (!myPlayer.alive) {
          setIsDead(true)
        }
      }
    })

    gameClient.on('gameOver', (data: GameOverMessage) => {
      console.log('🎮 GAME OVER received:', data)
      setGameStarted(false)

      // Calculate analytics
      const myPlayer = data.finalScores.find(p => p.id === gameClient.playerId)
      const placement = data.finalScores.findIndex(p => p.id === gameClient.playerId) + 1

      console.log('📊 Analytics calculated:', {
        placement,
        totalPlayers: data.stats?.totalPlayers,
        finalScore: myPlayer?.score,
        survived: gameClient.getGameDuration(),
        pipesCleared: gameClient.getPipesPassed(),
      })

      // Redirect to game over page after 3 seconds
      setTimeout(() => {
        console.log('🔄 Redirecting to game-over page...')
        navigate('/game-over', {
          state: {
            analytics: {
              placement,
              totalPlayers: data.stats?.totalPlayers || data.finalScores.length,
              finalScore: myPlayer?.score || 0,
              survived: gameClient.getGameDuration(),
              pipesCleared: gameClient.getPipesPassed(),
            },
            finalScores: data.finalScores,
          }
        })
      }, 3000)
    })

    return () => {
      // Cleanup
    }
  }, [roomCode])

  const handleFlap = (pressing: boolean) => {
    setIsPressed(pressing)
    if (gameClientRef.current) {
      gameClientRef.current.sendInput(pressing)
    }
  }

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="text-2xl font-bold text-gray-800 mb-4">
            Connecting to room...
          </div>
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
            {roomCode}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-sm p-6 text-white text-center">
        <div className="text-sm opacity-75">Room</div>
        <div className="text-3xl font-black tracking-widest">{roomCode}</div>
      </div>

      {/* Main control area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!gameStarted ? (
          <div className="text-center space-y-6">
            <div className="text-white text-3xl font-bold">
              Waiting for game to start...
            </div>
            <div className="text-white/75 text-lg">
              Watch the main screen!
            </div>
          </div>
        ) : isDead ? (
          <div className="text-center space-y-6">
            <div className="text-white text-5xl font-black">
              YOU DIED
            </div>
            <div className="text-white text-3xl font-bold">
              Score: {score}
            </div>
            <div className="text-white/75 text-lg">
              Waiting for next game...
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="text-white/75 text-lg">Score</div>
              <div className="text-white text-6xl font-black">{score}</div>
            </div>

            {/* Flap button */}
            <button
              onTouchStart={() => handleFlap(true)}
              onTouchEnd={() => handleFlap(false)}
              onMouseDown={() => handleFlap(true)}
              onMouseUp={() => handleFlap(false)}
              onMouseLeave={() => handleFlap(false)}
              className={`w-full aspect-square rounded-full text-6xl font-black shadow-2xl transform transition active:scale-95 ${
                isPressed
                  ? 'bg-yellow-400 text-yellow-900 scale-95'
                  : 'bg-white text-purple-600 hover:scale-105'
              }`}
            >
              FLAP
            </button>

            <div className="text-center text-white/75 text-sm">
              Tap and hold to flap
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
