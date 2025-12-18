const express = require("express");
const router = express.Router();
const dialogflowBeta = require("@google-cloud/dialogflow").v2beta1;
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", async (req, res) => {
  try {
    const { query, userId = "test-user" } = req.body;

    const sessionClient = new dialogflowBeta.SessionsClient({
      keyFilename: process.env.DIALOGFLOW_KEYFILE,
    });

    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      userId
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

    const request = {
      session: sessionPath,
      queryInput: {
        text: { text: query, languageCode: "en" },
      },
    };

    if (leoKB) {
      request.queryParams = {
        knowledgeBaseNames: [leoKB.name],
      };
    }

    const [response] = await sessionClient.detectIntent(request);
    const result = response.queryResult;

    // Check for knowledge answers first
    if (result.knowledgeAnswers?.answers?.length > 0) {
      const bestAnswer = result.knowledgeAnswers.answers[0];

      // If we have OpenAI key and good confidence, enhance the response
      if (process.env.OPENAI_API_KEY && bestAnswer.matchConfidence > 0.7) {
        try {
          const gptResponse = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
              {
                role: "system",
                content:
                  "You are Leo, the friendly AI assistant for LeoAI. Answer questions naturally and conversationally based on the provided information. Keep responses concise but helpful.",
              },
              {
                role: "user",
                content: `User asked: "${query}"\n\nKnowledge base info: ${bestAnswer.answer}\n\nPlease provide a natural, contextual response.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 150,
          });

          return res.json({
            response: gptResponse.choices[0].message.content,
            confidence: bestAnswer.matchConfidence,
            source: "gpt-enhanced",
          });
        } catch (openaiError) {
          console.error("OpenAI Error:", openaiError);
          // Fall back to direct answer
        }
      }

      // Return direct KB answer
      return res.json({
        response: bestAnswer.answer,
        confidence: bestAnswer.matchConfidence,
        source: "dialogflow-kb",
      });
    }

    // Fallback
    res.json({
      response:
        result.fulfillmentText ||
        "I'm not sure about that. Let me connect you with someone who can help.",
      confidence: result.intentDetectionConfidence || 0,
      source: "dialogflow",
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Chat service unavailable" });
  }
});

module.exports = router;
