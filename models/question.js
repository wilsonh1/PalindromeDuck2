var mongoose = require('mongoose');
var Schema = mongoose.Schema

var QuestionSchema = new Schema ({
   timestamp: Number,
   gameId: Number,
   senderId: String,
   problemIndex: Number
});

module.exports = mongoose.model("Question", QuestionSchema)
