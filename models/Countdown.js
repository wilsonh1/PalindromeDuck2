var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var CountdownSchema = new Schema ({
    _id: Number, // unique id identifier
    size: Number, // size stores number of people wanted
    //map of people to scores
    scores: {
        type: Map,
        of: Number
    },
    // map of problems to boolean flag (claimed equals true) => Map[Problem, Boolean]
    problems: {
        type: Map,
        of: Object
    },
    currentSize: Number,
    // index of current problem which we are on
    problemIndex: Number,
    // marks if the game has finished or not
    // used to filter results for possible deletion
    inProgress: Boolean,
    // check if game has started emitting problems
    launched: Boolean
});

module.exports = mongoose.model("Countdown", CountdownSchema)
