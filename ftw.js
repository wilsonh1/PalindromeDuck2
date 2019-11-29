'use strict';

const request = require('request');

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var User = require('./models/user');
var Problem = require('./models/problem');

function getShuffledArray(size, slice) {
    var array = []
    for (var i = 0; i < size; i++) array[i] = i;
    var tmp, current, top = array.length;
    if(top) while(--top) {
        current = Math.floor(Math.random() * (top + 1));
        tmp = array[current];
        array[current] = array[top];
        array[top] = tmp;
    }
    var result = []
    for (var i = 0; i < slice; i++) result[i] = array[i];
    return result;
}

function populateProblemSet (countdownDoc) {
    var cnt = Problem.count();
    cnt.exec(function(err, res) {
        if (err)
            console.log(err);
        else {
	    console.log("Number of problems found: " + res);
            if (!res) {
		console.log("No problems found");
            }
            var randArray = getShuffledArray(res, 1); // temporarily set it to size one
	    console.log("Adding problems: " + randArray);
            Problem.find({'p_id': {$in: randArray}}, function (err, docs) {
		console.log("docs found: " + docs);
		if (docs) {
		    for (var index = 0; index < docs.length; index++) {
		    	countdownDoc.problems.set(index.toString(10), docs[index]);
		    }
		}
		countdownDoc.save(function (err, props) { if(err) console.log(err); });
	    });
        }
    });
}

function getProblem (senderId) {
    var cnt = Problem.count();
    cnt.exec(function(err, res) {
        if (err)
            console.log(err);
        else {
            if (!res) {
                sendMessage(senderId, {text: "No problems found."}, false);
                return;
            }
            var rand = Math.floor(Math.random() * res);

            User.updateOne({user_id: senderId}, {user_id: senderId, p_id: rand, game_id: 0}, {upsert: true}, function(errC, docsC) {
                if (errC)
                    console.log(errC);
                else {
                    console.log("Updated ftw user: " + senderId);
                }
            });

            var pQ = Problem.findOne({p_id: rand}).select({statement: 1, image: 1, _id: 0}).lean();
            pQ.exec(function(errP, pObj) {
                if (errP)
                console.log(errP);
                else {
                    sendMessage(senderId, {text: pObj['statement']}, true);
                    if (pObj['image']) {
                        sendMessage(senderId, {
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
            });

        }
    });
}

function getAnswer (senderId, answer, sent) {
    var uQ = User.findOne({user_id: senderId}).select({p_id: 1, unix: 1, _id: 0}).lean();
    uQ.exec(function(err, uObj) {
        if (err)
            console.log(err);
        else {
            if (!uObj || uObj['p_id'] == -1) {
                sendMessage(senderId, {text: "Ask for new problem."}, false);
                return;
            }

            if (!uObj['unix'] || sent<uObj['unix']) {
                sendMessage(senderId, {text: "Wait for problem statement."}, false);
                return;
            }
            var diff = (sent - uObj['unix'])/1000;

            var pQ = Problem.findOne({p_id: uObj['p_id']}).select({answer: 1, _id: 0}).lean();
            pQ.exec(function(err2, pObj) {
                if (err2)
                    console.log(err2);
                else {
                    var upd = (pObj['answer'] == answer);
                    if (upd)
                        sendMessage(senderId, {text: "Correct ! " + diff + "s"}, false);
                    else
                        sendMessage(senderId, {text: "Incorrect " + diff + "s"}, false);

                    User.updateOne({user_id: senderId}, {p_id: -1, unix: 0, game_id: 0, $inc: {count: 1, correct: upd, time: diff}}, function(errU, docsU) {
                        if (errU)
                            console.log("Error updating user");
                        else
                            console.log("Updated " + senderId + " " + upd);
                    });
                }
            });
        }
    });
}

function getStats (senderId) {
    var uQ = User.findOne({user_id: senderId}).select({count: 1, correct: 1, time: 1, _id: 0}).lean();
    uQ.exec(function(err, uObj) {
        if (err)
            console.log(err);
        else {
            if (!uObj || !uObj['count'])
                sendMessage(senderId, {text: "Not found."}, false);
            else {
                sendMessage(senderId, {text: "Number of questions answered: " + uObj['count']});
                sendMessage(senderId, {text: "Accuracy: " + ((uObj['correct']/uObj['count'])*100).toFixed(2) + "\%"});
                sendMessage(senderId, {text: "Average time: " + (uObj['time']/uObj['count']).toFixed(3) + "s"});
            }
        }
    });
}

function resetStats (senderId) {
    User.deleteOne({user_id: senderId}, function(err, docs) {
        if (err)
            console.log(err);
        else {
            if (!docs.n)
                sendMessage(senderId, {text: "Not found."}, false);
            else
                sendMessage(senderId, {text: "Reset stats."}, false);
        }
    });
}

function sendMessage (recipientId, message, flag = false) {
    console.log(message + " " + flag);
    request({
        url: "https://graph.facebook.com/v4.0/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message
        }
    }, function (err, response, body) {
        if (err)
            console.log("Error sending messages: " + err);
        else if (flag) {
            var date = new Date().getTime();
            User.updateOne({user_id: recipientId}, {unix: date}, function(errT, docsT) {
                if (errT)
                    console.log(errT);
                else
                    console.log("Set time: " + recipientId + " " + date);
            });
        }
    });
}

module.exports = {
    populateProblemSet,
    getProblem,
    getAnswer,
    getStats,
    sendMessage,
    resetStats
};
