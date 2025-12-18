const {
  IntentsClient,
  DocumentsClient,
  KnowledgeBasesClient,
} = require("@google-cloud/dialogflow");
const { leoAIKnowledgeBase } = require("./LeoAIKnowledgeBase");

const dialogflowClient = new IntentsClient({
  keyFilename: process.env.DIALOGFLOW_KEYFILE,
});

const documentsClient = new DocumentsClient({
  keyFilename: process.env.DIALOGFLOW_KEYFILE,
});

const knowledgeBasesClient = new KnowledgeBasesClient({
  keyFilename: process.env.DIALOGFLOW_KEYFILE,
});

async function manageIntent(intentData, projectId) {
  const parent = `projects/${projectId}/agent`;

  const intent = {
    displayName: intentData.displayName,
    trainingPhrases: intentData.trainingPhrases
      .filter((phrase) => phrase.trim())
      .map((phrase) => ({
        type: "EXAMPLE",
        parts: [{ text: phrase }],
      })),
    messages: [
      {
        text: {
          text: intentData.responses.filter((response) => response.trim()),
        },
      },
    ],
  };

  // Check if intent exists
  const [existingIntents] = await dialogflowClient.listIntents({ parent });
  const existingIntent = existingIntents.find(
    (i) => i.displayName === intentData.displayName
  );

  if (existingIntent) {
    // Update existing intent
    const request = {
      intent: {
        name: existingIntent.name,
        ...intent,
      },
    };
    const [response] = await dialogflowClient.updateIntent(request);
    return {
      name: intentData.displayName,
      status: "updated",
      intentId: response.name,
    };
  } else {
    // Create new intent
    const request = { parent, intent };
    const [response] = await dialogflowClient.createIntent(request);
    return {
      name: intentData.displayName,
      status: "created",
      intentId: response.name,
    };
  }
}

async function listIntents(projectId) {
  const parent = `projects/${projectId}/agent`;
  const [intents] = await dialogflowClient.listIntents({ parent });
  return intents;
}

async function createKnowledgeBase(projectId, businessName) {
  const parent = `projects/${projectId}`;
  const knowledgeBase = {
    displayName: `${businessName} Knowledge Base`,
  };

  const [response] = await knowledgeBasesClient.createKnowledgeBase({
    parent,
    knowledgeBase,
  });
  return response.name;
}

async function uploadDocument(
  knowledgeBaseName,
  documentContent,
  businessName
) {
  const document = {
    displayName: `${businessName} FAQ`,
    mimeType: "text/csv",
    knowledgeTypes: ["FAQ"],
    rawContent: Buffer.from(documentContent).toString("base64"),
  };

  const [operation] = await documentsClient.createDocument({
    parent: knowledgeBaseName,
    document,
  });
  return operation;
}

async function createOrUpdateLeoAIKnowledgeBase(projectId) {
  try {
    const parent = `projects/${projectId}`;

    // Check if LeoAI knowledge base already exists
    const [knowledgeBases] = await knowledgeBasesClient.listKnowledgeBases({
      parent,
    });
    let existingKB = knowledgeBases.find(
      (kb) => kb.displayName === "LeoAI Knowledge Base"
    );

    let knowledgeBaseName;

    if (existingKB) {
      console.log("LeoAI Knowledge Base already exists:", existingKB.name);
      knowledgeBaseName = existingKB.name;

      // Check if document already exists
      const [documents] = await documentsClient.listDocuments({
        parent: knowledgeBaseName,
      });
      const existingDoc = documents.find(
        (doc) => doc.displayName === "LeoAI FAQ"
      );

      if (existingDoc) {
        console.log("Deleting existing document to recreate with new content");
        // Delete the existing document first
        await documentsClient.deleteDocument({
          name: existingDoc.name,
        });
        console.log("Document deleted, waiting before recreating...");
        // Wait a bit for the deletion to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } else {
      // Create new knowledge base
      knowledgeBaseName = await createKnowledgeBase(projectId, "LeoAI");
      console.log("LeoAI Knowledge Base created:", knowledgeBaseName);
    }

    // Upload/create the document (always create new since we deleted above)
    const operation = await uploadDocument(
      knowledgeBaseName,
      leoAIKnowledgeBase,
      "LeoAI"
    );

    console.log("LeoAI Knowledge Base document uploaded");
    return knowledgeBaseName;
  } catch (error) {
    console.error("Error creating/updating LeoAI Knowledge Base:", error);
    throw error;
  }
}

module.exports = {
  manageIntent,
  listIntents,
  createKnowledgeBase,
  uploadDocument,
  createOrUpdateLeoAIKnowledgeBase,
};
