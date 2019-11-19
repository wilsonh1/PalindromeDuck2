'use strict';

const request = require('request');

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var User = require('./models/user');
var Problem = require('./models/problem');

function getProblem (userId) {
    var cnt = Problem.count();
    cnt.exec(function(err, res) {
        if (err)
            console.log(err);
        else {
            var rand = Math.floor(Math.random() * res);

            User.updateOne({user_id: userId}, {user_id: userId, p_id: rand}, {upsert: true}, function(errC, docsC) {
                if (errC)
                    console.log(errC);
                else {
                    console.log("Updated ftw user: " + userId);
                    var pQ = Problem.findOne({p_id: rand}).select({statement: 1, _id: 0}).lean();
                    pQ.exec(function(errP, pObj) {
                        if (errP)
                            console.log(errP);
                        else
                            sendMessage(userId, {text: pObj['statement']}, true);
                    });
                }
            });

        }
    });
}

function checkAnswer (userId, answer, sent) {
    console.log(userId + " " + answer + " " + sent);
    var uQ = User.findOne({user_id: userId}).select({p_id: 1, unix: 1, _id: 0}).lean();
    uQ.exec(function(err, uObj) {
        if (err)
            console.log(err);
        else {
            console.log(uObj['p_id']);
            var pQ = Problem.findOne({p_id: uObj['p_id']}).select({answer: 1, _id: 0}).lean();
            pQ.exec(function(err2, pObj) {
                if (err2)
                    console.log(err2);
                else {
                    var diff = (sent - uObj['unix'])/1000;
                    console.log(pObj['answer']);
                    if (pObj['answer'] == answer)
                        sendMessage(userId, {text: "Correct ! " + diff + "s"}, false);
                    else
                        sendMessage(userId, {text: "Incorrect " + diff + "s"}, false);
                }
            });
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
    checkAnswer
};
