const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateIntentsFromBusiness(businessDescription, siteData) {
  const prompt = `
Generate customer service intents for this business:
${businessDescription}

Business hours: ${siteData.hours}
Services: ${siteData.services?.join(", ")}
Location: ${siteData.location}

Create 10-15 common customer questions with training phrases and responses.
Format as JSON array with: displayName, trainingPhrases[], responses[]
`;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return JSON.parse(response.choices[0].message.content);
}

module.exports = { generateIntentsFromBusiness };
