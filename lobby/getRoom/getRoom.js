const { Firestore } = require("@google-cloud/firestore");
const functions = require("@google-cloud/functions-framework");

const db = new Firestore();
const ROOMS_COLLECTION = "rooms";

functions.http("getRoom", async (req, res) => {
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

    if (!code) {
      res.status(400).json({ error: "Room code required" });
      return;
    }

    const doc = await db.collection(ROOMS_COLLECTION).doc(code).get();

    if (!doc.exists) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.status(200).json(doc.data());
  } catch (error) {
    console.error("Error getting room:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
