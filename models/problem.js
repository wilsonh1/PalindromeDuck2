var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ProblemSchema = new Schema({
    p_id: {type: Number, unique: true},
    statement: String,
    answer: String,
    image: String
});

module.exports = mongoose.model("Problem", ProblemSchema);
