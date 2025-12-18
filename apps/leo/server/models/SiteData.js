const mongoose = require('mongoose');
const SiteDataSchema = new mongoose.Schema({
  businessId: String,
  hours: String,
  services: [String],
  contact: String,
  faqs: [String]
});
module.exports = mongoose.model('SiteData', SiteDataSchema);