import { Firestore, FieldValue } from "@google-cloud/firestore";
import functions from "@google-cloud/functions-framework";

const db = new Firestore();
const ROOMS_COLLECTION = "rooms";

functions.http("leaveRoom", async (req, res) => {
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
    const playerId = req.body.playerId;

    if (!code || !playerId) {
      res.status(400).json({ error: "Room code and player ID required" });
      return;
    }

    const roomRef = db.collection(ROOMS_COLLECTION).doc(code);
    const doc = await roomRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    await roomRef.update({
      players: FieldValue.arrayRemove(playerId),
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error leaving room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
