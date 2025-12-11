import { Firestore } from "@google-cloud/firestore";
import functions from "@google-cloud/functions-framework";

const db = new Firestore();
const ROOMS_COLLECTION = "rooms";

functions.http("updateRoomState", async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "PUT, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "PUT") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const code = req.body.code?.toUpperCase();
    const state = req.body.state;

    if (!code || !state) {
      res.status(400).json({ error: "Room code and state required" });
      return;
    }

    if (!["waiting", "playing", "finished"].includes(state)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const roomRef = db.collection(ROOMS_COLLECTION).doc(code);
    const doc = await roomRef.get();

    if (!doc.exists) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    await roomRef.update({ state });

    const updatedDoc = await roomRef.get();
    res.status(200).json(updatedDoc.data());
  } catch (error) {
    console.error("Error updating room state:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
