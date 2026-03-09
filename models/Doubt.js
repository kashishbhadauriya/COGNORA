const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({
question: String,
answer: String
},{
timestamps:true
});

module.exports = mongoose.model("Doubt", doubtSchema);