import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { GameProvider } from './contexts/GameContext'
import Home from './pages/Home'
import Lobby from './pages/Lobby'
import HostGame from './pages/HostGame'
import PlayGame from './pages/PlayGame'
import Controller from './pages/Controller'
import GameOver from './pages/GameOver'
import Embed from './pages/Embed'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <GameProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
        <Route path="/host/:roomCode" element={<HostGame />} />
        <Route path="/play/:roomCode" element={<PlayGame />} />
        <Route path="/controller/:roomCode" element={<Controller />} />
        <Route path="/game-over" element={<GameOver />} />
        <Route path="/embed" element={<Embed />} />
        <Route path="/embed/:roomCode" element={<Embed />} />
      </Routes>
    </GameProvider>
  </BrowserRouter>
)
