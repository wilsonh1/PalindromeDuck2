'use strict';

const
    request = require('request'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Leaderboard = require('./models/leaderboard');
var Palindrome = require('./models/palindrome');

const ftw = require('./ftw');

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

        if (!message.text)
            notRecognized(senderId);
        else {
            var str = message.text.toLowerCase();
            if (str == "claim") {
                var date = new Date(sent);
                date.setSeconds(0, 0);
                date = new Date(date.toLocaleString("en-US", {timeZone: process.env.TZ}));

                if (checkTime(date))
                    updatePal(senderId, sent, date, message.mid);
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
            else if (str == "leaderboard")
                getLeader(senderId, "");
            else if (str == "ahead")
                getLeader(senderId, "ahead of");
            else if (str == "behind")
                getLeader(senderId, "behind");
            else if (str == "ftw")
                ftw.getProblem(senderId);
            else
                notRecognized(senderId);
        }
    }
}

function notRecognized (senderId) {
    var rand = Math.floor(Math.random() * 2);
    if (rand == 0)
        sendMessage(senderId, {text: "duck off"});
    else
        sendMessage(senderId, {text: "go duck yourself"});
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

function updatePal (senderId, sent, date, messageId) {
    var rand = Math.floor(Math.random() * 125);
    var val = 1;
    if (rand < 31)
        val++;
    if (rand < 6)
        val++;
    if (rand < 1)
        val++;

    Palindrome.create({timestamp: date, unix: sent, user_id: senderId, mid: messageId, points: val}, function(errC, docsC) {
        if (errC) {
            var palQ = Palindrome.findOne({timestamp: date}).select({unix: 1, user_id: 1, mid: 1, points: 1, _id: 0}).lean();
            palQ.exec(function(err, palObj) {
                if (err)
                    console.log(err);
                else {
                    var diff = sent - palObj['unix'];
                    if (diff < 0 && senderId != palObj['user_id']) {
                        updateLeader(palObj['user_id'], -palObj['points']);
                        sendMessage(palObj['user_id'], {text: "sniped " + (-diff / 1000) + "s"})
                        updateLeader(senderId, val);

                        var query = {timestamp: date};
                        var update = {
                            unix: sent,
                            user_id: senderId,
                            mid: messageId,
                            points: val
                        };
                        Palindrome.updateOne(query, update, function(errU, docsU) {
                            if (errU)
                                console.log("Error updating palindrome: " + errU);
                            else
                                console.log("Updated palindrome: " + sent);
                        });
                    }
                    else if (messageId != palObj['mid'])
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
    if (val == 1)
        sendMessage(senderId, {text: "duck"});
    else if (val == 2)
        sendMessage(senderId, {text: "double duck !"});
    else if (val == 3)
        sendMessage(senderId, {text: "triple DUCK !!"});
    else if (val == 4)
        sendMessage(senderId, {text: "*quadruple DUCK !!!!*"});

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

function getLeader (senderId, flag) {
    var lQ = Leaderboard.findOne({user_id: senderId}).select({points: 1, _id: 0}).lean();
    lQ.exec(function(err, lObj) {
        if (err)
            console.log(err);
        else {
            if (!lObj)
                sendMessage(senderId, {text: "not found on leaderboard"});
            else {
                if (!flag) {
                    var x = Leaderboard.count({points : {"$gt" : lObj['points']}});
                    x.exec(function(err2, res) {
                        if (err2)
                            console.log(err2);
                        else
                            sendMessage(senderId, {text: "rank " + (res + 1) + " with " + lObj['points'] + " palindrome(s)"});
                    });
                }
                else
                    getDiff(senderId, lObj['points'], flag);
            }
        }
    });
}

function getDiff (senderId, points, flag) {
    var query = {
        user_id: {$ne: senderId},
        points: (flag == "behind") ? {$gte: points} : {$lte: points}
    };
    var lQ = Leaderboard.find(query).sort({points: (flag == "behind") ? 1 : -1}).select({points: 1, _id: 0}).lean();
    lQ.exec(function(err, lObj) {
        if (err)
            console.log(err);
        else {
            var p = (!lObj[0]) ? points : lObj[0]['points'];
            var x = Leaderboard.count({points : {"$gt" : p}});
            x.exec(function(err2, res) {
                if (err2)
                    console.log(err2);
                else
                    sendMessage(senderId, {text: Math.abs(points - p) +  " palindrome(s) " + flag + " rank " + (res + 1)});
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
