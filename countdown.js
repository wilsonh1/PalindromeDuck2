'use strict';

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Schema = mongoose.Schema;
const ftw = require('./ftw');

var CountdownSchema = new Schema ({
    count: Number,
    // map of people to scores => Map[String, Number]
    people: {
        type: Map,
        of: String
    },
    scores: {
	type: Map,
	of: Number
    },
    // map of problems to boolean flag (claimed equals true) => Map[Problem, Boolean]
    problems: {
        type: Map,
        of: Object
    },
    problemIndex: Number,
    currentCount: Number,
    inProgress: Boolean
});

const Countdown  = mongoose.model("Countdown", CountdownSchema)

const emptyCountDownObject = new Countdown({
    count: 0,
    problems: {},
    people: {},
    scores: {},
    currentCount: 0,
    inProgress: false
});

var currentCountdown = emptyCountDownObject
var interval = undefined // timer used to keep track of when a problem's time is up

function startCountdown(senderId, name, size) {
    // there might be concerns that this is not thread-safe, will need to consider
    if (currentCountdown != emptyCountdownObject) {
	ftw.sendMessage(senderId, {text: "Game in progress"}, false);
	return;
    }
    currentCountdown = new Countdown({
	count: size,
	problems: {},
	people: {},
	scores: {},
	currentCount: 0,
	inProgress: true
    });
    generateProblems(10);
    joinCountdown(senderId, name);
}

function convertToStr(num) {
    return num.toString(10); // convert number to base 10 string
}

function generateProblems(size) {
    for (int i = 0; i < size; i++) {
	currentCountdown.problems.set(convertToStr(i), ftw.returnProblem());	
    }  
}

function joinCountdown(senderId, name) {
    if (currentCountdown != emptyCountdownObject) {
	ftw.sendMessage(senderId, {text: "Game in progress"}, false);
        return;
    }
    currentCountdown.people.set(name, senderId);
    currentCountdown.scores.set(name, 0);
    currentCountdown.currentCount++;
    ftw.sendMessage(senderId, {test: "Joined the game successfully"}, false);
    if (currentCountdown.currentCount == currentCountdown.count) {
	launchGame();
    }
}

function launchGame() {
}
 
