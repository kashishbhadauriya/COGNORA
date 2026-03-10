const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema({
  question: String,
  answer: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

const Flashcard = mongoose.model("Flashcard", flashcardSchema);

module.exports = Flashcard;