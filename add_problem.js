'use strict';

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Problem = require('./models/problem');

function addProblem(problem_id, statement_1, answer_1, image_1 = undefined) {
    Problem.updateOne({p_id: problem_id}, {statement: statement_1, answer: answer_1, image: image_1}, {upsert: true}, function(errU, docsU) {
        if (errU)
            console.log(errU);
        else
            console.log("Updated problem " + problem_id);
    });
}

module.exports = {
    addProblem
}
