var mongoose = require('mongoose')
var Schema = mongoose.Schema;

var CountdownSchema = new Schema ({
    count: Number,
    // map of people to scores => Map[String, Number]
    people: Map,
    // map of problems to boolean flag (claimed equals true) => Map[Problem, Boolean]
    problems: Map  
});

module.exports = mongoose.model("Countodwn", CountdownSchema)
