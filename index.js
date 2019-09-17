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

        var name = getName(senderId);
        console.log("Message sent by: " + name);

        if (message.text && message.text == "claim") {
            var date = new Date(sent);
            date.setSeconds(0, 0);
            date = new Date(date.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));


            if (checkPalindrome(date)) {
                sendMessage(senderId, {text: "duck"});
                /*Palindrome.create({timestamp: date}, function (err, docs) {
                    if (err)
                        sendMessage(senderId, {text: "palindrome already claimed"});
                    else {
                        Leaderboard.create({})
                    }
                })*/
            }
            else
                sendMessage(senderId, {text: "not a palindrome"});




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

function getName (senderId) {
    request({
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
            fields: "name"
        },
        method: "GET"
    }, function (err, response, body) {
        var name = "";
        if (err)
            console.log("Error getting name: " + err);
        else {
            var bodyObj = JSON.parse(body);
            name = bodyObj.name;
        }
        return name;
    });
    /*request({
        url: "https://graph.facebook.com/v2.6/" + senderId,
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN,
            fields: "first_name"
        },
        method: "GET"
    }, function(error, response, body) {
        var greeting = "";
        if (error) {
            console.log("Error getting user's name: " +  error);
        } else {
            var bodyObj = JSON.parse(body);
            var name = bodyObj.first_name;
            greeting = "Hi " + name + ".";
        }
        var message = greeting;
        sendMessage(senderId, {text: message});
    });*/
}

function checkPalindrome (cur) {
    var hour = cur.getHours();
	if (hour > 12)
		hour -= 12;
    else if (hour == 0)
        hour += 12;
	hour = hour.toString();

    var minutes = cur.getMinutes().toString();
	if (minutes.length == 1)
		minutes = '0' + minutes;

    var s = hour + minutes;
    var len = s.length;
    var i;
	for (i = 0; i < len/2; i++) {
		if (s[i] != s[len-i-1])
			return false;
	}
	return true;
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

/*'use strict';

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

const
    request = require('request'),
    express = require('express'),
    bodyParser = require('body-parser'),
    app = express().use(bodyParser.json());

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
        console.log("Message sent: " + sent);

        if (message.text == "duck me")
            sendMessage(senderId, {text: "ducked"});
        else {
            var rand = Math.floor(Math.random() * 2);
            if (rand == 0)
                sendMessage(senderId, {text: "duck off"});
            else
                sendMessage(senderId, {text: "go duck yourself"});
        }
    }
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
            console.log("Error sending messages: " + response.error);
    });
}*/
