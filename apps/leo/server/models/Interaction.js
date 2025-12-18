const mongoose = require('mongoose');
const InteractionSchema = new mongoose.Schema({
  userId: String,
  businessId: String,
  query: String,
  response: String,
  timestamp: Date
});
module.exports.Interaction = mongoose.model('Interaction', InteractionSchema);