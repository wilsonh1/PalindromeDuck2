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
        res.status(200).send('EVENT_RECEIVED');
        body.entry.forEach(function(entry) {
            entry.messaging.forEach(function(event) {
                if (event.message)
                    processMessage(event);
            });
        });
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
            date = new Date(date.toLocaleString("en-US", {timeZone: process.env.TZ}));

            if (checkTime(date))
                updatePal(senderId, sent, date);
            else {
                sendMessage(senderId, {text: "not a palindrome"});

                if (sent % 60000 > 1000 && sent % 60000 < 59000) {
                    Palindrome.deleteMany({}, function(err, response) {
                        if (err)
                            console.log("Error resetting palindromes " + err);
                        else
                            console.log("Reset palindromes");
                    });
                }
            }
        }
        else if (message.text && message.text == "score") {
            var q = Leaderboard.find({user_id: senderId}).select({"points": 1, "_id": 0}).lean();
            q.exec(function(err1, docs1) {
                if (err1)
                    console.log(err1);
                else {
                    var qObj = JSON.parse(JSON.stringify(docs1));
                    if (!qObj[0])
                        sendMessage(senderId, {text: "not found"});
                    else
                        sendMessage(senderId, {text: qObj[0]['points'] / 1000 + " points"});
                }
            });
        }
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

function updatePal (senderId, sent, date) {
    var val = sent % 60000;

    Palindrome.create({timestamp: date, unix: sent, user_id: senderId, points: val}, function(errC, docsC) {
        if (errC) {
            var palQ = Palindrome.find({timestamp: date}).select({"unix": 1, "user_id": 1, "points": 1, "_id": 0}).lean();
            palQ.exec(function(err, docs) {
                if (err)
                    console.log(err);
                else {
                    var palObj = JSON.parse(JSON.stringify(docs));
                    var diff = sent - palObj[0]['unix'];
                    if (diff < 0 && senderId != palObj[0]['user_id']) {
                        if (palObj[0]['points'] > 0)
                            updateLeader(palObj[0]['user_id'], -palObj[0]['points']);
                        sendMessage(palObj[0]['user_id'], {text: "sniped " + (-diff / 1000) + "s"})
                        updateLeader(senderId, val);

                        var query = {timestamp: date};
                        var update = {
                            unix: sent,
                            user_id: senderId,
                            points: val
                        };
                        Palindrome.updateOne(query, update, function(errU, docsU) {
                            if (errU)
                                console.log("Error updating palindrome: " + errU);
                            else
                                console.log("Updated palindrome: " + sent);
                        });
                    }
                    else
                        sendMessage(senderId, {text: "palindrome already claimed " + (diff / 1000) + "s"});
                }
            });
        }
        else {
            updateLeader(senderId, val);
            console.log("Added palindrome: " + date + " " + sent);
        }
    });
}

function updateLeader (senderId, val) {
    if (val >= 0)
        sendMessage(senderId, {text: "duck " + val / 1000});

    Leaderboard.create({user_id: senderId, name: "", points: val}, function(err, docs) {
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
            setName(senderId);
        }
    });
}

function setName (senderId) {
    request({
        url: "https://graph.facebook.com/v4.0/" + senderId,
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
            Leaderboard.updateOne({user_id: senderId}, {name: name}, function(errU, docsU) {
                if (errU)
                    console.log("Error setting name: " + errU);
                else
                    console.log("Name " + senderId + " set to " + name);
            });
        }
    });
}

function sendMessage (recipientId, message) {
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
    });
}
