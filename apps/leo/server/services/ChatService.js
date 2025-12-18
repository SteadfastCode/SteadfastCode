const dialogflow = require("@google-cloud/dialogflow");
const { Interaction } = require("../models/Interaction");
const SiteData = require("../models/SiteData");
const ScraperUtil = require("../utils/ScraperUtil");

const projectId = process.env.DIALOGFLOW_PROJECT_ID;

const ChatService = {
  async processQuery({ userId, businessId, query }) {
    // 1. Try Dialogflow Knowledge Base first
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.projectAgentSessionPath(
      projectId,
      userId || "anon"
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: { text: query, languageCode: "en" },
      },
      queryParams: {
        knowledgeBaseNames: [
          `projects/${projectId}/knowledgeBases/${businessId}`,
        ],
      },
    };

    const responses = await sessionClient.detectIntent(request);
    let responseText = responses[0].queryResult.fulfillmentText;

    // 2. Fallback to GPT for complex queries
    if (!responseText || responseText === "") {
      const siteData = await SiteData.findOne({ businessId });
      responseText = await generateGPTResponse(query, siteData);
    }

    // 3. Final fallback to simple pattern matching
    if (!responseText) {
      responseText = ScraperUtil.answerFromSiteData(query, siteData);
    }

    return (
      responseText ||
      "I'm not sure about that. Let me connect you with someone who can help."
    );
  },
};

module.exports = ChatService;
