import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { createRoom, joinRoom } from '../services/lobbyService'
import { CHARACTERS, DEFAULT_CHARACTER, type Character } from '../config/characters'

export default function Home() {
  const [mode, setMode] = useState<'host' | 'join' | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(DEFAULT_CHARACTER)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Load saved name and character on mount
  useEffect(() => {
    const savedName = localStorage.getItem('flappyPlayerName')
    if (savedName) {
      setPlayerName(savedName)
    }
    const savedCharacterId = localStorage.getItem('flappyCharacterId')
    if (savedCharacterId) {
      const character = CHARACTERS.find(c => c.id === savedCharacterId)
      if (character) {
        setSelectedCharacter(character)
      }
    }
  }, [])

  const handleHost = async () => {
    if (playerName.trim().length === 0) {
      setError('Please enter your name first!')
      return
    }

    setLoading(true)
    setError('')
    try {
      // Store name and character in localStorage
      const cleanName = playerName.trim()
      localStorage.setItem('flappyPlayerName', cleanName)
      localStorage.setItem('flappyCharacterId', selectedCharacter.id)

      const room = await createRoom(cleanName)
      // Pass the hostId via state so the lobby knows this user is the host
      navigate(`/lobby/${room.code}`, { state: { hostId: room.hostId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (roomCode.length !== 4) return
    if (playerName.trim().length === 0) {
      setError('Please enter your name first!')
      return
    }

    setLoading(true)
    setError('')
    try {
      // Store name and character in localStorage
      const cleanName = playerName.trim()
      localStorage.setItem('flappyPlayerName', cleanName)
      localStorage.setItem('flappyCharacterId', selectedCharacter.id)

      await joinRoom(roomCode.toUpperCase(), cleanName)
      navigate(`/lobby/${roomCode.toUpperCase()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join room')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col">
      {/* Header */}
      <div className="bg-purple-800 border-b-4 border-black p-6">
        <div className="text-center">
          <h1 className="text-7xl font-black text-yellow-400 leading-none">
            FLAPPY CAKES
          </h1>
          <p className="text-white text-xl font-bold mt-2">
            Sweet multiplayer bird battles!
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl">
          {!mode ? (
            <div className="bg-yellow-400 border-4 border-black p-8 shadow-2xl">
              <div className="text-center mb-8">
                <div className="text-purple-900 text-2xl font-black">
                  Get ready for sweet multiplayer action!
                </div>
              </div>

              {error && (
                <div className="bg-red-500 border-2 border-black p-4 text-white font-bold text-center mb-6">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-purple-900 font-bold text-lg mb-2">
                    YOUR NAME
                  </label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name..."
                    maxLength={20}
                    className="w-full px-4 py-3 text-xl border-4 border-black rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-400 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-purple-900 font-bold text-lg mb-2">
                    CHOOSE YOUR CHARACTER
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {CHARACTERS.map((character) => (
                      <button
                        key={character.id}
                        type="button"
                        onClick={() => setSelectedCharacter(character)}
                        className={`p-3 border-4 border-black bg-white hover:bg-yellow-200 transition-colors ${
                          selectedCharacter.id === character.id
                            ? 'ring-4 ring-blue-500 bg-yellow-200'
                            : ''
                        }`}
                        title={character.description}
                      >
                        <div className="aspect-square bg-gray-200 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                          <img
                            src={character.sprite}
                            alt={character.name}
                            className="w-full h-full object-contain p-2"
                          />
                        </div>
                        <div className="text-xs font-bold text-purple-900 text-center">
                          {character.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleHost}
                  disabled={loading || playerName.trim().length === 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-black py-4 px-6 border-4 border-black text-xl disabled:opacity-50"
                >
                  {loading ? 'CREATING...' : 'HOST GAME'}
                </button>

                <button
                  onClick={() => setMode('join')}
                  disabled={loading || playerName.trim().length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-black py-4 px-6 border-4 border-black text-xl disabled:opacity-50"
                >
                  JOIN GAME
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-400 border-4 border-black p-8 shadow-2xl">
              <button
                onClick={() => {
                  setMode(null)
                  setError('')
                }}
                className="text-purple-900 hover:text-purple-700 font-black text-xl mb-6"
              >
                ← BACK TO MENU
              </button>

              <div className="text-center mb-8">
                <h2 className="text-4xl font-black text-purple-900 mb-4">
                  ENTER ROOM CODE
                </h2>
                <p className="text-purple-800 text-lg font-bold">
                  Type the 4-letter code from your host
                </p>
              </div>

              {error && (
                <div className="bg-red-500 border-2 border-black p-4 text-white font-bold text-center mb-6">
                  {error}
                </div>
              )}

              <div className="space-y-6">
                <input
                  type="text"
                  maxLength={4}
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-full text-center text-5xl font-black tracking-widest uppercase bg-white border-4 border-black p-4 text-purple-900 focus:outline-none focus:bg-yellow-200"
                  placeholder="ROOM"
                />

                <button
                  onClick={handleJoin}
                  disabled={roomCode.length !== 4 || loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-black py-4 px-6 border-4 border-black text-xl disabled:opacity-50"
                >
                  {loading ? 'JOINING...' : 'JOIN ROOM'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
