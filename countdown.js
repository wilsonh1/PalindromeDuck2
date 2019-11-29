'use strict'

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
		    console.log("Added successfully to doc: " + doc);
	    	    doc.scores.set(senderId, 0);
	    	    doc.currentSize++;
	    	    if (doc.currentSize == doc.size) {
			doc.launched = true;
			ftw.populateProblemSet(doc, triggerCountdownSeq);
	    	    } 
	        }
    	    });
	}
    });
}

function triggerCountdownSeq(doc) {
    doc.save(function (err, res) {
    	if (err) console.log(err);
        else console.log("Successfully saved doc, beginning game: " + (doc.currentSize == doc.size));
        if (doc.currentSize == doc.size) startNextGameSequence(doc);
    });
}

function leaveCountdown(senderId) {
    console.log("Leaving game");
    User.findOne({user_id: senderId}, function (err, doc){
	if (err) console.log(err);
	else if (doc.game_id != 0) {
	    console.log("Leaving game " + doc.game_id);
	    Countdown.findById(doc.game_id, function (err, countdownDoc){
		console.log("Deleting from doc: " + doc);
		countdownDoc.scores.delete(senderId);
		countdownDoc.currentSize--;
		countdownDoc.save(function (err, res) {
		    doc.game_id = 0;
		    doc.save(function (err, res) {
			if (err) console.log(err);
			else {
			    ftw.sendMessage(senderId, {text: "Successfully left game"});
			}
		    });
		});
	    });
	} else {
	    ftw.sendMessage(senderId, {text: "Not able to leave game since not in game."});
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

function getAllParticipants(doc, callback) {
    User.find({game_id: doc._id}, function (err, docs) {
	console.log("Finding partipants for game: " + doc._id);
	if (docs) {
	    for (var index = 0; index < docs.length; index++) {
	        console.log("Calling callback for doc: " + docs[index]);
		callback(docs[index]);
	    }
	}
    });
}

function sendImageToAllParticipants(doc, problemDoc) {
    function sendImage(senderDoc) { if (senderDoc) sendImage(senderDoc.user_id, problemDoc); }
    getAllParticipants(doc, sendImage);
}


function sendMessageToAllParticipants(doc, text) {
    function sendMessage(senderDoc) { if (senderDoc) ftw.sendMessage(senderDoc.user_id, {text: text}); }
    getAllParticipants(doc, sendMessage);
}

// make sure to check in models/User if user is part of countdown
function startNextGameSequence(doc) {
    if (doc.problemIndex == 1) {
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
   
    function wrapup(senderDoc) {
	if (senderDoc) {
	    ftw.sendMessage(senderDoc.user_id, {text: "Here is your score: " + doc.scores.get(key)});
	    senderDoc.game_id = 0;
	    senderDoc.save(function (err, product) { if (err) console.log(err); });
	}
    }
    getAllParticipants(doc, wrapup);  
}

function incrementAllParticipantProblemIndexes(doc) {
    function incrementIndex (userDoc) { 
	userDoc.current_problem++;
	userDoc.save(function (err, props) { if (err) console.log(err); });
    }
    getAllParticipants(doc, incrementIndex); 
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
			    countdownDoc.save(function (err, res) {
				if (err) console.log(err); 
				else endGameSequence(countdownDoc, userDoc.current_problem);
			    });
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
    startCountdown,
    leaveCountdown
}
