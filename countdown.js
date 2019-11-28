'use strict';

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Schema = mongoose.Schema;
const ftw = require('./ftw');
const User = require('./models/user'); 
const Countdown  = require('./models/Countdown');

function startCountdown(senderId, size) {
    const id = new Date().getTime() // take advantage of the fact that time is monotonically increasing to generate id
    Countdown.create({_id: id, currentSize: 0, launched: false,  size: size, scores: {}, problems: {}, problemIndex: 0, inProgress: true}, function (err, res) {
        if (err) {
	    console.log(err);
	} else {
	    console.log("Successfully created game with id: " + id);
            joinIfNotLaunched(senderId, id);
        }
    });
}

function joinIfNotLaunched(senderId, gameId) {
   Countdown.findById(gameId, function (err, doc) {
	if (err) console.log(err)
	else if (!doc.launched) joinCountdown(senderId, gameId)
	else ftw.sendMessage(senderId, {text: "Game has already started."}); 
   }); 
}

function joinCountdown(senderId, gameId) {
    console.log("Joining game " + gameId);
    User.updateOne({user_id: senderId}, {game_id: gameId, current_problem: 0}, {upsert: true}, function (err, res) {
    	if (err) {
	    console.log(err);
	} else {
	    console.log("Adding user to game");
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
    });
}

function sendImage(senderId, problemDoc) {
    if (problemDoc.image) {
        ftw.sendMessage(senderId, {
                    attachment: {
                        type: "image",
                        payload: {
                            url: problemDoc['image'],
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
	// sendMessage concluding problem cycle and listing result
	concludeGameSequence(doc);
	return;
    }
    const currIndex = doc.problemIndex;
    var problemDoc = doc.problems.get(currIndex.toString(10));
    sendMessageToAllParticipants(doc, problemDoc.statement);
    sendImageToAllParticipants(doc, problemDoc);
    setTimeout(function() {
        endGameSequence(doc, currIndex);
    }, 15000); 
}

// this starts next step by triggering the sending of the next problem
function endGameSequence(oldDoc, lastMeasuredIndex) {
   // we want to find the updated version of the doc, just in case it was overwritten by another process
   Countdown.findById(oldDoc._id, function (err, doc){
   	if (lastMeasuredIndex == doc.problemIndex) {
	    sendMessageToAllParticipants(doc, "Problem period has ended.")
            doc.problemIndex++;
            incrementAllParticipantProblemIndexes(doc);
            doc.save(function (err, res) { 
		if (err) console.log(err); 
		setTimeout(function() { startNextGameSequence(doc) }, 2000);
	    });
        }
   });
}

function concludeGameSequence(doc) {
   sendMessageToAllParticipants(doc, {text: "Game has ended"});
   Countdown.deleteOne({_id: doc._id}, function (err) { if(err) console.log(err); });
   for (const senderId of doc.scores.keys) {
	ftw.sendMessage(senderId, {text: "Here is your score: " + doc.scores.get(key)});
	User.findOne({user_id: senderId}, function (err, doc) {
	    doc.game_id = 0;
	    doc.save(function (err, product) { if (err) console.log(err); } );
	});
   }
}

function incrementAllParticipantProblemIndexes(doc) {
    for (const senderId of doc.scores.keys) {
    	User.findOne({user_id: senderId}, function (err, userDoc) {
	    userDoc.current_problem++;
	    userDoc.save(function (err, props) {if (err) console.log(err); });
	});	
    }
}

// index.js will check if sender is in game
function answerQuestion(senderId, gameId, answer) {
   User.findOne({game_id: gameId}, function (err, userDoc) {
       	if (err) console.log(err);
       	else {
	     Countdown.findById(gameId, function (err, countdownDoc) {
		  if (err) console.log(err);
	     	  else {
			const index = userDoc.current_problem
			if (index == countdownDoc.problemIndex && countdownDoc.problems.get(userDoc.current_problem.toString(10)).answer == answer) {
		  	    sendMessageToAllParticipants(countdownDoc, "Someone has correctly answered the question.");
			    countdownDoc.scores.set(senderId, countdownDoc.scores.get(senderId) + 1);
			    countdownDoc.save(function (err, res) {if (err) console.log(err); } );
			    endGameSequence(countdownDoc, userDoc.current_problem);
			} else {
			    ftw.sendMessage(senderId, {text: "Wrong. Please try it again."});
			}
		  }
	     });
      	}
   });
}

// lists all non-launched countdown matches
function grabAllCountdownMatches(senderId) {
    Countdown.find({launched: false}, function (err, docs){
	ftw.sendMessage(senderId, {text: "Here are available games: "})
	for (const doc of docs) {
	    ftw.sendMessage(senderId, {text: doc._id});
	}
    });
}

module.exports = {
    answerQuestion,
    grabAllCountdownMatches,
    joinIfNotLaunched,
    startCountdown
}
