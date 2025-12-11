import { createContext, useContext, useRef, ReactNode, useEffect } from 'react'
import { GameClient } from '../game-client'

interface GameContextType {
  getGameClient: () => GameClient
  createNewClient: () => GameClient
}

const GameContext = createContext<GameContextType | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const gameClientRef = useRef<GameClient | null>(null)

  const getGameClient = () => {
    if (!gameClientRef.current) {
      gameClientRef.current = new GameClient()
    }
    return gameClientRef.current
  }

  const createNewClient = () => {
    // Disconnect old client completely
    if (gameClientRef.current) {
      gameClientRef.current.disconnect()
    }
    // Create new client
    gameClientRef.current = new GameClient()
    return gameClientRef.current
  }

  return (
    <GameContext.Provider value={{ getGameClient, createNewClient }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGameClient() {
  const context = useContext(GameContext)
  if (!context) {
    throw new Error('useGameClient must be used within GameProvider')
  }
  return context.getGameClient()
}

export function useNewGameClient() {
  const context = useContext(GameContext)
  const clientRef = useRef<GameClient | null>(null)

  if (!context) {
    throw new Error('useNewGameClient must be used within GameProvider')
  }

  // Create client only once on mount
  if (!clientRef.current) {
    clientRef.current = context.createNewClient()
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (clientRef.current) {
        clientRef.current.disconnect()
      }
    }
  }, [])

  return clientRef.current
}
