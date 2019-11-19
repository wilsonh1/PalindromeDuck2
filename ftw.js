'use strict';

const request = require('request');

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var User = require('./models/user');
var Problem = require('./models/problem');

function getProblem (senderId) {
    var cnt = Problem.count();
    cnt.exec(function(err, res) {
        if (err)
            console.log(err);
        else {
            var rand = Math.floor(Math.random() * res);

            User.updateOne({user_id: senderId}, {user_id: senderId, p_id: rand}, {upsert: true}, function(errC, docsC) {
                if (errC)
                    console.log(errC);
                else {
                    console.log("Updated ftw user: " + senderId);
                    var pQ = Problem.findOne({p_id: rand}).select({statement: 1, _id: 0}).lean();
                    pQ.exec(function(errP, pObj) {
                        if (errP)
                            console.log(errP);
                        else
                            sendMessage(senderId, {text: pObj['statement']}, true);
                    });
                }
            });

        }
    });
}

function getAnswer (senderId, answer, sent) {
    //console.log(senderId + " " + answer + " " + sent);
    var uQ = User.findOne({user_id: senderId}).select({p_id: 1, unix: 1, _id: 0}).lean();
    uQ.exec(function(err, uObj) {
        if (err)
            console.log(err);
        else {
            //console.log(uObj['p_id']);
            var pQ = Problem.findOne({p_id: uObj['p_id']}).select({answer: 1, best: 1, _id: 0}).lean();
            pQ.exec(function(err2, pObj) {
                if (err2)
                    console.log(err2);
                else {
                    var diff = (sent - uObj['unix'])/1000;
                    //console.log(pObj['answer']);
                    if (diff < 0) {
                        sendMessage(senderId, {text: "Wait for problem statement."}, false);
                        return;
                    }

                    var upd = (pObj['answer'] == answer);
                    if (upd) {
                        sendMessage(senderId, {text: "Correct! " + diff + "s"}, false);
                        if (diff <= pObj['best'])
                            sendMessage(senderId, {text: "New best time !"}, false);
                        else
                            sendMessage(senderId, {text: "Best time " + pObj['best'] + "s"});
                    }
                    else
                        sendMessage(senderId, {text: "Incorrect " + diff + "s"}, false);

                    User.updateOne({user_id: senderId}, {$inc: {count: 1, correct: upd}}, function(errU, docsU) {
                        if (errU)
                            console.log("Error updating user");
                        else
                            console.log("Updated " + senderId + " " + upd);
                    });

                    Problem.updateOne({p_id: uObj['p_id'], best: {$gt: diff}}, {best: diff}, function(errP , docsP) {
                        if (errP)
                            console.log("Error updating problem");
                        else
                            console.log("Updated problem best time " + uObj['p_id'] + " " + diff);
                    });
                }
            });
        }
    });
}

function getStats (senderId) {
    var uQ = User.findOne({user_id: senderId}).select({count: 1, correct: 1, _id: 0}).lean();
    uQ.exec(function(err, uObj) {
        if (err)
            console.log(err);
        else {
            if (!uObj)
                sendMessage(senderId, {text: "Not found"}, false);
            else {
                sendMessage(senderId, {text: "Number of questions answered " + uObj['count']}, false);
                sendMessage(senderId, {text: "Accuracy " + ((uObj['correct']/uObj['count'])*100).toFixed(2) + "\%"}, false);
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
                sendMessage(senderId, {text: "Not found"}, false);
            else
                sendMessage(senderId, {text: "Reset stats"}, false);
        }
    });
}

function sendMessage (recipientId, message, flag) {
    request({
        url: "https://graph.facebook.com/v4.0/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
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
                    console.log("Set time: " + recipientId);
            });
        }
    });
}

module.exports = {
    getProblem,
    getAnswer,
    getStats,
    resetStats
};
