import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGameClient } from '../contexts/GameContext'
import { getRoom } from '../services/roomService'

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const gameClient = useGameClient()

  const [players, setPlayers] = useState<Array<{id: string; name: string; isHost: boolean}>>([])
  const [connected, setConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState('')

  // Load saved name and character from localStorage
  const savedName = localStorage.getItem('flappyPlayerName') || 'Anonymous'
  const savedCharacterId = localStorage.getItem('flappyCharacterId') || 'cupcake'

  // Define event handlers
  const handleJoined = (data: any) => {
    setConnected(true)
    console.log('Connected to game server:', data)
  }

  const handlePlayerJoined = (data: any) => {
    console.log('Player joined:', data)
    // Refresh room data when new player joins
    refreshRoomData()
  }

  const handlePlayerLeft = (data: any) => {
    console.log('Player left:', data)
    // Refresh room data when player leaves
    refreshRoomData()
  }

  const handleGameStart = () => {
    console.log('Game starting, navigating to play screen')
    // All players (including host) get their own playable canvas
    navigate(`/play/${roomCode}`, { replace: true })
  }

  // Load room data from Firestore
  const loadRoomData = async () => {
    try {
      console.log('🔍 Loading room data for code:', roomCode?.toUpperCase())
      const room = await getRoom(roomCode!.toUpperCase())

      console.log('🔍 Raw Firestore room data:', room)
      console.log('🔍 Room.players keys:', Object.keys(room.players || {}))
      console.log('🔍 Room.players values:', Object.values(room.players || {}))
      console.log('🔍 Saved name from localStorage:', savedName)

      // Convert Firestore player objects to our format
      const playersArray = Object.values(room.players || {}).map(player => ({
        id: player.id,
        name: player.name + (player.id === room.hostId ? ' (You)' : ''),
        isHost: player.isHost
      }))

      console.log('🔍 Converted players array:', playersArray)
      console.log('🔍 Room hostId:', room.hostId, 'Player IDs:', Object.keys(room.players || {}))

      setPlayers(playersArray)
      setIsHost(room.hostId === savedName)

      console.log('✅ Set players state with', playersArray.length, 'players')
    } catch (error) {
      console.error('Failed to load room data:', error)
      setError('Failed to load room data: ' + error.message)
    }
  }

  useEffect(() => {
    loadRoomData()

    // Add event listeners
    gameClient.on('joined', handleJoined)
    gameClient.on('playerJoined', handlePlayerJoined)
    gameClient.on('playerLeft', handlePlayerLeft)
    gameClient.on('gameStart', handleGameStart)

    // Only connect if not already connected
    if (!gameClient.playerId) {
      console.log('Connecting to WebSocket server...')
      gameClient.connect('wss://flappy-royale-server-839616896872.us-central1.run.app/ws', roomCode, savedName, savedCharacterId)
    } else {
      console.log('Already connected, skipping WebSocket connection')
      setConnected(true)
    }

    return () => {
      console.log('🧹 Lobby cleanup - removing event listeners')

      // Remove all event listeners
      gameClient.off('joined', handleJoined)
      gameClient.off('playerJoined', handlePlayerJoined)
      gameClient.off('playerLeft', handlePlayerLeft)
      gameClient.off('gameStart', handleGameStart)

      // Note: Don't disconnect here since PlayGame needs the same connection
    }
  }, [roomCode, navigate])

  const handleStartGame = () => {
    console.log('Start game clicked, players:', players.length)
    if (!isHost) {
      console.log('Not the host, cannot start game')
      return
    }
    if (gameClient && players.length > 0) {
      console.log('Sending startGame message')
      gameClient.send({ type: 'startGame' })
    } else {
      console.log('Cannot start - no game client or no players')
    }
  }

  // Refresh room data periodically
  const refreshRoomData = async () => {
    try {
      console.log('🔄 Refreshing room data...')
      const room = await getRoom(roomCode!.toUpperCase())

      // Convert Firestore player objects to our format
      const playersArray = Object.values(room.players || {}).map(player => ({
        id: player.id,
        name: player.name + (player.id === room.hostId ? ' (You)' : ''),
        isHost: player.isHost
      }))

      console.log('🔄 Refreshed players:', playersArray)
      setPlayers(playersArray)
      setIsHost(room.hostId === savedName)
    } catch (error) {
      console.error('Failed to refresh room data:', error)
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRoomData()
    }, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [roomCode, savedName])

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col">
      {/* Header */}
      <div className="bg-purple-800 border-b-4 border-black p-6">
        <div className="text-center">
          <h1 className="text-6xl font-black text-yellow-400 mb-4">
            FLAPPY CAKES
          </h1>
          <div className="text-white text-lg mb-4">
            Join at <span className="font-bold text-yellow-400">flappycakes.com</span>
          </div>
          <div className="inline-block bg-yellow-400 border-4 border-black px-8 py-4">
            <div className="text-purple-900 font-black text-xl mb-2">ROOM CODE</div>
            <div className="text-5xl font-black text-purple-900 tracking-widest">
              {roomCode}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-4xl w-full">
          {/* Players section */}
          <div className="bg-yellow-400 border-4 border-black p-8 mb-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-purple-900">
                PLAYERS ({players.length})
              </h2>
              {isHost && (
                <span className="bg-blue-600 text-white px-4 py-2 border-2 border-black font-bold text-sm">
                  YOU ARE HOST
                </span>
              )}
            </div>

            {players.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-purple-900 text-3xl font-black mb-4">
                  WAITING FOR PLAYERS...
                </div>
                <div className="text-purple-800 text-lg font-bold">
                  Share this room code with friends!
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {players.map((player, i) => (
                  <div
                    key={player.id}
                    className="bg-purple-600 border-4 border-black p-4 text-center hover:bg-purple-700 transition-colors"
                  >
                    <div className="text-xl font-black text-yellow-400 mb-1">
                      #{i + 1}
                    </div>
                    <div className="text-white font-bold text-sm mb-2 min-h-[2.5rem] flex items-center justify-center">
                      {player.name}
                    </div>
                    {player.isHost && (
                      <div className="text-yellow-400 text-xs font-bold">HOST</div>
                    )}
                  </div>
                ))}

                {/* Empty slots */}
                {[...Array(Math.max(0, 8 - players.length))].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="border-4 border-dashed border-purple-900 p-6 flex items-center justify-center bg-purple-200"
                  >
                    <div className="text-purple-600 text-2xl font-bold">
                      ?
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Start button */}
          <div className="text-center">
            {isHost ? (
              <div className="space-y-4">
                <button
                  onClick={handleStartGame}
                  disabled={players.length === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-black py-6 px-12 border-4 border-black text-2xl disabled:opacity-50"
                >
                  START GAME
                </button>
                {players.length === 0 && (
                  <div className="text-purple-800 text-lg font-bold">
                    Need at least 1 player to start
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-orange-400 border-4 border-black px-8 py-6 text-purple-900 text-xl font-black">
                WAITING FOR HOST TO START...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-purple-800 border-t-4 border-black p-6 text-center">
        <p className="text-yellow-400 font-bold text-lg">
          Players join on their phones to use as controllers
        </p>
      </div>
    </div>
  )
}
