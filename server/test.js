/**
 * Created by Beom on 15. 7. 3.
 */
var fcaller = require("./fcaller.js");

var caller = new fcaller();
this.next = "global";

function aaa(id, pw, callback) {
    console.log("call aaa");
    console.log("id: " + id + ", pw: " + pw);
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