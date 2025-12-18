const mongoose = require("mongoose");

const intentSchema = new mongoose.Schema({
  displayName: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    enum: ["created", "updated", "skipped"],
    required: true,
  },
  intentId: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Intent", intentSchema);