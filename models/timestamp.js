var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var PalindromeSchema = new Schema({
    timestamp: {type: Date, unique: true},
    user_id: String
});

module.exports = mongoose.model("Palindrome", PalindromeSchema);
