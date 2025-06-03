const express = require('express');
const router = express.Router();
const ChatService = require('../services/ChatService');

// POST /api/chat
router.post('/', async (req, res) => {
  const { userId, businessId, query } = req.body;
  try {
    const response = await ChatService.processQuery({ userId, businessId, query });
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Chat processing failed.' });
  }
});

module.exports = router;