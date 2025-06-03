const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
