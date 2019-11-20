'use strict';

const {google} = require('googleapis');

const mongoose = require('mongoose');
var db = mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true});
var Problem = require('./models/member');

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const jwt = new google.auth.JWT(
    process.env.CLIENT_EMAIL,
    null,
    process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
    SCOPES
);

jwt.authorize((err, response) => {
    updateProblems(jwt);
});

function updateProblems (auth) {
    const sheets = google.sheets({version: 'v4', auth});

    sheets.spreadsheets.values.get({
        spreadsheetID: "1JuPMESrHBIAqvA5etCxCd3Gjz7BkKW-TQluAHASgOjc",
        range: "Sheet1!A2:C"
    }, (err, res) => {
        if (err)
            console.log(err);
        else {
            const rows = res.data.values;
            rows.forEach(function(row) {
                Problem.updateOne({p_id: row[0]}, {statement: row[1], answer: row[2], best: 1e9}, {upsert: true}, function(errU, docsU) {
                    if (errU)
                        console.log(errU);
                    else
                        console.log("Updated problem " + row[0]);
                });
            });
        }
    });
}
