const moongose = require("mongoose");

const chatSchema = new moongose.Schema({
    message: String,
    response: String,
    user: {
        type: moongose.Schema.Types.ObjectId,
        ref: "User"
    }
},{
    timestamps: true
});

module.exports = moongose.model("Chat", chatSchema);