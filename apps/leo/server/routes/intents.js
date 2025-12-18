const express = require("express");
const router = express.Router();
const { manageIntent, listIntents } = require("../utils/DialogFlow");
const Intent = require("../models/Intent");

// Middleware for admin authentication
router.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
});

// GET endpoint to list intents
router.get("/", async (req, res) => {
  try {
    const intents = await listIntents(process.env.PROJECT_ID);
    res.json({ intents });
  } catch (error) {
    console.error("Error listing intents:", error);
    res
      .status(500)
      .json({ error: "Failed to list intents", details: error.message });
  }
});

// POST endpoint for batch intent management
router.post("/", async (req, res) => {
  const { intents } = req.body;
  try {
    if (!Array.isArray(intents)) {
      return res
        .status(400)
        .json({ error: "Request body must contain an array of intents" });
    }
    const results = [];
    for (const intent of intents) {
      if (
        !intent.displayName ||
        !intent.trainingPhrases?.length ||
        !intent.responses?.length
      ) {
        results.push({
          name: intent.displayName || "Unnamed",
          status: "skipped",
          error: "Missing required fields",
        });
        continue;
      }
      const result = await manageIntent(intent, process.env.PROJECT_ID);
      // Store intent metadata in MongoDB using Intent model
      await Intent.updateOne(
        { displayName: intent.displayName },
        { $set: { ...result, updatedAt: new Date() } },
        { upsert: true }
      );
      results.push(result);
    }
    res.json({ message: `Processed ${results.length} intents`, results });
  } catch (error) {
    console.error("Error processing intents:", error);
    res
      .status(500)
      .json({ error: "Failed to process intents", details: error.message });
  }
});

module.exports = router;
