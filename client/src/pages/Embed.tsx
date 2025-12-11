import { useState } from 'react'
import { useParams } from 'react-router-dom'

export default function Embed() {
  const { roomCode } = useParams<{ roomCode?: string }>()
  const [copied, setCopied] = useState(false)

  // Generate embed code
  const baseUrl = window.location.origin
  const embedUrl = roomCode
    ? `${baseUrl}/game-embed.html?room=${roomCode}`
    : `${baseUrl}/game-embed.html?room=YOUR_ROOM_CODE`

  const embedCode = `<iframe
  src="${embedUrl}"
  width="400"
  height="600"
  frameborder="0"
  style="border: none; max-width: 100%;"
  allowfullscreen
></iframe>`

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-purple-900 flex flex-col">
      {/* Header */}
      <div className="bg-purple-800 border-b-4 border-black p-6">
        <div className="text-center">
          <h1 className="text-6xl font-black text-yellow-400 leading-none">
            FLAPPY CAKES
          </h1>
          <p className="text-white text-xl font-bold mt-2">
            Embed on your website
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Embed Code Section */}
          <div className="bg-yellow-400 border-4 border-black p-8 shadow-2xl">
            <h2 className="text-3xl font-black text-purple-900 mb-6">
              EMBED CODE
            </h2>

            <div className="bg-purple-900 border-2 border-black p-4 mb-6 overflow-x-auto">
              <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
            </div>

            <button
              onClick={handleCopy}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 border-4 border-black text-xl"
            >
              {copied ? 'COPIED!' : 'COPY CODE'}
            </button>
          </div>

          {/* Preview Section */}
          <div className="bg-yellow-400 border-4 border-black p-8 shadow-2xl">
            <h2 className="text-3xl font-black text-purple-900 mb-6">
              PREVIEW
            </h2>

            <div className="flex justify-center bg-purple-200 p-6 border-2 border-purple-900">
              <iframe
                src={embedUrl}
                width="400"
                height="600"
                style={{ border: 'none', maxWidth: '100%' }}
                title="Flappy Cakes Game Preview"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-400 border-4 border-black p-8 shadow-2xl">
            <h2 className="text-3xl font-black text-purple-900 mb-6">
              HOW TO EMBED
            </h2>

            <ol className="space-y-4 text-lg">
              <li className="flex items-start">
                <span className="font-black text-purple-900 mr-3 text-xl">1.</span>
                <span className="text-purple-900 font-medium">Create a room and get your room code</span>
              </li>
              <li className="flex items-start">
                <span className="font-black text-purple-900 mr-3 text-xl">2.</span>
                <span className="text-purple-900 font-medium">Replace <code className="bg-purple-900 text-yellow-400 px-3 py-1 font-mono">YOUR_ROOM_CODE</code> with your actual room code</span>
              </li>
              <li className="flex items-start">
                <span className="font-black text-purple-900 mr-3 text-xl">3.</span>
                <span className="text-purple-900 font-medium">Paste the code into your HTML website</span>
              </li>
              <li className="flex items-start">
                <span className="font-black text-purple-900 mr-3 text-xl">4.</span>
                <span className="text-purple-900 font-medium">Players can join your room and play together!</span>
              </li>
            </ol>

            <div className="mt-8 p-6 bg-orange-400 border-4 border-black">
              <p className="text-purple-900 font-black text-xl mb-2">SWEET TIP:</p>
              <p className="text-purple-900 font-medium">
                Create a permanent room for your website by using the same room code.
                Anyone visiting your site can join and play!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-purple-800 border-t-4 border-black p-6 text-center">
        <p className="text-yellow-400 font-bold text-lg">
          Easy embedding for sweet multiplayer fun!
        </p>
      </div>
    </div>
  )
}
