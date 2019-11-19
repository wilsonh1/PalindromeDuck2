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
            User.updateOne({user_id: recipientId}, {unix: new Date().getTime()}, function(errT, docsT) {
                if (errT)
                    console.log(errT);
                else
                    console.log("Set time: " + recipientId);
            });
        }
    });
}

module.exports = {
    getProblem
};
