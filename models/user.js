var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema({
    user_id: {type: String, unique: true},
    p_id: Number,
    game_id: {type: Number, default: 0},
    current_problem: {type: Number, default: 0},
    unix: Number,
    count: Number,
    correct: Number,
    time: Number
});

module.exports = mongoose.model("User", UserSchema);
