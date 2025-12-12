import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useGameClient } from '../contexts/GameContext'
import { getRoom, subscribeToRoom } from '../services/roomService'
import { leaveRoom } from '../services/lobbyService'

export default function Lobby() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const gameClient = useGameClient()

  // Get hostId from navigation state (only set when creating a room)
  const hostIdFromState = (location.state as any)?.hostId

  const [players, setPlayers] = useState<Array<{id: string; name: string; isHost: boolean}>>([])
  const [connected, setConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState('')
  const gameStartedRef = useRef(false)
  const [selectedSkin, setSelectedSkin] = useState('character1')

  // Available skins
  const skins = [
    { id: 'character1', name: 'Character 1', image: '/flappy-bird.png' },
    { id: 'santa', name: 'Santa', image: '/flappy-bird.png' },
  ]

  // Load saved name from localStorage
  const savedName = localStorage.getItem('flappyPlayerName') || 'Anonymous'

  // Player card colors - cycle through different colors
  const playerColors = [
    'bg-purple-600 hover:bg-purple-700',
    'bg-blue-600 hover:bg-blue-700',
    'bg-green-600 hover:bg-green-700',
    'bg-red-600 hover:bg-red-700',
    'bg-orange-600 hover:bg-orange-700',
    'bg-pink-600 hover:bg-pink-700',
    'bg-teal-600 hover:bg-teal-700',
    'bg-indigo-600 hover:bg-indigo-700',
  ]

  // Load saved skin on mount
  useEffect(() => {
    const savedSkin = localStorage.getItem('flappySkin')
    console.log('🎨 Loading saved skin from localStorage:', savedSkin)
    if (savedSkin) {
      setSelectedSkin(savedSkin)
      console.log('🎨 Set selectedSkin to:', savedSkin)
    } else {
      console.log('🎨 No saved skin found, using default character1')
    }
  }, [])

  // Define event handlers
  const handleJoined = async (data: any) => {
    setConnected(true)
    console.log('Connected to game server:', data)

    // Now that we have playerId, check if we're the host
    await refreshRoomData()
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
    gameStartedRef.current = true
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
        name: player.name,
        isHost: player.isHost
      }))

      console.log('🔍 Converted players array:', playersArray)
      console.log('🔍 Room hostId:', room.hostId, 'Player IDs:', Object.keys(room.players || {}))

      setPlayers(playersArray)

      // Determine if current user is host
      // If we have hostId from navigation state (created room), use that
      // Otherwise use gameClient.playerId (joined room)
      const myId = hostIdFromState || gameClient.playerId
      if (myId) {
        const isHostUser = myId === room.hostId
        setIsHost(isHostUser)
        console.log('🔍 Host check: myId=', myId, 'room.hostId=', room.hostId, 'isHost=', isHostUser)
      }

      console.log('✅ Set players state with', playersArray.length, 'players')
    } catch (error) {
      console.error('Failed to load room data:', error)
      setError('Failed to load room data: ' + error.message)
    }
  }

  useEffect(() => {
    // Add event listeners first
    gameClient.on('joined', handleJoined)
    gameClient.on('playerJoined', handlePlayerJoined)
    gameClient.on('playerLeft', handlePlayerLeft)
    gameClient.on('gameStart', handleGameStart)

    // Load room data and connect WebSocket in sequence
    const initializeLobby = async () => {
      await loadRoomData()

      // Load saved skin before connecting
      const savedSkin = localStorage.getItem('flappySkin') || 'character1'
      console.log('🎨 Using skin for connection:', savedSkin)
      setSelectedSkin(savedSkin)

      // Only connect if not already connected
      if (!gameClient.playerId) {
        console.log('🎨 Connecting to WebSocket server with skin:', savedSkin)
        // Send saved skin immediately
        gameClient.connect('wss://flappy-royale-server-839616896872.us-central1.run.app/ws', roomCode, savedName, savedSkin)
      } else {
        console.log('Already connected, but rejoining room in case it was deleted with skin:', savedSkin)
        // Send a new join message to ensure we're in the room (in case it was deleted)
        gameClient.send({
          type: 'join',
          roomCode: roomCode?.toUpperCase(),
          playerName: savedName,
          skinId: savedSkin
        })
        setConnected(true)
      }
    }

    initializeLobby()

    return () => {
      console.log('🧹 Lobby cleanup - removing event listeners')

      // Remove all event listeners
      gameClient.off('joined', handleJoined)
      gameClient.off('playerJoined', handlePlayerJoined)
      gameClient.off('playerLeft', handlePlayerLeft)
      gameClient.off('gameStart', handleGameStart)

      // Leave room if user navigates away without starting the game
      if (!gameStartedRef.current && gameClient.playerId && roomCode) {
        console.log('🚪 User left lobby without starting game, calling leaveRoom')
        leaveRoom(roomCode.toUpperCase(), gameClient.playerId).catch(err => {
          console.error('Failed to leave room:', err)
        })
      }

      // Note: Don't disconnect here since PlayGame needs the same connection
    }
  }, [roomCode, navigate])

  // Removed: redundant player adding logic - loadRoomData and refreshRoomData handle all player state

  const handleStartGame = () => {
    console.log('🎮 Start game clicked, players:', players.length, 'isHost:', isHost, 'connected:', connected)
    if (!isHost) {
      console.log('❌ Not the host, cannot start game')
      return
    }
    if (!connected) {
      console.log('❌ Not connected to server yet')
      return
    }
    if (players.length === 0) {
      console.log('❌ No players in the game')
      return
    }
    if (!gameClient) {
      console.log('❌ No game client')
      return
    }
    console.log('✅ Sending startGame message with skin:', selectedSkin)

    // Update skin before starting game
    gameClient.skinId = selectedSkin
    gameClient.send({
      type: 'updateSkin',
      skinId: selectedSkin
    })

    gameClient.send({ type: 'startGame' })
  }

  // Refresh room data periodically
  const refreshRoomData = async () => {
    try {
      console.log('🔄 Refreshing room data...')
      const room = await getRoom(roomCode!.toUpperCase())

      // Convert Firestore player objects to our format
      const playersArray = Object.values(room.players || {}).map(player => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost
      }))

      console.log('🔄 Refreshed players:', playersArray)
      setPlayers(playersArray)

      // Determine if current user is host
      const myId = hostIdFromState || gameClient.playerId
      if (myId) {
        const isHostUser = myId === room.hostId
        setIsHost(isHostUser)
        console.log('🔍 Host check (refresh): myId=', myId, 'room.hostId=', room.hostId, 'isHost=', isHostUser)
      }
    } catch (error) {
      console.error('Failed to refresh room data:', error)
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      refreshRoomData()
    }, 2000) // Refresh every 2 seconds (faster than before)
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
          {/* Skin Selection */}
          <div className="bg-yellow-400 border-4 border-black p-6 mb-6 shadow-2xl">
            <h2 className="text-2xl font-black text-purple-900 mb-4">CHOOSE YOUR CAKE</h2>
            <div className="flex gap-4 justify-center">
              {skins.map((skin) => (
                <button
                  key={skin.id}
                  onClick={() => {
                    console.log('🎨 Skin selected:', skin.id)
                    setSelectedSkin(skin.id)
                    localStorage.setItem('flappySkin', skin.id)
                    console.log('🎨 Saved to localStorage:', localStorage.getItem('flappySkin'))
                    
                    // Send skin update to server immediately
                    if (gameClient.playerId && connected) {
                      gameClient.skinId = skin.id
                      gameClient.send({
                        type: 'updateSkin',
                        skinId: skin.id
                      })
                      console.log('🎨 Sent updateSkin to server:', skin.id)
                    }
                  }}
                  className={`border-4 border-black p-4 w-32 h-32 flex flex-col items-center justify-center gap-2 transition-all ${
                    selectedSkin === skin.id
                      ? 'bg-purple-600 scale-110'
                      : 'bg-purple-400 hover:bg-purple-500'
                  }`}
                >
                  <img src={skin.image} alt={skin.name} className="w-12 h-12 object-contain" />
                  <span className="text-white font-bold text-sm">{skin.name}</span>
                </button>
              ))}
            </div>
          </div>

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
                    className={`${playerColors[i % playerColors.length]} border-4 border-black p-4 text-center transition-colors`}
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
