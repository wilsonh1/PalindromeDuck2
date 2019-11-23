var mongoose = require('mongoose')
var Schema = mongoose.Schema;

var CountdownSchema = new Schema ({
    count: Number,
    people: [mongoose.Schema.Types.Mixed],
    scores: [mongoose.Schema.Types.Mixed], // used to store scores for each individual (maybe consider leaderboard object?)
    problems: [mongoose.Schema.Types.Mixed] // number of problems can be fixed for now -- maybe 10? 
});

module.exports = mongoose.model("Countodwn", CountdownSchema)
