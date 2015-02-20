"use strict";

var Session = require("../shared/Session");
var HttpError = require("../shared/HttpError");
var TemporaryStorage = require("./TemporaryStorage");


module.exports = exports = function(config, request, response) {
    this.$requestEncrypted = undefined;
    Session.call(this, config, request, response);
}

exports.prototype = Object.create(Session.prototype);

// TODO Make ttl and ttd configurable
exports.prototype.leafs = new TemporaryStorage(30000, 5000);

exports.prototype.HookHandlers = {
    '/!/node': require("./hooks/node"),
    '/!/domain': require("./hooks/domain"),
    '/!/ticket': require("./hooks/ticket"),
    '/!/domain/invitation': require("./hooks/domain/invitation"),
    '/!/domain/ticket': require("./hooks/domain/ticket"),
    '/!/domain/stream': require("./hooks/domain/stream"),
    '*': require("./hooks/entity")
}

exports.prototype.delegate = function() {
    if (this.request.method == "POST" && this.selector.hook == "/!/node")
        Session.prototype.delegate.call(this);
    else
        this.authorizeNode(afterAuthorizeNode.bind(this));

    function afterAuthorizeNode(error, result) {
        if (error)
            return this.abort(error);
        this.storage.options['namespace'] = result['namespace'];
        Session.prototype.delegate.call(this);
    }
}

exports.prototype.authorizeNode = function(callback) {
    // TODO Ignoring a missing authorization and simply returning the
    //      request data is probably not the best idea.
    if (!this.authorization)
        return callback(new HttpError(400, "Missing authorization"));
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.authorization['crypto'] != this.crypto.name)
        return callback(new HttpError(400, "Unsupported crypto facility"));
    if (this.authorization['realm'] != "node")
        return callback(new HttpError(400, "Invalid realm"));
    this.storage.readNode(this.authorization['id'], afterReadDomain.bind(this));

    function afterReadDomain(error, result) {
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(401, "Unknown node"));
        var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
        var sig = this.crypto.generateHmac(msg, result['auth']);
        if (sig != this.authorization['sig'])
            return callback(new HttpError(403, "Invalid authorization"));
        // NOTE Reset the authorization and cleanup the authorization header
        //      to make the way free for other authorzation.
        // TODO Pretty dirty, find a better way
        this.request.headers['authorization'] = this.request.headers['authorization'].substr(this.authorization.length)
        this.$authorization = undefined;
        callback(null, result);
    }
}

exports.prototype.authorizeInvitation = function(callback) {
    if (!this.authorization)
        return callback(new HttpError(400, "Missing authorization"));
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.authorization['crypto'] != this.crypto.name)
        return callback(new HttpError(400, "Unsupported crypto facility"));
    if (this.authorization['realm'] != "invitation")
        return callback(new HttpError(400, "Invalid realm"));
    this.storage.readInvitation(this.authorization['id'], afterReadInvitation.bind(this));

    function afterReadInvitation(error, result) {
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(401, "Unknown invitation"));
        var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
        var sig = this.crypto.generateHmac(msg, result['ikey']);
        if (sig != this.authorization['sig'])
            return callback(new HttpError(403, "Invalid invitation authorization"));
        this.authorization['invitation'] = result;
        callback();
    }
}

exports.prototype.authorizeTicket = function(did, callback) {
    try {
        if (!this.authorization)
            throw new HttpError(400, "missing authorization");
        // NOTE Note this check won't be needed once the session can handle multiple facilities
        if (this.authorization['crypto'] != this.crypto.name)
            throw new HttpError(400, "unsupported crypto facility");
        if (this.authorization['realm'] != "ticket")
            throw new HttpError(400, "invalid realm");
        this.storage.readTickets([this.authorization['id']], did, afterReadTicket.bind(this));
    }
    catch (e) {
        callback(e);
    }

    function afterReadTicket(error, result) {
        try {
            if (error)
                throw error;
            if (!result || !result[0])
                throw new HttpError(401, "unknown ticket");
            var msg = this.crypto.concatenateStrings(
                'ticket',
                this.authorization['id'],
                this.authorization['vec'],
                this.authorization['crypto'],
                this.request.method,
                this.request.headers['content-type'],
                this.requestText||""
            );
            var sig = this.crypto.generateHmac(msg, result[0]['tkey']);
            if (sig != this.authorization['sig'])
                throw new HttpError(403, "invalid authorization");
            this.authorization.ticket = result[0];
        }
        catch (e) {
            return callback(e);
        }
        callback(null);
    }
}

