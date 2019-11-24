'use strict';

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Schema = mongoose.Schema;
const ftw = require('./ftw');
const User = require('./models/user'); 

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

const Countdown  = mongoose.model("Countdown", CountdownSchema)

var interval = undefined; // timer used to keep track of when a problem's time is up

function startCountdown(senderId, name, size) {
    const id = new Date().getTime() // take advantage of the fact that time is monotonically increasing to generate id
    Countdown.create({_id: id, currentSize: 0,  size: size, scores: {}, problems: {}, problemIndex: 0, inProgress: true}, function (err, res) {
        if (err) {
	    console.log(err);
	} else {
	    console.log("Successfully created game with id: " + id);
        }
    });
    joinCountdown(senderId, gameId);
}

function convertToStr(num) {
    return num.toString(10); // convert number to base 10 string
}

function generateProblemSet(doc, num) {
    for (int i = 0; i < num; i++) {
	doc.problems.set(convertToStr(i), ftw.returnProblem());	
    } 
}

// TODO: join if this thing has not launched
function joinIfNotLaunched(gameId) {
    
}

function joinCountdown(senderId, gameId) {
    User.updateOne({user_id: senderId}, {game_id: id}, function (err, res) {
    	if (err) {
	    console.log(err);
	} else {
	    console.log("Adding user to game");
	}
    });
    Countdown.findById(gameId, function (err, doc) {
	if (err) {
	    console.log(err);
	} else {
	    doc.scores.set(senderId, 0);
	    doc.currentSize++;
	    if (doc.currentSize == doc.size) {
		generateProblemSet(doc, 10);
		doc.launched = true;
	    } 
	    doc.save(function (err, res) {
		if (err) console.log(err);
	    });
	    sendProblem(doc);
	}
    });
}

// make sure to check in models/User if user is part of countdown
function sendProblem(doc) {
    for (const val of doc.people.keys) {
	// send problem to them
    }
    setTimeout(function() {
        //terminateIfNotAnswered()
    }, 15000); 
}

function updateMap(id, ) {
}
 
