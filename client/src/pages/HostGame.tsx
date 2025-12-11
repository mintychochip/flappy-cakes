import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameClient } from '../contexts/GameContext'
import { GameRenderer } from '../renderer'
import { GameOverMessage } from '../types/game'

export default function HostGame() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const gameClient = useGameClient()
  const gameRendererRef = useRef<GameRenderer | null>(null)

  const [players, setPlayers] = useState<Array<{id: string; name: string; alive: boolean; score: number}>>([])
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting')

  useEffect(() => {
    if (!canvasRef.current || gameRendererRef.current) return

    const renderer = new GameRenderer(canvasRef.current)
    gameRendererRef.current = renderer

    let spacePressed = false
    let isPlaying = false

    // Keyboard input for host
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !spacePressed && isPlaying) {
        spacePressed = true
        gameClient.sendInput(true)
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spacePressed) {
        spacePressed = false
        gameClient.sendInput(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Game client is already connected from Lobby
    // Just set up event handlers for this page

    gameClient.on('joined', (data) => {
      console.log('Joined room:', data)
    })

    gameClient.on('gameStart', () => {
      setGameState('playing')
      isPlaying = true
      renderer.reset()
    })

    gameClient.on('gameState', (data) => {
      // Update players list
      setPlayers(data.players.map((p: any) => ({
        id: p.id,
        name: p.name || p.id.substring(0, 8),
        alive: p.alive,
        score: p.score
      })))

      const myPlayer = data.players.find((p: any) => p.id === gameClient.playerId)
      if (myPlayer) {
        renderer.setPlayerY(myPlayer.y, myPlayer.alive)
        if (!myPlayer.alive) {
          isPlaying = false
        }
      }
      renderer.setPipes(data.pipes)
    })

    gameClient.on('playerJoined', (data) => {
      console.log('Player joined:', data)
    })

    gameClient.on('gameOver', (data: GameOverMessage) => {
      console.log('🎮 GAME OVER received:', data)
      setGameState('finished')
      isPlaying = false

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

    // Set initial state to playing since we just started
    setGameState('playing')
    isPlaying = true

    return () => {
      // Cleanup renderer and input handlers
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      gameRendererRef.current = null
    }
  }, [roomCode, gameClient])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar with room code */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="text-white">
            <div className="text-sm opacity-75">Room Code</div>
            <div className="text-4xl font-black tracking-widest">{roomCode}</div>
          </div>

          <div className="text-white">
            <div className="text-sm opacity-75">Players</div>
            <div className="text-3xl font-bold">{players.length}</div>
          </div>
        </div>

        <div className="text-white text-right">
          <div className="text-lg font-bold">
            {gameState === 'waiting' && 'Waiting for players...'}
            {gameState === 'playing' && 'GAME IN PROGRESS'}
            {gameState === 'finished' && 'GAME OVER'}
          </div>
          <div className="text-sm opacity-75">
            Join at flappycakes.com
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Game canvas */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="relative">
            <div ref={canvasRef} className="border-4 border-white rounded-lg overflow-hidden shadow-2xl" />
          </div>
        </div>

        {/* Player list sidebar */}
        <div className="w-80 bg-gray-900 p-6 overflow-y-auto">
          <h3 className="text-white text-2xl font-bold mb-4">Players</h3>
          <div className="space-y-2">
            {players.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No players yet...
              </div>
            ) : (
              players
                .sort((a, b) => b.score - a.score)
                .map((player, i) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-lg ${
                      player.alive
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                        : 'bg-gray-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl font-black text-white">
                          #{i + 1}
                        </div>
                        <div className="text-white font-bold truncate">
                          {player.name}
                        </div>
                      </div>
                      <div className="text-white text-xl font-bold">
                        {player.score}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
