/**
 * Created by Beom on 15. 7. 3.
 */
var fcaller = require("./fcaller.js");

var caller = new fcaller();
this.next = "global";
var teststr = "teststr";

function aaa(id, pw, callback) {
    console.log("call aaa");
    console.log("id: " + id + ", pw: " + pw);
    console.log(teststr);
    var userinfo = {
        "regid": "abcd1234!@#$"
    };
    callback(userinfo);
};

function bbb(regid, message, callback) {
    console.log("call bbb");
    console.log("regid: " + regid + ", message: " + message);
    var status = 200;
    callback(200);
};

function ccc(status, callback) {
    console.log("call ccc");
    console.log("status: " + status);
    callback(new Error("res err"));
};

var message = "hello!";
caller.push(aaa, "baleian", "1234", function (userinfo) {
    caller.next(userinfo.regid, message);
});
caller.push(bbb, function (status) {
    caller.next(status);
});
caller.push(ccc, function (err) {
    if (err) {
        return;
    }
    caller.next(err);
});
caller.submit(function (err) {
    console.log(err);
})

//caller.next();
//caller.next();


//function CC() {
//    this.str = "it's me!!";
//};
//
//CC.prototype.aaa = function () {
//    console.log(this.str);
//}
//var cc = new CC();
//caller.push(cc.aaa.bind(cc));
//caller.next();




var caller = new fcaller();

caller.push(updateUserLocation, db, identity, latitude, longitude, function (err) {
    if (err) { return caller.error(err); }
    caller.next();
});

caller.push(findMembersNearByMe, db, identity, latitude, longitude, function (err, nears) {
    if (err) { return caller.error(err); }
    caller.next(db, title, identity, nears);
});

caller.push(createChatRoom, function (err) {
    if (err) {
        if (err.code == 11000) {
            err.status = 412;
        }
        return caller.error(err);
    }
    caller.success(nears);
});

caller.onError(function (err) {
    next(err);
});

caller.onSuccess(function (result) {
    res.status(201).json(result);
});

caller.submit(identity, latitude, longitude, title);