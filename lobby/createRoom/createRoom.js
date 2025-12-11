import { Firestore } from "@google-cloud/firestore";
import functions from "@google-cloud/functions-framework";

const db = new Firestore();
const ROOMS_COLLECTION = "rooms";

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

functions.http("createRoom", async (req, res) => {
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
    let code = generateRoomCode();

    // Ensure unique code
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.collection(ROOMS_COLLECTION).doc(code).get();
      if (!existing.exists) break;
      code = generateRoomCode();
      attempts++;
    }

    const hostId = crypto.randomUUID();
    const hostName = req.body.hostName || "Host";

    const room = {
      code,
      hostId,
      players: {
        [hostId]: {
          id: hostId,
          name: hostName,
          joinedAt: Date.now(),
          isHost: true
        }
      },
      state: "waiting",
      createdAt: Date.now(),
    };

    await db.collection(ROOMS_COLLECTION).doc(code).set(room);

    res.status(201).json(room);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
