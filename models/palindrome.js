var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PalindromeSchema = new Schema({
    timestamp: {type: Date, unique: true},
    unix: Number,
    user_id: String,
    points: Number
});

module.exports = mongoose.model("Palindrome", PalindromeSchema);
