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
    '/!/node': require("./hooks/node.js"),
    '/!/domain': require("./hooks/domain.js"),
    '/!/domain/ticket': require("./hooks/ticket.js"),
    '/!/domain/leaf': require("./hooks/leaf.js"),
    '*': require("./hooks/entity.js")
}

exports.prototype.delegate = function() {
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
        return callback(null, this.requestJson);
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
            return callback(new HttpError(403, "Unknown node"));
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

exports.prototype.authorizeDomain = function(callback) {
    if (!this.authorization)
        return callback(new HttpError(401, "Missing authorization"));
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.authorization['crypto'] != this.crypto.name)
        return callback(new HttpError(400, "Unsupported crypto facility"));
    if (this.authorization['realm'] != "domain")
        return callback(new HttpError(400, "Invalid realm"));
    this.storage.readDomain(this.authorization['id'], afterReadDomain.bind(this));

    function afterReadDomain(error, result) {
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(403, "Unknown domain"));
        var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
        var sig = this.crypto.generateHmac(msg, result['dkey']);
        if (sig != this.authorization['sig'])
            return callback(new HttpError(403, "Invalid authorization"));
        this.authorization['domain'] = result;
        callback();
    }
}

exports.prototype.authorizeTicket = function(callback) {
    var leaf, domain, ticket;
    if (!this.authorization)
        return callback(new HttpError(401, "Missing authorization"));
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.authorization['crypto'] != this.crypto.name)
        return callback(new HttpError(400, "Unsupported crypto facility"));
    if (this.authorization['realm'] != "ticket")
        return callback(new HttpError(400, "Invalid realm 'ticket'"));
    leaf = this.leafs.getItem(this.authorization['id']);
    if (!leaf)
        return callback(new HttpError(412, "Unknown leaf"));
    this.storage.readDomain(leaf['did'], afterReadDomain.bind(this));

    function afterReadDomain(error, result) {
        var tid;
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(403, "Unknown domain"));
        domain = result;
        tid = this.crypto.decryptData(this.authorization['vec'], domain['dkey'], leaf['vec']);
        this.storage.readTicket(tid, afterReadTicket.bind(this));
    }

    function afterReadTicket(error, result) {
        var key;
        if (error)
            return callback(error);
        if (!result)
            return callback(new HttpError(403, "Unknown ticket"));
        ticket = result;
        key = this.crypto.generateHmac(ticket['tkey'], leaf['vec']);
        var msg = this.crypto.concatenateStrings(this.authorization['realm'], this.authorization['id'], this.authorization['vec'], this.authorization['crypto'], this.request.method, this.request.headers['content-type'], this.requestText||"");
        var sig = this.crypto.generateHmac(msg, key);
        if (sig != this.authorization['sig'])
            return callback(new HttpError(403, "Invalid authorization"));
        this.authorization['leaf'] = leaf;
        this.authorization['domain'] = domain;
        this.authorization['ticket'] = ticket;
        callback();
    }
}

exports.prototype.signDomain = function() {
    var time, msg, sig;
    time = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings("domain", this.authorization.domain['did'], time, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, this.authorization.domain['dkey']);
    this.response.setHeader("Authorization", "domain:"+this.authorization.domain['did']+":"+time+":"+sig+":"+this.crypto.name);
}

exports.prototype.signTicket = function(credentials) {
    var key, tid, msg, sig;
    key = this.crypto.generateHmac(this.authorization.ticket['tkey'], this.authorization.leaf['vec']);
    tid = this.crypto.encryptData(this.authorization.ticket['tid'], this.authorization.domain['dkey'], this.authorization.leaf['vec']);
    msg = this.crypto.concatenateStrings("ticket", this.authorization['id'], tid, this.crypto.name, this.response.getHeader("Content-Type"), this.$responseText);
    sig = this.crypto.generateHmac(msg, key);
    this.response.setHeader("Authorization", "ticket:"+this.authorization['id']+":"+tid+":"+sig+":"+this.crypto.name);
}

exports.prototype.writeEncrypted = function(data, type) {
    var msg, cipher;
    if (data!==undefined) {
        msg = JSON.stringify(data);
        cipher = this.crypto.encryptData(msg, this.authorization.ticket['tkey'], this.authorization.leaf['vec']);
    }
    this.write(cipher, type||"application/x.reds.encrypted;did="+this.type.options['did']);
}

Object.defineProperty(exports.prototype, "requestEncrypted", {
    get: function() {
        var msg;
        if (this.$requestEncrypted === undefined) {
            msg = this.crypto.decryptData(this.requestText, this.authorization.ticket['tkey'], this.authorization.leaf['vec']);
            this.$requestEncrypted = msg ? JSON.parse(msg) : null;
        }
        return this.$requestEncrypted;
    }
});
