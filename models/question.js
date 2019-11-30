var mongoose = require('mongoose');
var Schema = mongoose.Schema

var QuestionSchema = new Schema ({
   timestamp: {type: Number, default: 0},
   gameId: Number,
   senderId: String,
   problemIndex: Number
});

module.exports = mongoose.model("Question", QuestionSchema)
