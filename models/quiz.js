const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
filename: String,
quizText: String
},{
timestamps:true
});

module.exports = mongoose.model("Quiz", quizSchema);