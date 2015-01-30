(function(){
"use strict";

var HttpError = window.reds ? reds.HttpError : require("../shared/HttpError");

// INFO Leaf client module

var Request = function(crypto, credentials) {
    this.$method = "";
    this.$type = "application/octet-stream";
    this.$data = "";
    this.$responseText = undefined;
    this.$responseJson = undefined;
    this.$responseType = undefined
    this.$responseAuthorization = undefined
    this.$xhr = new XMLHttpRequest();
    this.$xhr.addEventListener("load", this.$onLoad.bind(this), false);
    // TODO store client instead
    this.crypto = crypto;
    // NOTE Pass event handling to XMLHttpRequest
    this.addEventListener = this.$xhr.addEventListener.bind(this.$xhr);
    this.removeEventListener = this.$xhr.removeEventListener.bind(this.$xhr);
    this.dispatchEvent = this.$xhr.dispatchEvent.bind(this.$xhr);
}

Request.prototype.$onLoad = function(evt) {
    var error;
    if (this.$xhr.status >= 400) {
        evt.stopImmediatePropagation();
        error = new HttpError(this.$xhr.status, this.$xhr.statusText);
        this.dispatchEvent(new CustomEvent("error", {'detail':error}));
    }
}
    
Request.prototype.open = function(method, node, path) {
    this.$method = method;
    return this.$xhr.open(method, node+path, true);
}

Request.prototype.write = function(data, credentials) {
    var vec;
    if (this.$data.length)
        throw new Error("Multiple Request.write calls are not supported yet (TODO)");
    if (data !== undefined) {
        this.$type = "application/json;charset=UTF-8";
        this.$data = JSON.stringify(data);
        if (credentials) {
            vec = this.crypto.generateTimestamp();
            this.$type = "application/x.reds.encrypted;did="+credentials[4]+";vec="+vec;
            this.$data = this.crypto.encryptData(this.$data, credentials[2], vec);
        }
    }
}

Request.prototype.send = function() {
    this.dispatchEvent(new Event("send"));
    this.$xhr.setRequestHeader("Content-Type", this.$type);
    // NOTE Sending the data as a blob prevents Firefox (and maybe other browsers)
    //      from adding a charset value to the content-type header.
    return this.$xhr.send(new Blob([this.$data]));
}

Request.prototype.sign = function(realm, credentials) {
    var vec, msg, sig;
    vec = this.crypto.generateTimestamp();
    msg = this.crypto.concatenateStrings(
        realm,
        credentials[1],
        vec,
        this.crypto.name,
        this.$method,
        this.$type,
        this.$data
    );
    sig = this.crypto.generateHmac(msg, credentials[2]);
    // TODO Swap crypto.name and sig
    this.$xhr.setRequestHeader("Authorization", realm+":"+credentials[1]+":"+vec+":"+sig+":"+this.crypto.name);
}

Request.prototype.verify = function(realm, credentials) {
    var msg, sig;
    if (!this.responseAuthorization)
        throw new Error("missing authorization");
    if (this.responseAuthorization['realm'] != realm)
        throw new Error("invalid realm");
    if (this.responseAuthorization['id'] != credentials[1])
        throw new Error("invalid credentials");
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.responseAuthorization['crypto'] != this.crypto.name)
        throw new Error("unsupported crypto facility");
    msg = this.crypto.concatenateStrings(
        this.responseAuthorization['realm'],
        this.responseAuthorization['id'],
        this.responseAuthorization['vec'],
        this.responseAuthorization['crypto'],
        this.$xhr.getResponseHeader("Content-Type"),
        this.$xhr.responseText||""
    );
    sig = this.crypto.generateHmac(msg, credentials[2]);
    if (sig != this.responseAuthorization['sig'])
        throw new Error("invalid authorization");
}

Request.prototype.decrypt = function(credentials) {
    this.$responseText = this.crypto.decryptData(this.$xhr.responseText, credentials[2], this.responseType.options['vec']);
}

Request.prototype.setUnmodifiedSince = function(timestamp) {
    var date, msec;
    date = new Date(timestamp);
    msec = ('000'+date.getUTCMilliseconds()).substr(-3);
    this.$xhr.setRequestHeader("if-unmodified-since", date.toUTCString().replace(/ GMT$/, "."+msec+" GMT"));
}

Object.defineProperty(Request.prototype, "responseText", {
    get: function() {
        return this.$responseText ? this.$responseText : this.$xhr.responseText;
    }
});

Object.defineProperty(Request.prototype, "responseJson", {
    get: function() {
        if (this.$responseJson === undefined)
            this.$responseJson = this.responseText ? JSON.parse(this.responseText) : null;
        return this.$responseJson;
    }
});

Object.defineProperty(Request.prototype, "responseType", {
    get: function() {
        if (this.$responseType === undefined) {
            this.$responseType = null;
            if (this.$xhr.getResponseHeader("Content-Type")) {
                this.$responseType = {
                    'name': null,
                    'options': {}
                };
                this.$responseType.name = this.$xhr.getResponseHeader("Content-Type").replace(/;\s*([^;=]*)\s*=\s*([^;]*)\s*/g, function(m, p1, p2) {
                    if (p1.length)
                        this.$responseType.options[p1] = p2;
                    return "";
                }.bind(this));
            }
        }
        return this.$responseType;
    }
});

Object.defineProperty(Request.prototype, "responseAuthorization", {
    get: function() {
        if (this.$responseAuthorization === undefined) {
            this.$responseAuthorization = this.$xhr.getResponseHeader("Authorization") || null;
            if (this.$responseAuthorization) {
                this.$responseAuthorization = this.$responseAuthorization.match(/(\w+):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([A-Za-z0-9\+\/]+={0,2}):([\w-]+)/)
                if (this.$responseAuthorization) {
                    this.$responseAuthorization = {
                        'realm': this.$responseAuthorization[1],
                        'id': this.$responseAuthorization[2],
                        'vec': this.$responseAuthorization[3],
                        'sig': this.$responseAuthorization[4],
                        'crypto': this.$responseAuthorization[5],
                    };
                }
            }
        }
        return this.$responseAuthorization;
    }
});

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Request : ((self.reds=self.reds||new Object()).leaf=reds.leaf||new Object()).Request=Request;

})();
