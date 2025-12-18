const cheerio = require("cheerio");
function generateFAQContent(siteData) {
  let faqContent = "";

  if (siteData.hours) {
    faqContent += `Q: What are your hours?\nA: ${siteData.hours}\n\n`;
  }

  if (siteData.contact) {
    faqContent += `Q: How can I contact you?\nA: ${siteData.contact}\n\n`;
  }

  if (siteData.services) {
    faqContent += `Q: What services do you offer?\nA: ${siteData.services.join(", ")}\n\n`;
  }

  if (siteData.location) {
    faqContent += `Q: Where are you located?\nA: ${siteData.location}\n\n`;
  }

  return faqContent;
}

module.exports = {
  // Example: Extract answer from site data for common queries
  answerFromSiteData(query, siteData) {
    if (!siteData) return "";
    const q = query.toLowerCase();
    if (q.includes("hour")) return siteData.hours || "";
    if (q.includes("service")) return (siteData.services || []).join(", ");
    if (q.includes("contact")) return siteData.contact || "";
    if (q.includes("faq")) return (siteData.faqs || []).join("\n");
    return "";
  },
  // Add scraping logic as needed
  generateFAQContent,
};
