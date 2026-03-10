const mongoose = require("mongoose");

const doubtSchema = new mongoose.Schema({

question: String,
answer: String,

userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
}

},{
timestamps:true
});

module.exports = mongoose.model("Doubt", doubtSchema);