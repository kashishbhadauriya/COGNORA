const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({

filename: String,
quizText: String,

user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
}

},{
timestamps:true
});

module.exports = mongoose.model("Quiz", quizSchema);