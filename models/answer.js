var mongoose = require('mongoose');
var Schema = mongoose.Schema

var AnswerSchema = new Schema ({
   timestamp: Number,
   gameId: Number,
   senderId: String,
   problemIndex: Number
});

module.exports = mongoose.model("Answer", AnswerSchema)
