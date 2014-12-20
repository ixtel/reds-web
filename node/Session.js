"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");

module.exports = exports = function(config, request, response) {
    Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

exports.prototype.HookHandlers = {
    '/!/account': require("./hooks/account"),
    '/!/pod': require("./hooks/pod"),
    '/!/invitation': require("./hooks/invitation"),
    '/!/domain': require("./hooks/domain"),
    '/!/domain/ticket': require("./hooks/ticket"),
    '/!/domain/leaf': require("./hooks/leaf"),
    '*': require("./hooks/entity")
}

exports.prototype.authorizeAccount = function(callback) {
    if (!this.authorization)
        return callback(new HttpError(401, "Missing authorization"));
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.authorization['crypto'] != this.crypto.name)
        return callback(new HttpError(400, "Unsupported crypto facility"));
    if (this.authorization['realm'] != "account")
        return callback(new HttpError(400, "Invalid realm"));
    this.storage.readAccount(this.authorization['id'], afterReadAccount.bind(this));

    function afterReadAccount(error, result) {
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(403, "Unknown account"));
        var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
        var sig = this.crypto.generateHmac(msg, result['auth']);
        if (sig != this.authorization['sig'])
            return callback(new HttpError(403, "Invalid authorization"));
        this.authorization['account'] = result;
        callback();
    }
}

exports.prototype.signAccount = function() {
    var time, msg, sig;
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("account", this.authorization.account['aid'], time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, this.authorization.account['auth']);
    this.response.setHeader("Authorization", "account:"+this.authorization.account['aid']+":"+time+":"+sig+":"+this.crypto.name);
}
