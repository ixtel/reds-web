"use strict";

// NOTE The nodejs-1 implementation uses the following configuration
//      keylength: 256bit
//      cipher: AES128-CTR
//      hash: SHA256
//      shash: PBKDF2-HMAC-SHA256
//      curve: SECP256K1-1

var crypto = require("crypto");
var cache = new Object();

var NodeJs = function() {
    // NOTE Nothing to here (but maybe in other facilities)
}

//NodeJs.prototype.name = "nodejs-1";
NodeJs.prototype.name = "256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1";

NodeJs.prototype.generateTimestamp = function() {
    var s = Date.now();
    var now, nowL, nowH, timeBuffer, saltBuffer;
    now = Date.now();
    nowL = now&0xffffffff;
    nowH = Math.floor(now/0xffffffff); // NOTE Bit operations work only for 32bit numbers
    timeBuffer = new Buffer([
        (nowH&0xff000000)>>24,		
        (nowH&0x00ff0000)>>16,		
        (nowH&0x0000ff00)>>8,
        (nowH&0x000000ff),
        (nowL&0xff000000)>>24,		
        (nowL&0x00ff0000)>>16,		
        (nowL&0x0000ff00)>>8,
        (nowL&0x000000ff),		
    ]);
    saltBuffer = crypto.randomBytes(24);
    var r = Buffer.concat([timeBuffer, saltBuffer]).toString('base64');
    console.log("BENCHMARK generateTimestamp took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.compareTimestamps = function(a, b) {
    var s = Date.now();
    var aBuffer, bBuffer;
    aBuffer = new Buffer(a, "base64");
    bBuffer = new Buffer(b, "base64");
    var r = Buffer.compare(aBuffer.slice(0, 8), bBuffer.slice(0, 8));
    console.log("BENCHMARK compareTimestamps took "+(Date.now()-s)+" ms");
    return r;
}

// TODO Check if \n exists in arguments
NodeJs.prototype.concatenateStrings = function() {
    var s = Date.now();
    var strings;
    strings = Array.prototype.slice.apply(arguments);
    var r = strings.join("\n");
    console.log("BENCHMARK concatenateStrings took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.generateSecureHash = function(data, salt, fresh) {
    var s = Date.now();
    var index;
    index = crypto.createHash("sha256").update(this.concatenateStrings(data, salt)).digest('base64');
    if (!fresh && cache[index])
        return cache[index];
    //console.warn("TODO Increase pbkdf2 iterations to 128000 before release.");
    var hashBuffer = crypto.pbkdf2Sync(data, salt, 128000, 32, "sha256");
    cache[index] = hashBuffer.toString("base64");
    var r = cache[index];
    console.log("BENCHMARK generateSecureHash took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.generateKey = function() {
    var s = Date.now();
    var keyBuffer = crypto.randomBytes(32);
    var r = keyBuffer.toString("base64");
    console.log("BENCHMARK generateKey took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.generateKeypair = function() {
    var s = Date.now();
    var ecdh, publicKey, privateKey;
    ecdh = crypto.createECDH("secp256k1");
    publicKey = ecdh.generateKeys("base64");
    privateKey = ecdh.getPrivateKey("base64");
    var r = {
        'privateKey': privateKey,
        'publicKey': publicKey
    }
    console.log("BENCHMARK generateKeypair took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.combineKeypair = function(privateKey, publicKey, padKey) {
    var s = Date.now();
    if (padKey)
        console.warn("Pad key still in use!");
    var ecdh, privateBuffer, publicBuffer, keyBuffer;
    privateBuffer = new Buffer(privateKey, "base64");
    publicBuffer = new Buffer(publicKey, "base64");
    ecdh = crypto.createECDH("secp256k1");
    ecdh.setPrivateKey(privateBuffer);
    keyBuffer = ecdh.computeSecret(publicBuffer);
    var r = keyBuffer.toString("base64");
    console.log("BENCHMARK combineKeypair took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.generateHmac = function(data, key) {
    var s = Date.now();
    var keyBuffer = new Buffer(key, "base64");
    var sha256Hmac = crypto.createHmac("sha256", keyBuffer);
    sha256Hmac.update(data);
    var hmacBuffer = sha256Hmac.digest()
    var r = hmacBuffer.toString("base64");
    console.log("BENCHMARK generateHmac took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.encryptData = function(data, key, vector) {
    var s = Date.now();
    var keyBuffer = (new Buffer(key, "base64")).slice(0, 16);
    var ivBuffer = (new Buffer(vector, "base64")).slice(0, 16);
    var dataBuffer = new Buffer(data, "utf8");
    var cipher = crypto.createCipheriv("aes-128-ctr", keyBuffer, ivBuffer);
    var cdataBuffer = cipher.update(dataBuffer);
    var r = cdataBuffer.toString("base64");
    console.log("BENCHMARK encryptData took "+(Date.now()-s)+" ms");
    return r;
}

NodeJs.prototype.decryptData = function(cdata, key, vector) {
    var s = Date.now();
    var keyBuffer = (new Buffer(key, "base64")).slice(0, 16);
    var ivBuffer = (new Buffer(vector, "base64")).slice(0, 16);
    var cdataBuffer = new Buffer(cdata, "base64");
    var decipher = crypto.createDecipheriv("aes-128-ctr", keyBuffer, ivBuffer);
    var dataBuffer = decipher.update(cdataBuffer);
    var r = dataBuffer.toString("utf8");
    console.log("BENCHMARK decryptData took "+(Date.now()-s)+" ms");
    return r;
}

// NOTE The NodeJs crypto facility can only be used with Node.js, so we skip the check for require() here.
module.exports=exports=NodeJs;