exports.prototype.authorizeStream = function(callback) {
    var stream;
    try {
        if (!this.authorization)
            throw new HttpError(400, "missing authorization");
        // NOTE Note this check won't be needed once the session can handle multiple facilities
        if (this.authorization['crypto'] != this.crypto.name)
            throw new HttpError(400, "unsupported crypto facility");
        if (this.authorization['realm'] != "stream")
            throw new HttpError(400, "invalid realm");
        stream = this.leafs.getItem(this.authorization['id']);
    }
    catch (e) {
        callback(e);
    }
    afterReadStream.call(this, null, [stream]);

    function afterReadStream(error, result) {
        try {
            if (error)
                throw error;
            if (!result || !result[0])
                return callback(new HttpError(412, "unknown leaf"));
            var msg = this.crypto.concatenateStrings(
                'stream',
                this.authorization['id'],
                this.authorization['vec'],
                this.authorization['crypto'],
                this.request.method,
                this.request.headers['content-type'],
                this.requestText||""
            );
            var sig = this.crypto.generateHmac(msg, result[0]['skey']);
            if (sig != this.authorization['sig'])
                throw new HttpError(403, "invalid authorization");
            this.authorization.stream = result[0];
        }
        catch (e) {
            return callback(e);
        }
        callback(null);
    }
}

exports.prototype.signInvitation = function() {
    var time, msg, sig;
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("invitation", this.authorization.invitation['iid'], time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, this.authorization.invitation['ikey']);
    this.response.setHeader("Authorization", "invitation:"+this.authorization.invitation['iid']+":"+time+":"+sig+":"+this.crypto.name);
}

exports.prototype.signTicket = function() {
    var time, msg, sig;
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("ticket", this.authorization.ticket['tid'], time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, this.authorization.ticket['tkey']);
    this.response.setHeader("Authorization", "ticket:"+this.authorization.ticket['tid']+":"+time+":"+sig+":"+this.crypto.name);
}

exports.prototype.signStream = function() {
    var time, msg, sig;
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("stream", this.authorization.stream['sid'], time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, this.authorization.stream['skey']);
    this.response.setHeader("Authorization", "stream:"+this.authorization.stream['sid']+":"+time+":"+sig+":"+this.crypto.name);
}

exports.prototype.signPod = function() {
    var pkey, time, msg, sig;
    pkey = this.crypto.generateSecureHash(this.config['password'], this.config['salt']);
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("pod", 0, time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, pkey);
    this.response.setHeader("Authorization", "pod:"+0+":"+time+":"+sig+":"+this.crypto.name);
}

exports.prototype.writeEncrypted = function(data, type) {
    var msg, vec, cipher;
    vec = this.crypto.generateTimestamp();
    if (data !== undefined) {
        msg = JSON.stringify(data);
        cipher = this.crypto.encryptData(msg, this.authorization.stream['skey'], vec);
    }
    this.write(cipher, type||"application/x.reds.encrypted;did="+this.type.options['did']+";vec="+vec);
}

Object.defineProperty(exports.prototype, "requestEncrypted", {
    get: function() {
        var msg;
        if (this.$requestEncrypted === undefined) {
            msg = this.crypto.decryptData(this.requestText, this.authorization.stream['skey'], this.type.options['vec']);
            this.$requestEncrypted = msg ? JSON.parse(msg) : null;
        }
        return this.$requestEncrypted;
    }
});
