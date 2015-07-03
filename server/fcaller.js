/**
 * Created by Beom on 15. 7. 3.
 */

function Fcaller() {
    if (!(this instanceof Fcaller)) {
        return new Fcaller();
    }

    this.functionQueue = [];
};

Fcaller.prototype.push = function () {
    var fn = arguments[0];

    if (typeof(fn) !== "function") {
        throw new Error("The first argument must be a function.")
    }

    Array.prototype.shift.apply(arguments);
    this.functionQueue.push({ "fn": fn, "arguments": arguments });

    return this;
};

Fcaller.prototype.next = function () {
    if (this.functionQueue.length == 0) {
        return;
    }

    var item = this.functionQueue.shift();
    var args1 = Array.prototype.slice.call(arguments);
    var args2 = Array.prototype.slice.call(item.arguments);
    item.fn.apply(null, args1.concat(args2));
};

Fcaller.prototype.submit = function (fn) {
    if (typeof(fn) === "function") {
        this.functionQueue.push({ "fn": fn, "arguments": [] });
    }

    this.next();
};

module.exports = Fcaller;