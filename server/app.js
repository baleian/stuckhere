var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var gcm = require('node-gcm');
var sender = new gcm.Sender('AIzaSyB1TljqwcTlwSSAJn5gvhOJzOwZsQHeUpk');
var regIds = [
    "fBNCjK4hSKU:APA91bHNrAw60J52S6rdsX2Lux3uTiR8SuPhrF5MbJl-CtsUibg6rmdYSigRIbtSBpjalVTkZ6anoaUAeumjmL7zxEuSto2ITo1Sy4jLp4HzyZtOMxj0c0iKhvgjzqSttNiqNZcEqWaq",
    "dgF4bbsHuw8:APA91bELGyHFcnkVO9fNYFOFSg6CRbtgiZDgaUO3m8GGfe-UUh3bdKlofxqDf5sSXZTaO8QdYQCWn_V7BerAl0VAWi92r34FfqPJJCjOu1QstCiLbL2cFkoWjRPb4win8AR9nLw_Osj3",
    "fBNCjK4hSKU:APA91bHNrAw60J52S6rdsX2Lux3uTiR8SuPhrF5MbJl-CtsUibg6rmdYSigRIbtSBpjalVTkZ6anoaUAeumjmL7zxEuSto2ITo1Sy4jLp4HzyZtOMxj0c0iKhvgjzqSttNiqNZcEqWaa"
];

var mongodb;
require('mongodb').MongoClient.connect('mongodb://localhost:27017/stuckhere', function (err, db) {
    if (err) {
        throw err;
    }
    mongodb = db;
});

var app = express();
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Make our db accessible to our router
app.use(function(req, res, next){
    req.db = mongodb;
    next();
});

app.get('/', function (req, res, next) {
    res.json({ "hello": 'world' });
});

app.put('/location', function (req, res, next) {
    var identity = req.body.identity;
    var latitude = Number(req.body.latitude);
    var longitude = Number(req.body.longitude);

    // TODO auth
    if (identity === undefined || identity === '') {
        var err = new Error('Forbidden');
        err.status = 403;
        return next(err);
    }

    if (isNaN(latitude) || isNaN(longitude)) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    // update current location.
    var db = req.db;
    db.collection("location").save({ "_id": identity, "latitude": latitude, "longitude": longitude }, function (err, result) {
        if (err) { return next(err); }
        var result = result.result;
        if (result.upserted) {
            return res.sendStatus(201);
        }

        if (result.nModified == 1) {
            return res.sendStatus(204);
        }

        res.sendStatus(304);
    });
});

app.post('/chat', function (req, res, next) {
    var identity = req.body.identity;
    var latitude = Number(req.body.latitude);
    var longitude = Number(req.body.longitude);
    var title = req.body.title;

    // TODO auth
    if (identity === undefined || identity === '') {
        var err = new Error('Forbidden');
        err.status = 403;
        return next(err);
    }

    if (isNaN(latitude) || isNaN(longitude) || title === undefined) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    var db = req.db;
    // update current location.
    db.collection('location').save({ "_id": identity, "latitude": latitude, "longitude": longitude }, function (err) {
        if (err) { return next(err); }
        // modify where for get near users
        // fingerprint
        var where = {
            "_id": { "$ne": identity },
            "latitude": { "$gt": latitude - 0.003, "$lt": latitude + 0.003 },
            "longitude": { "$gt": longitude - 0.003, "$lt": longitude + 0.003 }
        }
        db.collection('location').find(where).toArray(function (err, arr) {
            var nears = [];
            var members = [{ "_id": identity }];
            arr.forEach(function (item) {
                var dist = calDistance(latitude, longitude, item.latitude, item.longitude);
                if (dist <= 250) {
                    nears.push(item._id);
                    members.push({ "_id": item._id })
                }
            });

            // create chat room.
            var chatroom = {
                "title": title,
                "owner": identity,
                "members": members,
                "active": false,
                "reg_date": new Date()
            };
            db.collection('chatroom').insert(chatroom, function (err) {
                if (err) {
                    if (err.code == 11000) {
                        err.status = 412;
                    }
                    return next(err);
                }
                var message = new gcm.Message();
                message.addData('message', 'hello node server!');
                sender.send(message, regIds, function (err, result) {
                    if (err) {
                        return next(err);
                    }
                    console.log(result);
                    res.status(201).json(nears);
                });
            });
        });
    });
});

app.delete('/chat', function (req, res, next) {
    var identity = req.body.identity;

    // TODO auth
    if (identity === undefined || identity === '') {
        var err = new Error('Forbidden');
        err.status = 403;
        return next(err);
    }

    var db = req.db;
    // delete chat room.
    db.collection('chatroom').remove({ "_id": identity }, function (err, result) {
        if (err) { return next(err); }
        var result = result.result;

        if (result.n == 1) {
            return res.sendStatus(204);
        }

        res.sendStatus(304);
    });
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers
app.use(function (err, req, res, next) {
    res.status(err.status || 500);
    res.send(err.stack);
});

app.listen(3000);



function calDistance(lat1, lng1, lat2, lng2) {
    var theta, dist;
    theta = lng1 - lng2;
    dist = (Math.sin(deg2rad(lat1)) * Math.sin(deg2rad(lat2)))
        + (Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.cos(deg2rad(theta)));
    dist = Math.acos(dist);
    dist = rad2deg(dist);

    dist = dist * 60 * 1.1515;
    dist = dist * 1.609344;
    dist = dist * 1000.0;

    return dist;
}

function deg2rad(deg) {
    return deg * Math.PI / 180.0;
}

function rad2deg(rad) {
    return rad * 180.0 / Math.PI;
}