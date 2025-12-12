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
      console.log('🎮 handleGameStart called - resetting renderer')
      setGameState('playing')
      isPlaying = true
      setAlive(true)
      setScore(0)
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

    // Set initial state to playing (already connected from Lobby)
    setGameState('playing')
    isPlaying = true

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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="text-white">
            <div className="text-xs opacity-75">Room</div>
            <div className="text-2xl font-black tracking-widest">{roomCode}</div>
          </div>

          <div className="text-white">
            <div className="text-xs opacity-75">Your Score</div>
            <div className="text-2xl font-bold">{score}</div>
          </div>

          <div className="text-white">
            <div className="text-xs opacity-75">Status</div>
            <div className={`text-lg font-bold ${alive ? 'text-green-300' : 'text-red-300'}`}>
              {alive ? 'ALIVE' : 'DEAD'}
            </div>
          </div>
        </div>

        <div className="text-white text-right">
          <div className="text-lg font-bold">
            {gameState === 'waiting' && 'Waiting...'}
            {gameState === 'playing' && 'PLAYING'}
            {gameState === 'finished' && 'GAME OVER'}
          </div>
          <div className="text-sm opacity-75">
            {players.length} players
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="relative w-full h-full max-w-7xl max-h-[400px]">
          <div
            ref={canvasRef}
            className="border-4 border-white rounded-lg overflow-hidden shadow-2xl cursor-pointer touch-none w-full h-full"
            style={{
              touchAction: 'none',
              aspectRatio: `${GAME_WIDTH}/${GAME_HEIGHT}`, // Match PIXI dimensions (800x450 = 16:9)
              maxWidth: '100%',
              maxHeight: '100%'
            }}
          />
          {!alive && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
              <div className="text-white text-4xl font-black">
                YOU DIED
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gray-900 p-4 text-center">
        <div className="text-white/75 text-sm">
          Press SPACE or TAP/CLICK to flap
        </div>
      </div>
    </div>
  )
}
