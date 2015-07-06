var express = require('express');
var logger = require('morgan');
var bodyParser = require('body-parser');
var fcaller = require("./fcaller.js");
var gcm = require('node-gcm');
var sender = new gcm.Sender('AIzaSyB1TljqwcTlwSSAJn5gvhOJzOwZsQHeUpk');

var app = express();
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Make our db accessible to our router
//app.use(function (req, res, next) {
//    req.db = db;
//    next();
//});

// session check
app.use(function (req, res, next) {
    var session_key = req.headers["session_key"];
    if (!session_key) {
        return next();
    }

    // valid check and get my id
    var myId = "1";
    req.myId = myId;
    next();
});

app.get('/', function (req, res, next) {
    res.json({ "hello": 'world' });
});

function isValidLocation(location) {
    return (typeof(location.latitude) === "number" &&
        typeof(location.longitude) === "number");
}

app.put('/location', function (req, res, next) {
    var myId = req.myId;
    var location = req.body.location;

    if (myId === undefined) {
        var err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }

    if (location === undefined) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    // business layer
    if (!isValidLocation(location)) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    updateUserLocation(myId, location, function (err, result) {
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


// function createChatRoomTemporary(myId, location, )
app.post('/chat', function (req, res, next) {
    var myId = req.myId;
    var title = req.body.title;
    var location = req.body.location;

    if (myId === undefined) {
        var err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }

    if (title === undefined || location === undefined) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    // business layer
    if (!isValidLocation(location)) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    updateUserLocation(myId, location, function (err) {
        if (err) { return next(err); }

        findMembersNearByMyLocation(myId, location, function (err, nears) {
            if (err) { return next(err); }

            var members = [ myId ];
            nears.forEach(function (member) {
                members.push(member._id);
            });

            createChatRoom(myId, title, members, function (err, result) {
                if (err) { return next(err); }

                res.status(201).json(result.ops);
            });
        });
    });
});

//                var message = new gcm.Message();
//                message.addData('message', 'hello node server!');
//                sender.send(message, regIds, function (err, result) {
//                    if (err) {
//                        return next(err);
//                    }
//                    console.log(result);
//                    res.status(201).json(nears);
//                });
function sendToGCM(regIds, data, callback) {
    var message = new gcm.Message();
    message.addData(data);
    sender.send(message, regIds, callback);
}

app.put('/chat/:id', function (req, res, next) {
    var myId = req.myId;
    var chatRoomId = req.params.id;

    if (myId === undefined) {
        var err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }

    if (chatRoomId === undefined) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    getChatRoom(chatRoomId, function (err, chatRoom) {
        if (err) { return next(err); }

        if (chatRoom === null || chatRoom.owner != myId) {
            var err = new Error('Not Found');
            err.status = 404;
            return next(err);
        }

        activeChatRoom(chatRoom, function (err, result) {
            if (err) { return next(err); }

            var result = result.result;
            if (result.nModified == 1) {
//                getMembers(chatRoom.members, function (err, members) {
//                    var regIds = [];
//                    members.forEach(function (member) {
//                        if (member._id != myId) {
//                            regIds.push(member.regId);
//                        }
//                    });
//                    console.log("send: ");
//                    console.log(members);
//                    sendToGCM(regIds, { "message": "hello" }, function (err, result) {
//                        if (err) { return next(err); }
//                        return res.sendStatus(204);
//                    });
//                });
            }

            res.sendStatus(304);
        });
    });
});

app.delete('/chat/:id', function (req, res, next) {
    var myId = req.myId;
    var chatRoomId = req.params.id;

    if (myId === undefined) {
        var err = new Error('Unauthorized');
        err.status = 401;
        return next(err);
    }

    if (chatRoomId === undefined) {
        var err = new Error('Bad Request');
        err.status = 400;
        return next(err);
    }

    daleteChatRoom(myId, chatRoomId, function (err, result) {
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
app.use(function (err, req, res) {
    res.status(err.status || 500);
    res.send(err.stack);
});


/////////////////

require('mongodb').MongoClient.connect('mongodb://localhost:27017/stuckhere', function (err, _db) {
    if (err) {
        throw err;
    }
    db = _db;
    app.listen(3000);
});


////////////////
var db;
var ObjectId = require('mongodb').ObjectId;

function updateUserLocation(id, location, callback) {
    db.collection('location').update(
        { "_id": id },
        { "$set": location },
        { "upsert": 1 },
        callback);
}

function findLocations(where, callback) {
    db.collection('location').find(where).toArray(callback);
}


function findMembersNearByMyLocation(id, mylocation, callback) {
    var latitude = mylocation.latitude;
    var longitude = mylocation.longitude;
    var where = {
        "_id": { "$ne": id },
        "latitude": { "$gt": latitude - 0.003, "$lt": latitude + 0.003 },
        "longitude": { "$gt": longitude - 0.003, "$lt": longitude + 0.003 }
    };

    findLocations(where, function (err, locations) {
        if (err) { return callback(err); }
        var nears = chooseLocationsByDistance(mylocation, locations, 250);

        callback(null, nears);createChatRoom
    });
}

function createChatRoom(owner, title, members, callback) {
    var chatroom = {
        "owner": owner,
        "title": title,
        "members": members,
        "active": false,
        "reg_date": new Date()
    };
    db.collection('chatroom').insert(chatroom, callback);
}

function activeChatRoom(chatRoom, callback) {
    db.collection('chatroom').update(
        chatRoom,
        { "$set": { "active": true } },
        callback);
}

function daleteChatRoom(owner, chatRoomId, callback) {
    db.collection('chatroom').remove({ "_id": ObjectId(chatRoomId), "owner": owner }, callback);
}

function getChatRoom(chatRoomId, callback) {
    db.collection('chatroom').findOne({ "_id": ObjectId(chatRoomId) }, callback);
}
////////////////

function calDistance(mylocation, location) {
    var lat1 = mylocation.latitude;
    var lng1 = mylocation.longitude;
    var lat2 = location.latitude;
    var lng2 = location.longitude;

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

function chooseLocationsByDistance(mylocation, locations, dist) {
    var result = [];
    locations.forEach(function (location) {
        var _dist = calDistance(mylocation, location);
        if (_dist <= dist) {
            result.push(location);
        }
    });
    return result;
}