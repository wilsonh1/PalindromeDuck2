var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var LeaderboardSchema = new Schema({
    user_id: {type: String, unique: true},
    name: String,
    points: Number
});

module.exports = mongoose.model("Leaderboard", LeaderboardSchema);
