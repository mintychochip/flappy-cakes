import { useEffect, useRef, useState } from 'react'
import { GameClient } from './game-client'
import { GameRenderer } from './renderer'

const GAME_WIDTH = 800;
const GAME_HEIGHT = 450;

export default function App() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const gameClientRef = useRef<GameClient | null>(null)
  const gameRendererRef = useRef<GameRenderer | null>(null)

  const [score, setScore] = useState(0)
  const [playerCount, setPlayerCount] = useState(0)
  const [status, setStatus] = useState('Click to start...')
  const [gameOver, setGameOver] = useState(false)
  const [leaderboard, setLeaderboard] = useState<Array<{id: string; score: number}>>([])

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize game client and renderer
    const gameClient = new GameClient()
    const renderer = new GameRenderer(canvasRef.current)

    gameClientRef.current = gameClient
    gameRendererRef.current = renderer

    let localScore = 0
    let gameStarted = false
    let spacePressed = false

    // Input
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed = true
        e.preventDefault()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed = false
      }
    }

    const handleClick = () => {
      if (!gameStarted) {
        gameClient.connect('wss://flappy-royale-server-839616896872.us-central1.run.app/ws')
        gameClient.send({ type: 'join', windowHeight: GAME_HEIGHT })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    if (canvasRef.current) {
      canvasRef.current.addEventListener('click', handleClick)
    }

    // WebSocket handlers
    gameClient.on('joined', (data) => {
      setStatus('Waiting for match...')
      setPlayerCount(data.playerCount)
    })

    gameClient.on('gameStart', () => {
      gameStarted = true
      localScore = 0
      setScore(0)
      setStatus('Game Started!')
      setGameOver(false)
      renderer.reset()
    })

    gameClient.on('gameState', (data) => {
      // Render server position directly
      const myPlayer = data.players.find((p: any) => p.id === gameClient.playerId)
      if (myPlayer) {
        renderer.setPlayerY(myPlayer.y, myPlayer.alive)
        setScore(myPlayer.score)
        if (!myPlayer.alive && gameStarted) {
          gameStarted = false
          setStatus('You crashed!')
          setGameOver(true)
        }
      }
      renderer.setPipes(data.pipes)
    })

    gameClient.on('playerJoined', (data) => {
      setPlayerCount(data.playerCount)
    })

    gameClient.on('playerLeft', (data) => {
      setPlayerCount(data.playerCount)
    })

    gameClient.on('gameOver', (data) => {
      gameStarted = false
      setGameOver(true)
      setStatus(`Game Over! Winner: ${data.winner === gameClient.playerId ? 'YOU!' : 'Someone else'}`)
      setLeaderboard(data.finalScores.sort((a: any, b: any) => b.score - a.score).slice(0, 5))
    })

    // Game loop - send input to server
    const tick = () => {
      if (gameStarted && !gameOver) {
        gameClient.sendInput(spacePressed)
      }
    }

    const interval = setInterval(tick, 1000 / 60)

    return () => {
      clearInterval(interval)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('click', handleClick)
      }
    }
  }, [])

  return (
    <div className="w-screen h-screen flex flex-col bg-black">
      <div ref={canvasRef} className="flex-1" />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
        {/* Top Left - Score */}
        <div className="absolute top-6 left-6 text-white text-4xl font-bold drop-shadow-lg">
          Score: {score}
        </div>

        {/* Top Right - Player Count */}
        <div className="absolute top-6 right-6 text-white text-lg drop-shadow-lg">
          Players: {playerCount}
        </div>

        {/* Center - Status */}
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 text-white text-xl text-center drop-shadow-lg">
          {status}
        </div>

        {/* Bottom Right - Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="absolute bottom-6 right-6 bg-black/70 text-white text-sm p-3 rounded-lg backdrop-blur">
            <div className="font-bold mb-2">Top Scores</div>
            {leaderboard.map((entry, i) => (
              <div key={i} className="text-xs py-0.5">
                {i + 1}. Score: {entry.score}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
