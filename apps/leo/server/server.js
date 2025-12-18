const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(
  cors({
    origin: ["https://steadfastcode.tech", "http://localhost:8080"],
  })
);
app.use(express.json());

// Set MongoDB connection as app local for routes
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("MongoDB connected");
    app.locals.db = mongoose.connection.db;
  })
  .catch((error) => console.error("MongoDB connection error:", error));

const inquirySchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
});
const Inquiry = mongoose.model("Inquiry", inquirySchema);

app.post("/api/inquiry", async (req, res) => {
  try {
    const inquiry = new Inquiry(req.body);
    await inquiry.save();
    res.status(201).send("Inquiry saved");
  } catch (error) {
    res.status(400).send("Error saving inquiry");
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// Mount routers
const chatRouter = require("./routes/chat");
app.use("/api/chat", chatRouter);

const intentsRouter = require("./routes/intents");
app.use("/api/intents", intentsRouter);

app.use("/api/test", require("./routes/test-dialogflow"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
