'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const
    request = require('request'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true});
var Leaderboard = require('./models/leaderboard');
var Palindrome = require('./models/palindrome');

app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function(entry) {
            entry.messaging.forEach(function(event) {
                if (event.message)
                    processMessage(event);
            });
        });
        res.status(200).send('EVENT_RECEIVED');
    }
    else {
        res.sendStatus(404);
    }
});

app.get("/", function (req, res) {
  res.send("Deployed!");
});

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = process.env.VERIFICATION_TOKEN;

    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        }
        else {
            res.sendStatus(403);
        }
    }
});

function processMessage (event) {
    if (!event.message.is_echo) {
        var senderId = event.sender.id;
        var message = event.message;
        var sent = event.timestamp;

        console.log("Received message from senderId: " + senderId);
        console.log("Message is: " + JSON.stringify(message));
        console.log("Message sent at: " + sent);

        if (message.text && message.text == "claim") {
            var date = new Date(sent);
            date.setSeconds(0, 0);
            date = new Date(date.toLocaleString("en-US", {timeZone: process.env.TZ})); //"America/Los_Angeles"}));

            if (checkTime(date)) {
                Palindrome.create({timestamp: date, unix: sent, user_id: senderId}, function(errC, docsC) {
                    if (errC) {
                        var palQ = Palindrome.find({timestamp: date}).select({"unix": 1, "user_id": 1, "_id":0}).lean();
                        palQ.exec(function(err, docs) {
                            if (err)
                                console.log(err);
                            else {
                                var palObj = JSON.parse(JSON.stringify(docs));
                                if (sent < palObj[0]['unix'] && senderId != palObj[0]['user_id']) {
                                    updateLeader(palObj[0]['user_id'], -1);
                                    updateLeader(senderId, 1);

                                    var query = {timestamp: date};
                                    var update = {
                                        timestamp: date,
                                        unix: sent,
                                        user_id: senderId
                                    };
                                    Palindrome.findOneAndUpdate(query, update, function(errU, docsU) {
                                        if (errU)
                                            console.log("Error updating palindrome: " + errU);
                                        else
                                            console.log("Updated palindrome: " + sent);
                                    });
                                }
                                else
                                    sendMessage(senderId, {text: "palindrome already claimed"});
                            }
                        });
                    }
                    else {
                        updateLeader(senderId, 1);
                        console.log("Added palindrome: " + date + " " + sent);
                    }
                });
            }
            else {
                sendMessage(senderId, {text: "not a palindrome"});

                if (sent % 10000 > 500 && sent % 10000 < 9500) {
                    Palindrome.deleteMany({}, function(err, response) {
                        if (err)
                            console.log("Error resetting palindromes " + err);
                        else
                            console.log("Reset palindromes");
                    });
                }
            }
        }
        else if (message.text && message.text == "leaderboard")
            getRank(senderId);
        else {
            var rand = Math.floor(Math.random() * 2);
            if (rand == 0)
                sendMessage(senderId, {text: "duck off"});
            else
                sendMessage(senderId, {text: "go duck yourself"});
        }
    }
}

function checkTime (cur) {
    var h24 = cur.getHours().toString();

    var minutes = cur.getMinutes().toString();
	if (minutes.length == 1)
		minutes = '0' + minutes;

    if (checkPalindrome(h24 + minutes))
        return true;

    var hour = cur.getHours();
	if (hour > 12)
		hour -= 12;
    else if (hour == 0)
        hour = 12;
	hour = hour.toString();

    if (checkPalindrome(hour + minutes))
        return true;
    return false;
}

function checkPalindrome (s) {
    var len = s.length;
	for (var i = 0; i < len/2; i++) {
		if (s[i] != s[len-i-1])
			return false;
	}
	return true;
}

function updateLeader (senderId, val) {
    if (val == 1)
        sendMessage(senderId, {text: "duck"});
    else
        sendMessage(senderId, {text: "sniped"});

    Leaderboard.create({user_id: senderId, name: "", points: 0}, function(err, docs) {
        if (err) {
            Leaderboard.updateOne({user_id: senderId}, { $inc: { points: val } }, function(errU, docsU) {
                if (errU)
                    console.log("Error incrementing: " + errU);
                else
                    console.log("Incremented: " + senderId + " " + val);
            });
        }
        else {
            console.log("Created leaderboard: " + senderId);
            setName(senderId, val);
        }
    });
}

function setName (senderId, val) {
    request({
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
            fields: "name"
        },
        method: "GET"
    }, function (err, response, body) {
        if (err)
            console.log("Error getting user's name: " +  err);
        else {
            var bodyObj = JSON.parse(body);
            var name = bodyObj.name;
            var query = {user_id: senderId};
            var update = {
                user_id: senderId,
                name: name,
                points: val
            };
            Leaderboard.findOneAndUpdate(query, update, function(err1, docs1) {
                if (err1)
                    console.log("Error setting name: " + err1);
                else
                    console.log("Name " + senderId + " set to " + name);
            });
        }
    });
}

function getRank (senderId) {
    var q = Leaderboard.find({user_id: senderId}).select({"points": 1, "_id": 0}).lean();
    q.exec(function(err1, docs1) {
        if (err1)
            console.log(err1);
        else {
            var qObj = JSON.parse(JSON.stringify(docs1));
            if (!qObj[0])
                sendMessage(senderId, {text: "not found on leaderboard"});
            else {
                var x = Leaderboard.count({points : {"$gt" : qObj[0]['points']}});
                x.exec(function(err2, res) {
                    if (err2)
                        console.log(err2);
                    else
                        sendMessage(senderId, {text: "rank " + (res+1) + " with " + qObj[0]['points'] + " palindrome(s)"});
                });
            }
        }
    });
}

function sendMessage (recipientId, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function (err, response, body) {
        if (err)
            console.log("Error sending messages: " + err);
    });
}
