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

function joinIfNotLaunched(senderId, gameId) {
   Countdown.findById(gameId, function (err, doc) {
	if (err) console.log(err)
	else if (!doc.launched) joinCountdown(senderId)
	else ftw.sendMessage(senderId, {text: "Game has already started."}); 
   }); 
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
		ftw.populateProblemSet(doc);
		doc.launched = true;
	    } 
	    doc.save(function (err, res) {
		if (err) console.log(err);
	    });
	    startNextGameSequence(doc);
	}
    });
}

function sendImage(senderId, problemDoc) {
    if (problemDoc.image) {
        ftw.sendMessage(senderId, {
                    attachment: {
                        type: "image",
                        payload: {
                            url: pObj['image'],
                                is_reusable: true
                            }
                        }
                    }, false);
    }
}

function sendImageToAllParticipants(doc, problemDoc) {
    for (const senderId of doc.scores.keys) {
	sendImage(senderId, problemDoc);
    }
}


function sendMessageToAllParticipants(doc, text) {
   for (const senderId of doc.score.keys()) {
	ftw.sendMessage(senderId, {text: text})
   }
}

// make sure to check in models/User if user is part of countdown
function startNextGameSequence(doc) {
    if (doc.problemIndex == 10) {
	// sendMessage concluding problem cycle and listing results
	return;
    }
    const currIndex = doc.problemIndex;
    var problemDoc = doc.problems.get(currIndex.toString("10"));
    sendMessageToAllParticipants(doc, problemDoc.text);
    sendImageToAllParticipants(doc, problemDoc);
    setTimeout(function() {
        endGameSequence(doc, currIndex);
    }, 15000); 
}

// this starts next step by triggering the sending of the next problem
function endGameSequence(doc, lastMeasuredIndex) {
   if (lastMeasuredIndex == doc.problemIndex) {
	sendMessageToAllParticipants(doc, "Problem period has ended.")
        doc.problemIndex++;
        doc.save(function (err, res) { if (err) console.log(err); } );
   }
   doc.save(function (err, res) { if (err) console.log(err); } );
   setTimeout(function() { startNextGameSequence(doc) }, 2000)
}
 
