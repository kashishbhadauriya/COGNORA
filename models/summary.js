const mongoose = require("mongoose");

const summarySchema = new mongoose.Schema({
    filename: String,
    originalText: String,
    summary: String,
    createdAt: {
        type: Date,
        default: Date.now
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

module.exports = mongoose.model("Summary", summarySchema);