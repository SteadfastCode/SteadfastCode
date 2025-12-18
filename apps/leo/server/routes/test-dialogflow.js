const express = require("express");
const router = express.Router();
const { createOrUpdateLeoAIKnowledgeBase } = require("../utils/DialogFlow");
const dialogflow = require("@google-cloud/dialogflow");

router.post("/setup-leoai-kb", async (req, res) => {
  try {
    const projectId = process.env.DIALOGFLOW_PROJECT_ID;
    console.log("Setting up LeoAI Knowledge Base for project:", projectId);

    const knowledgeBaseName = await createOrUpdateLeoAIKnowledgeBase(projectId);

    res.json({
      success: true,
      message: "LeoAI Knowledge Base created/updated successfully",
      knowledgeBaseName,
    });
  } catch (error) {
    console.error("Setup error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/list-kb", async (req, res) => {
  try {
    const knowledgeBasesClient = new dialogflow.KnowledgeBasesClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const [knowledgeBases] = await knowledgeBasesClient.listKnowledgeBases({
      parent: `projects/${process.env.DIALOGFLOW_PROJECT_ID}`,
    });

    res.json({
      success: true,
      knowledgeBases: knowledgeBases.map((kb) => ({
        name: kb.name,
        displayName: kb.displayName,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/list-documents", async (req, res) => {
  try {
    const documentsClient = new dialogflow.DocumentsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const knowledgeBaseName =
      "projects/summer-mountain-462001-j1/knowledgeBases/NjMzMjUwMzkwNDM5MTAwNDE2MQ";

    const [documents] = await documentsClient.listDocuments({
      parent: knowledgeBaseName,
    });

    res.json({
      success: true,
      documents: documents.map((doc) => ({
        name: doc.name,
        displayName: doc.displayName,
        state: doc.state,
        mimeType: doc.mimeType,
        knowledgeTypes: doc.knowledgeTypes,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/test-kb-query", async (req, res) => {
  try {
    const { query = "What is LeoAI?" } = req.body;

    const sessionClient = new dialogflow.SessionsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      "test-session"
    );

    // Get the actual knowledge base name dynamically
    const knowledgeBasesClient = new dialogflow.KnowledgeBasesClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const [knowledgeBases] = await knowledgeBasesClient.listKnowledgeBases({
      parent: `projects/${process.env.DIALOGFLOW_PROJECT_ID}`,
    });

    const leoKB = knowledgeBases.find(
      (kb) => kb.displayName === "LeoAI Knowledge Base"
    );

    if (!leoKB) {
      return res.status(404).json({ error: "LeoAI Knowledge Base not found" });
    }

    const request = {
      session: sessionPath,
      queryInput: {
        text: { text: query, languageCode: "en" },
      },
      queryParams: {
        knowledgeBaseNames: [leoKB.name],
      },
    };

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    res.json({
      query,
      fulfillmentText: result.fulfillmentText,
      knowledgeAnswers: result.knowledgeAnswers,
      confidence: result.intentDetectionConfidence,
      knowledgeBaseName: leoKB.name,
      allFields: result,
    });
  } catch (error) {
    console.error("KB test error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/test-kb-query-beta", async (req, res) => {
  try {
    const { query = "What is LeoAI?" } = req.body;

    // Use v2beta1 for better knowledge base support
    const dialogflowBeta = require("@google-cloud/dialogflow").v2beta1;

    const sessionClient = new dialogflowBeta.SessionsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      "test-session"
    );

    const knowledgeBasesClient = new dialogflowBeta.KnowledgeBasesClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const [knowledgeBases] = await knowledgeBasesClient.listKnowledgeBases({
      parent: `projects/${process.env.DIALOGFLOW_PROJECT_ID}`,
    });

    const leoKB = knowledgeBases.find(
      (kb) => kb.displayName === "LeoAI Knowledge Base"
    );

    if (!leoKB) {
      return res.status(404).json({ error: "LeoAI Knowledge Base not found" });
    }

    const request = {
      session: sessionPath,
      queryInput: {
        text: { text: query, languageCode: "en" },
      },
      queryParams: {
        knowledgeBaseNames: [leoKB.name],
      },
    };

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    // Debug logging
    console.log(
      "Knowledge Answers:",
      JSON.stringify(result.knowledgeAnswers, null, 2)
    );

    res.json({
      query,
      fulfillmentText: result.fulfillmentText,
      knowledgeAnswers: result.knowledgeAnswers,
      confidence: result.intentDetectionConfidence,
      knowledgeBaseName: leoKB.name,
      hasKnowledgeAnswers: !!result.knowledgeAnswers,
      // Add detailed answer extraction
      extractedAnswer:
        result.knowledgeAnswers?.answers?.[0]?.answer || "No answer found",
      matchConfidence:
        result.knowledgeAnswers?.answers?.[0]?.matchConfidence || 0,
      allFields: result,
    });
  } catch (error) {
    console.error("KB test error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create a fallback intent that uses knowledge base
router.post("/create-kb-intent", async (req, res) => {
  try {
    const intentsClient = new dialogflow.IntentsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const parent = `projects/${process.env.DIALOGFLOW_PROJECT_ID}/agent`;

    // First, let's update the existing fallback intent
    const [existingIntents] = await intentsClient.listIntents({ parent });
    const fallbackIntent = existingIntents.find(
      (intent) => intent.displayName === "Default Fallback Intent"
    );

    if (fallbackIntent) {
      const updatedIntent = {
        name: fallbackIntent.name,
        displayName: "Default Fallback Intent",
        isFallback: true,
        messages: [
          {
            text: {
              text: ["$Knowledge.Answer"],
            },
          },
        ],
      };

      const [response] = await intentsClient.updateIntent({
        intent: updatedIntent,
      });

      res.json({
        success: true,
        message: "Default fallback intent updated to use Knowledge Base",
        intentName: response.name,
      });
    } else {
      res.status(404).json({ error: "Default Fallback Intent not found" });
    }
  } catch (error) {
    console.error("Intent update error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/get-document-content", async (req, res) => {
  try {
    const documentsClient = new dialogflow.DocumentsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const knowledgeBasesClient = new dialogflow.KnowledgeBasesClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    // Get the knowledge base
    const [knowledgeBases] = await knowledgeBasesClient.listKnowledgeBases({
      parent: `projects/${process.env.DIALOGFLOW_PROJECT_ID}`,
    });

    const leoKB = knowledgeBases.find(
      (kb) => kb.displayName === "LeoAI Knowledge Base"
    );

    if (!leoKB) {
      return res.status(404).json({ error: "LeoAI Knowledge Base not found" });
    }

    // Get documents in the knowledge base
    const [documents] = await documentsClient.listDocuments({
      parent: leoKB.name,
    });

    const leoDoc = documents.find((doc) => doc.displayName === "LeoAI FAQ");

    if (!leoDoc) {
      return res.status(404).json({ error: "LeoAI FAQ document not found" });
    }

    // Get the specific document
    const [document] = await documentsClient.getDocument({
      name: leoDoc.name,
    });

    res.json({
      success: true,
      document: {
        name: document.name,
        displayName: document.displayName,
        state: document.state,
        mimeType: document.mimeType,
        content: document.rawContent
          ? Buffer.from(document.rawContent, "base64").toString("utf-8")
          : "No content available",
        knowledgeTypes: document.knowledgeTypes,
      },
    });
  } catch (error) {
    console.error("Get document error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
