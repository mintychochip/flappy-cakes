import { Firestore, FieldValue } from "@google-cloud/firestore";
import functions from "@google-cloud/functions-framework";

const db = new Firestore();
const ROOMS_COLLECTION = "rooms";

functions.http("joinRoom", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const code = req.body.code?.toUpperCase();
    const playerId = req.body.playerId || crypto.randomUUID();
    const playerName = req.body.playerName || "Anonymous";

    if (!code) {
      res.status(400).json({ error: "Room code required" });
      return;
    }

    const roomRef = db.collection(ROOMS_COLLECTION).doc(code);
    const doc = await roomRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const room = doc.data();

    if (room.state !== "waiting") {
      res.status(400).json({ error: "Game already started" });
      return;
    }

    // Add player if not already in room
    if (!room.players[playerId]) {
      await roomRef.update({
        [`players.${playerId}`]: {
          id: playerId,
          name: playerName,
          joinedAt: Date.now(),
          isHost: room.hostId === playerId
        }
      });
    }

    const updatedDoc = await roomRef.get();

    res.status(200).json({ playerId, room: updatedDoc.data() });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
