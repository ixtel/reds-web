(function(){
"use strict";

var HttpError = window.reds ? reds.HttpError : require("../shared/HttpError");

// INFO Leaf client module

var Request = function(client, options) {
    // NOTE Remap event handler scope
    this.$onLoad = this.$onLoad.bind(this);
    this.$onError = this.$onError.bind(this);
    this.$onBeforeOnload = this.$onBeforeOnload.bind(this);
    // NOTE Protected properties
    this.$type = "application/octet-stream";
    this.$data = "";
    this.$responseText = undefined;
    this.$responseJson = undefined;
    this.$responseType = undefined;
    this.$responseAuthorization = undefined
    this.$xhr = new XMLHttpRequest();
    this.$xhr.addEventListener("load", this.$onLoad, false);
    this.$xhr.addEventListener("error", this.$onError, false);
    // For benchmarking
    this.$s = null;
    // NOTE Public properties
    this.client = client;
    this.options = options;
    // NOTE Pass event handling to XMLHttpRequest
    this.addEventListener = this.$xhr.addEventListener.bind(this.$xhr);
    this.removeEventListener = this.$xhr.removeEventListener.bind(this.$xhr);
    this.dispatchEvent = this.$xhr.dispatchEvent.bind(this.$xhr);
}

Request.prototype.$benchmark = false;

// TODO HTTP Error have to handled after verification (!) by the client!
//      Get the xhr status and pass it via a custom load event.
Request.prototype.$onLoad = function(evt) {
    if (this.$benchmark) {
        var s = Date.now()-this.$s;
        var l = this.$xhr.responseText.length+this.$data.length;
        console.log("BENCHMARK request took "+s+" ms");
        console.log("BENCHMARK request size: "+l+" B");
        console.log("BENCHMARK request speed: "+(l/s)+" kB/s");
    }
    try {
        window.removeEventListener("beforeunload", this.$onBeforeOnload);
        if (this.$xhr.status >= 400)
            throw new HttpError(this.$xhr.status, this.$xhr.statusText, this.$xhr.responseText);
        if (this.options.realm && this.options.credentials) {
            this.verify(this.options.realm, this.options.credentials);
            if (this.options.realm == "stream")
                this.decrypt(this.options.credentials);
        }
        evt.detail = {
            'code': this.$xhr.status,
            'message': this.$xhr.statusText,
            'data': this.responseJson,
            'type': this.responseType
        };
    }
    catch (e) {
        evt.stopImmediatePropagation();
        this.dispatchEvent(new CustomEvent("error", {'detail':e}));
    }
}

Request.prototype.$onError = function (evt) {
    try {
        window.removeEventListener("onBeforeOnload", this.$onBeforeOnload);
        if (evt.detail === undefined) {
            // NOTE There seems to be no way to get more information
            //      about the actual error that occured.
            evt.detail = new Error("XMLHttpRequest network error");
        }
    }
    catch (e) {
        evt.detail = e;
    }
}


Request.prototype.$onBeforeOnload = function (evt) {
    window.removeEventListener("onBeforeOnload", this.$onBeforeOnload);
    console.warn("aborting HTTP request due to page unload");
    this.$xhr.abort();
}

Request.prototype.write = function(data) {
    if (this.$data.length)
        throw new Error("Multiple Request.write calls are not supported yet (TODO)");
    if (data !== undefined) {
        this.$type = "application/json;charset=UTF-8";
        this.$data = JSON.stringify(data);
    }
}

Request.prototype.sign = function() {
    var vec, msg, sig;
    if (this.options.realm == "pod")
        return;
    vec = this.client.crypto.generateTimestamp();
    msg = this.client.crypto.concatenateStrings(
        this.options.realm,
        this.options.credentials[1],
        vec,
        this.client.crypto.name,
        this.options.method,
        this.$type,
        this.$data
    );
    sig = this.client.crypto.generateHmac(msg, this.options.credentials[2]);
    // TODO Set crypto name to front
    this.$xhr.setRequestHeader("Authorization", this.options.realm+":"+this.options.credentials[1]+":"+vec+":"+sig+":"+this.client.crypto.name);
}

Request.prototype.verify = function() {
    var msg, sig;
    if (this.options.realm == "pod")
        this.options.credentials = [null, 0, this.client.crypto.generateSecureHash(this.options.credentials, this.responseJson['psalt'])];
    if (!this.responseAuthorization)
        throw new Error("missing authorization");
    if (this.responseAuthorization['realm'] != this.options.realm)
        throw new Error("invalid realm");
    if (this.responseAuthorization['id'] != this.options.credentials[1])
        throw new Error("invalid credentials");
    // NOTE Note this check won't be needed once the session can handle multiple facilities
    if (this.responseAuthorization['crypto'] != this.client.crypto.name)
        throw new Error("unsupported crypto facility");
    msg = this.client.crypto.concatenateStrings(
        this.responseAuthorization['realm'],
        this.responseAuthorization['id'],
        this.responseAuthorization['vec'],
        this.responseAuthorization['crypto'],
        this.$xhr.getResponseHeader("Content-Type"),
        this.$xhr.responseText||""
    );
    sig = this.client.crypto.generateHmac(msg, this.options.credentials[2]);
    if (sig != this.responseAuthorization['sig'])
        throw new Error("invalid authorization");
}

Request.prototype.encrypt = function() {
    var vec;
    vec = this.client.crypto.generateTimestamp();
    this.$type = "application/x.reds.encrypted;did="+this.options.credentials[4]+";vec="+vec;
    if (this.$data.length)
        this.$data = this.client.crypto.encryptData(this.$data, this.options.credentials[2], vec);
}

Request.prototype.decrypt = function() {
    if (this.$xhr.responseText.length)
        this.$responseText = this.client.crypto.decryptData(this.$xhr.responseText, this.options.credentials[2], this.responseType.options['vec']);
}

Request.prototype.send = function() {
    window.addEventListener("beforeunload", this.$onBeforeOnload, false);
    this.$xhr.open(this.options.method, this.client.options.url+this.options.path, true);
    if (this.options.realm && this.options.credentials) {
        if (this.options.realm == "stream")
            this.encrypt();
        this.sign();
    }
    this.$xhr.setRequestHeader("Content-Type", this.$type);
    if (this.$benchmark) this.$s = Date.now();
    // NOTE Sending the data as a blob prevents Firefox (and maybe other browsers)
    //      from adding a charset value to the content-type header.
    return this.$xhr.send(new Blob([this.$data]));
}

Object.defineProperty(Request.prototype, "responseText", {
    get: function() {
        return this.$responseText ? this.$responseText : this.$xhr.responseText;
    }
});

Object.defineProperty(Request.prototype, "responseJson", {
    get: function() {
        if (this.$responseJson === undefined) {
            this.$responseJson = this.responseText ? JSON.parse(this.responseText) : null;
        }
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
