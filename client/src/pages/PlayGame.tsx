import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameClient } from '../contexts/GameContext'
import { GameRenderer } from '../renderer'
import { GameOverMessage } from '../types/game'

// Import game dimensions for aspect ratio (horizontal/landscape)
const GAME_WIDTH = 1024
const GAME_HEIGHT = 768

export default function PlayGame() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const gameClient = useGameClient()
  const gameRendererRef = useRef<GameRenderer | null>(null)

  const [score, setScore] = useState(0)
  const [alive, setAlive] = useState(true)
  const [players, setPlayers] = useState<Array<{id: string; name: string; alive: boolean; score: number}>>([])
  const [gameState, setGameState] = useState<'waiting' | 'playing' | 'finished'>('waiting')
  const lastGameStateRef = useRef<any>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    if (!canvasRef.current) return

    // Check if renderer already exists to prevent recreation
    if (!gameRendererRef.current) {
      console.log('Creating GameRenderer - first time')
      try {
        const renderer = new GameRenderer(canvasRef.current)
        gameRendererRef.current = renderer
      } catch (error) {
        console.error('Failed to create GameRenderer:', error)
        return
      }
    } else {
      console.log('GameRenderer already exists, skipping recreation')
    }

    // Set local player ID immediately if available
    if (gameClient.playerId && gameRendererRef.current) {
      gameRendererRef.current.setLocalPlayerId(gameClient.playerId)
      console.log('Set local player ID on init:', gameClient.playerId)
    }

    let spacePressed = false
    let isPlaying = false

    // Keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log(`🎹 Key pressed: ${e.code}, gameState=${gameState}`)
      if (e.code === 'Space') {
        e.preventDefault()
        if (!spacePressed) {
          spacePressed = true
          gameClient.sendInput(true)
          console.log('✅ Space input sent!')
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed = false
        gameClient.sendInput(false)
        console.log('🔽 Space released!')
      }
    }

    // Touch/click input for mobile
    const handleTouchStart = () => {
      if (isPlaying) {
        gameClient.sendInput(true)
      }
    }

    const handleTouchEnd = () => {
      if (isPlaying) {
        gameClient.sendInput(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    canvasRef.current?.addEventListener('touchstart', handleTouchStart)
    canvasRef.current?.addEventListener('touchend', handleTouchEnd)
    canvasRef.current?.addEventListener('mousedown', handleTouchStart)
    canvasRef.current?.addEventListener('mouseup', handleTouchEnd)

    // Define event handlers
    const handleJoined = (data: any) => {
      console.log('Joined room:', data)
      // Set local player ID in renderer
      if (gameClient.playerId && gameRendererRef.current) {
        gameRendererRef.current.setLocalPlayerId(gameClient.playerId)
      }
    }

    const handleGameStart = () => {
      console.log('🎮 handleGameStart called - starting immediately')
      setGameState('playing')
      setAlive(true)
      setScore(0)
      isPlaying = true
      console.log(`🎮 isPlaying set to ${isPlaying}`)
      if (gameRendererRef.current) {
        gameRendererRef.current.reset()
        // Ensure local player ID is set
        if (gameClient.playerId) {
          gameRendererRef.current.setLocalPlayerId(gameClient.playerId)
        }
      }
    }

    const handleGameState = (data: any) => {
      // Skip duplicate messages (but allow 60 FPS updates from server)
      const now = Date.now()
      if (lastGameStateRef.current && now - lastGameStateRef.current.timestamp < 10) {
        // Only block if it's under 10ms (true duplicate)
        return
      }
      lastGameStateRef.current = { data, timestamp: now }

      // Update all players
      setPlayers(data.players.map((p: any) => ({
        id: p.id,
        name: p.name || p.id.substring(0, 8),
        alive: p.alive,
        score: p.score
      })))

      // Update my player state
      const myPlayer = data.players.find((p: any) => p.id === gameClient.playerId)
      if (myPlayer) {
        setScore(myPlayer.score)
        setAlive(myPlayer.alive)
        if (!myPlayer.alive) {
          isPlaying = false
        }
      }

      // Render all players (local + ghosts)
      if (gameRendererRef.current) {
        gameRendererRef.current.updateAllPlayers(data.players)
        gameRendererRef.current.setPipes(data.pipes)
      }
    }

    const handlePlayerJoined = (data: any) => {
      console.log('Player joined:', data)
    }

    const handleGameOver = (data: GameOverMessage) => {
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
    }

    // Add event listeners
    console.log('🎮 Adding PlayGame event listeners...')
    gameClient.on('joined', handleJoined)
    gameClient.on('gameStart', handleGameStart)
    gameClient.on('gameState', handleGameState)
    gameClient.on('playerJoined', handlePlayerJoined)
    gameClient.on('gameOver', handleGameOver)

    // Start animation loop for parallax and smooth rendering
    const gameLoop = () => {
      if (gameRendererRef.current && isPlaying) {
        gameRendererRef.current.update()
      }
      animationFrameRef.current = requestAnimationFrame(gameLoop)
    }
    gameLoop()

    return () => {
      console.log('🧹 PlayGame cleanup - removing event listeners')

      // Cleanup keyboard/mouse events
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      canvasRef.current?.removeEventListener('touchstart', handleTouchStart)
      canvasRef.current?.removeEventListener('touchend', handleTouchEnd)
      canvasRef.current?.removeEventListener('mousedown', handleTouchStart)
      canvasRef.current?.removeEventListener('mouseup', handleTouchEnd)

      // Cleanup game client listeners to prevent duplicates
      gameClient.off('joined', handleJoined)
      gameClient.off('gameStart', handleGameStart)
      gameClient.off('gameState', handleGameState)
      gameClient.off('playerJoined', handlePlayerJoined)
      gameClient.off('gameOver', handleGameOver)

      // Stop animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      // Destroy renderer to prevent duplicates
      if (gameRendererRef.current) {
        gameRendererRef.current.destroy()
        gameRendererRef.current = null
      }
    }
  }, [roomCode, gameClient])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="bg-purple-800 border-b-4 border-black p-6 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="text-white">
            <div className="text-xs font-bold text-yellow-400">ROOM CODE</div>
            <div className="text-3xl font-black tracking-widest text-yellow-400">{roomCode}</div>
          </div>

          <div className="text-white">
            <div className="text-xs font-bold text-yellow-400">YOUR SCORE</div>
            <div className="text-3xl font-black text-white">{score}</div>
          </div>

          <div className="text-white">
            <div className="text-xs font-bold text-yellow-400">STATUS</div>
            <div className={`text-2xl font-black ${alive ? 'text-green-400' : 'text-red-400'}`}>
              {alive ? 'ALIVE' : 'DEAD'}
            </div>
          </div>
        </div>

        <div className="text-white text-right">
          <div className="text-2xl font-black text-yellow-400">
            {gameState === 'waiting' && 'WAITING...'}
            {gameState === 'playing' && 'PLAYING'}
            {gameState === 'finished' && 'GAME OVER'}
          </div>
          <div className="text-sm font-bold text-white">
            {players.length} players
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center bg-purple-900 p-8 gap-8">
        {/* Game Canvas */}
        <div className="relative border-4 border-black overflow-hidden" style={{ width: `${GAME_WIDTH}px`, height: `${GAME_HEIGHT}px` }}>
          <div
            ref={canvasRef}
            className="cursor-pointer w-full h-full"
          />
          {!alive && gameState === 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="bg-red-600 border-4 border-black px-12 py-6">
                <div className="text-white text-6xl font-black">YOU DIED</div>
              </div>
            </div>
          )}
        </div>

        {/* Live Scoreboard */}
        <div className="bg-yellow-400 border-4 border-black p-6 w-80">
          <h2 className="text-purple-900 text-3xl font-black mb-4">LIVE RANKINGS</h2>
          <div className="space-y-2">
            {players
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 border-4 border-black font-bold ${
                    player.id === gameClient.playerId
                      ? 'bg-blue-500'
                      : player.alive
                      ? 'bg-green-500'
                      : 'bg-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-purple-900 w-8">
                      #{index + 1}
                    </div>
                    <div className="font-black text-white">
                      {player.name || `Player ${player.id.substring(0, 6)}`}
                      {player.id === gameClient.playerId && ' (YOU)'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-black text-purple-900">
                      {player.score}
                    </div>
                    {!player.alive && (
                      <div className="text-red-600 text-xs font-bold">DEAD</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-purple-800 border-t-4 border-black p-4 text-center">
        <div className="text-yellow-400 font-bold text-lg">
          Press SPACE to flap
        </div>
      </div>
    </div>
  )
}
