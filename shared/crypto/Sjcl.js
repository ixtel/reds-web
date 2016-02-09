(function(){
"use strict";

// NOTE The sjcl-1 implementation uses the following configuration
//      keylength: 256bit
//      cipher: AES128-CTR
//      hash: SHA256
//      shash: PBKDF2-HMAC-SHA256
//      curve: SECP256K1-1

var sjcl = loadSjcl();
sjcl.beware["CTR mode is dangerous because it doesn't protect message integrity."]();
var cache = new Object();

var Sjcl = function() {
    // NOTE Nothing to here (but maybe in other facilities)
}

Sjcl.prototype.$benchmark = false;

//NodeCrypto.prototype.name = "sjcl-1";
Sjcl.prototype.name = "256_AES128-CTR_SHA256_PBKDF2-HMAC-SHA256_SECP256K1-1";

Sjcl.prototype.generateTimestamp = function() {
    if (this.$benchmark) var s = Date.now();
    var now = Date.now();
    var low = now&0xffffffff;
    var high = Math.floor(now/0xffffffff);
    var timeBytes = [high, low];
    var saltBytes = sjcl.random.randomWords(6, 10);
    var r = sjcl.codec.base64.fromBits(timeBytes.concat(saltBytes));
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl generateKeypair took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.compareTimestamps = function(a, b) {
    if (this.$benchmark) var s = Date.now();
    var timeA = sjcl.codec.base64.toBits(a);
    var timeB = sjcl.codec.base64.toBits(b);
    var nowA = timeA[0]*0x100000000 + timeA[1];
    var nowB = timeB[0]*0x100000000 + timeB[1];
    var r = nowA - nowB;
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl compareTimestamps took "+(Date.now()-s)+" ms");
    return r;
}

// TODO Check if \n exists in arguments
Sjcl.prototype.concatenateStrings = function() {
    if (this.$benchmark) var s = Date.now();
    var values = Array.prototype.slice.apply(arguments);
    var r = values.join("\n");
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl concatenateStrings  took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.generateSecureHash = function(data, salt, fresh) {
    if (this.$benchmark) var s = Date.now();
    var index = sjcl.hash.sha256.hash(this.concatenateStrings(data, salt));
    index = sjcl.codec.base64.fromBits(index); 
    if (!fresh && cache[index])
        return cache[index];
    //console.warn("TODO Increase pbkdf2 iterations to 128000 before release.");
    var hashBits = sjcl.misc.pbkdf2(data, salt, 128000, 256);
    cache[index] = sjcl.codec.base64.fromBits(hashBits);
    var r = cache[index];
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl generateSecureHash took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.generateKey = function() {
    if (this.$benchmark) var s = Date.now();
    var keyBits = sjcl.random.randomWords(8, 10);
    var r = sjcl.codec.base64.fromBits(keyBits);
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl generateKey took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.generateKeypair = function() {
    if (this.$benchmark) var s = Date.now();
    var privateBn = sjcl.bn.random(sjcl.ecc.curves.k256.r, 10);
    var pointBn = sjcl.ecc.curves.k256.G.mult(privateBn);
    // NOTE [0x80004000000] is the bitArray representation of the 0x04
    //      header byte for uncompressed public keys.
    var publicBits = sjcl.bitArray.concat([0x80004000000], pointBn.toBits());
    var r = {
        'privateKey': sjcl.codec.base64.fromBits(privateBn.toBits()),
        'publicKey': sjcl.codec.base64.fromBits(publicBits)
    }
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl generateKeypair took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.combineKeypair = function(privateKey, publicKey, padKey) {
    if (this.$benchmark) var s = Date.now();
    if (padKey)
        console.warn("Pad key still in use!");
    var privateBits = sjcl.codec.base64.toBits(privateKey);
    var publicBits = sjcl.bitArray.bitSlice(sjcl.codec.base64.toBits(publicKey), 8);
    var privateBn = sjcl.bn.fromBits(privateBits);
    var publicBn = sjcl.ecc.curves.k256.fromBits(publicBits);
    var sharedBn = publicBn.mult(privateBn);
    //var keyBits = sjcl.hash.sha256.hash(sharedBn.toBits());
    var keyBits = 	sjcl.bitArray.clamp(sharedBn.toBits(), 256);
    var r = sjcl.codec.base64.fromBits(keyBits);
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl combineKeypair took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.generateHmac = function(data, key) {
    if (this.$benchmark) var s = Date.now();
    var keyBits = sjcl.codec.base64.toBits(key);
    var sha256Hmac = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
    var hmacBits = sha256Hmac.encrypt(data);
    var r = sjcl.codec.base64.fromBits(hmacBits);
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl generateHmac took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.encryptData = function(data, key, vector) {
    if (this.$benchmark) var s = Date.now();
    var keyBits = sjcl.codec.base64.toBits(key).slice(0, 4);
    var ivBits = sjcl.codec.base64.toBits(vector).slice(0, 4);
    var dataBits = sjcl.codec.utf8String.toBits(data);
    var aes128Cipher = new sjcl.cipher.aes(keyBits);
    var cdataBits = sjcl.mode.ctr.encrypt(aes128Cipher, dataBits, ivBits);
    var r = sjcl.codec.base64.fromBits(cdataBits);
    if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl encryptData took "+(Date.now()-s)+" ms");
    return r;
}

Sjcl.prototype.decryptData = function(cdata, key, vector) {
    try {
        if (this.$benchmark) var s = Date.now();
        var keyBits = sjcl.codec.base64.toBits(key).slice(0, 4);
        var ivBits = sjcl.codec.base64.toBits(vector).slice(0, 4);
        var cdataBits = sjcl.codec.base64.toBits(cdata);
        var aes128Cipher = new sjcl.cipher.aes(keyBits);
        var dataBits = sjcl.mode.ctr.decrypt(aes128Cipher, cdataBits, ivBits);
        var r = sjcl.codec.utf8String.fromBits(dataBits);
        if (this.$benchmark) console.log("BENCHMARK crypto/Sjcl decryptData took "+(Date.now()-s)+" ms");
        return r;
    }
    catch (e) {
        console.info("Sjcl crypto falls back to AES128-CCM");
        // TODO Is one iteration enough to generate a decent key?
        //      Can/Shall we use just a SHA256 HMAC instead?
        var derivedBits = sjcl.misc.pbkdf2(key, vector, 1, 256);
        keyBits = derivedBits.slice(0, 4);
        ivBits = derivedBits.slice(4, 8);
        cdataBits = sjcl.codec.base64.toBits(cdata);
        aes128Cipher = new sjcl.cipher.aes(keyBits);
        dataBits = sjcl.mode.ccm.decrypt(aes128Cipher, cdataBits, ivBits);
        return sjcl.codec.utf8String.fromBits(dataBits);
    }
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=Sjcl : ((self.reds=self.reds||new Object()).crypto=self.reds.crypto||new Object()).Sjcl = Sjcl;

// INFO Stanford JavaScript Crypto
//      GitHub master 2014-10-07
//  	Components: aes bitArray codecString codecBase64 codecBytes
//      sha256 ccm hmac pbkdf2 random bn ecc

function loadSjcl() {

////////////////////////////////////////////////////////////////////////////////
//
// SJCL used to be in the public domain. Now it's:
// 
// Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh, Stanford University.
// 
// This is for liability reasons. (Speaking of which, SJCL comes with NO
// WARRANTY WHATSOEVER, express or implied, to the limit of applicable
// law.)
// 
// SJCL is dual-licensed under the GNU GPL version 2.0 or higher, and a
// 2-clause BSD license. You may use SJCL under the terms of either of
// these licenses. For your convenience, the GPL versions 2.0 and 3.0
// and the 2-clause BSD license are included here. Additionally, you may
// serve "crunched" copies of sjcl (i.e. those with comments removed,
// and other transformations to reduce code size) without any copyright
// notice.
// 
// SJCL includes JsDoc toolkit, YUI compressor, Closure compressor,
// JSLint and the CodeView template in its build system. These programs'
// copyrights are owned by other people. They are distributed here under
// the MPL, MIT, BSD, Apache and JSLint licenses. Codeview is "free for
// download" but has no license attached; it is Copyright 2010 Wouter Bos.
// 
// The BSD license is (almost?) strictly more permissive, but the
// additionally licensing under the GPL allows us to use OCB 2.0 code
// royalty-free (at least, if OCB 2.0's creator Phil Rogaway has anything
// to say about it). Note that if you redistribute SJCL under a license
// other than the GPL, you or your users may need to pay patent licensing
// fees for OCB 2.0.
// 
// There may be patents which apply to SJCL other than Phil Rogaway's OCB
// patents. We suggest that you consult legal counsel before using SJCL
// in a commercial project.
//
////////////////////////////////////////////////////////////////////////////////

"use strict";var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
"undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});
sjcl.cipher.aes=function(a){this.w[0][0][0]||this.R();var b,c,d,e,f=this.w[0][4],g=this.w[1];b=a.length;var h=1;if(4!==b&&6!==b&&8!==b)throw new sjcl.exception.invalid("invalid aes key size");this.g=[d=a.slice(0),e=[]];for(a=b;a<4*b+28;a++){c=d[a-1];if(0===a%b||8===b&&4===a%b)c=f[c>>>24]<<24^f[c>>16&255]<<16^f[c>>8&255]<<8^f[c&255],0===a%b&&(c=c<<8^c>>>24^h<<24,h=h<<1^283*(h>>7));d[a]=d[a-b]^c}for(b=0;a;b++,a--)c=d[b&3?a:a-4],e[b]=4>=a||4>b?c:g[0][f[c>>>24]]^g[1][f[c>>16&255]]^g[2][f[c>>8&255]]^g[3][f[c&
255]]};
sjcl.cipher.aes.prototype={encrypt:function(a){return t(this,a,0)},decrypt:function(a){return t(this,a,1)},w:[[[],[],[],[],[]],[[],[],[],[],[]]],R:function(){var a=this.w[0],b=this.w[1],c=a[4],d=b[4],e,f,g,h=[],k=[],m,n,l,p;for(e=0;0x100>e;e++)k[(h[e]=e<<1^283*(e>>7))^e]=e;for(f=g=0;!c[f];f^=m||1,g=k[g]||1)for(l=g^g<<1^g<<2^g<<3^g<<4,l=l>>8^l&255^99,c[f]=l,d[l]=f,n=h[e=h[m=h[f]]],p=0x1010101*n^0x10001*e^0x101*m^0x1010100*f,n=0x101*h[l]^0x1010100*l,e=0;4>e;e++)a[e][f]=n=n<<24^n>>>8,b[e][l]=p=p<<24^p>>>8;for(e=
0;5>e;e++)a[e]=a[e].slice(0),b[e]=b[e].slice(0)}};
function t(a,b,c){if(4!==b.length)throw new sjcl.exception.invalid("invalid aes block size");var d=a.g[c],e=b[0]^d[0],f=b[c?3:1]^d[1],g=b[2]^d[2];b=b[c?1:3]^d[3];var h,k,m,n=d.length/4-2,l,p=4,r=[0,0,0,0];h=a.w[c];a=h[0];var q=h[1],w=h[2],x=h[3],y=h[4];for(l=0;l<n;l++)h=a[e>>>24]^q[f>>16&255]^w[g>>8&255]^x[b&255]^d[p],k=a[f>>>24]^q[g>>16&255]^w[b>>8&255]^x[e&255]^d[p+1],m=a[g>>>24]^q[b>>16&255]^w[e>>8&255]^x[f&255]^d[p+2],b=a[b>>>24]^q[e>>16&255]^w[f>>8&255]^x[g&255]^d[p+3],p+=4,e=h,f=k,g=m;for(l=
0;4>l;l++)r[c?3&-l:l]=y[e>>>24]<<24^y[f>>16&255]<<16^y[g>>8&255]<<8^y[b&255]^d[p++],h=e,e=f,f=g,g=b,b=h;return r}
sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.ea(a.slice(b/32),32-(b&31)).slice(1);return void 0===c?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.ea(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;
return 0===b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b=b&31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return!1;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];
return 0===c},ea:function(a,b,c,d){var e;e=0;for(void 0===d&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},U:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>24),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
sjcl.codec.base64={X:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.X,g=0,h=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<h;)d+=f.charAt((g^a[c]>>>e)>>>26),6>e?(g=a[c]<<6-e,e+=26,c++):(g<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.X,g=0,h;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++){h=f.indexOf(a.charAt(d));
if(0>h)throw new sjcl.exception.invalid("this isn't base64!");26<e?(e-=26,c.push(g^h>>>e),g=h<<32-e):(e+=6,g^=h<<32-e)}e&56&&c.push(sjcl.bitArray.partial(e&56,g,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};
sjcl.codec.bytes={fromBits:function(a){var b=[],c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b.push(e>>>24),e<<=8;return b},toBits:function(a){var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a[c],3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};sjcl.hash.sha256=function(a){this.g[0]||this.R();a?(this.H=a.H.slice(0),this.C=a.C.slice(0),this.s=a.s):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.H=this.ba.slice(0);this.C=[];this.s=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.C=sjcl.bitArray.concat(this.C,a);b=this.s;a=this.s=b+sjcl.bitArray.bitLength(a);if("undefined"!==typeof Uint32Array){var d=new Uint32Array(c),e=0;for(b=512+b&-512;b<=a;b+=512)u(this,d.subarray(16*e,16*(e+1))),e+=1;c.splice(0,16*e)}else for(b=512+b&-512;b<=a;b+=512)u(this,c.splice(0,16));return this},
finalize:function(){var a,b=this.C,c=this.H,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.s/0x100000000));for(b.push(this.s|0);b.length;)u(this,b.splice(0,16));this.reset();return c},ba:[],g:[],R:function(){function a(a){return 0x100000000*(a-Math.floor(a))|0}var b=0,c=2,d;a:for(;64>b;c++){for(d=2;d*d<=c;d++)if(0===c%d)continue a;8>b&&(this.ba[b]=a(Math.pow(c,.5)));this.g[b]=a(Math.pow(c,1/3));b++}}};
function u(a,b){var c,d,e,f=a.H,g=a.g,h=f[0],k=f[1],m=f[2],n=f[3],l=f[4],p=f[5],r=f[6],q=f[7];for(c=0;64>c;c++)16>c?d=b[c]:(d=b[c+1&15],e=b[c+14&15],d=b[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+b[c&15]+b[c+9&15]|0),d=d+q+(l>>>6^l>>>11^l>>>25^l<<26^l<<21^l<<7)+(r^l&(p^r))+g[c],q=r,r=p,p=l,l=n+d|0,n=m,m=k,k=h,h=d+(k&m^n&(k^m))+(k>>>2^k>>>13^k>>>22^k<<30^k<<19^k<<10)|0;f[0]=f[0]+h|0;f[1]=f[1]+k|0;f[2]=f[2]+m|0;f[3]=f[3]+n|0;f[4]=f[4]+l|0;f[5]=f[5]+p|0;f[6]=f[6]+r|0;f[7]=
f[7]+q|0}
sjcl.mode.ccm={name:"ccm",I:[],listenProgress:function(a){sjcl.mode.ccm.I.push(a)},unListenProgress:function(a){a=sjcl.mode.ccm.I.indexOf(a);-1<a&&sjcl.mode.ccm.I.splice(a,1)},la:function(a){var b=sjcl.mode.ccm.I.slice(),c;for(c=0;c<b.length;c+=1)b[c](a)},encrypt:function(a,b,c,d,e){var f,g=b.slice(0),h=sjcl.bitArray,k=h.bitLength(c)/8,m=h.bitLength(g)/8;e=e||64;d=d||[];if(7>k)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(f=2;4>f&&m>>>8*f;f++);f<15-k&&(f=15-k);c=h.clamp(c,
8*(15-f));b=sjcl.mode.ccm.Z(a,b,c,d,e,f);g=sjcl.mode.ccm.$(a,g,c,b,e,f);return h.concat(g.data,g.tag)},decrypt:function(a,b,c,d,e){e=e||64;d=d||[];var f=sjcl.bitArray,g=f.bitLength(c)/8,h=f.bitLength(b),k=f.clamp(b,h-e),m=f.bitSlice(b,h-e),h=(h-e)/8;if(7>g)throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes");for(b=2;4>b&&h>>>8*b;b++);b<15-g&&(b=15-g);c=f.clamp(c,8*(15-b));k=sjcl.mode.ccm.$(a,k,c,m,e,b);a=sjcl.mode.ccm.Z(a,k.data,c,d,e,b);if(!f.equal(k.tag,a))throw new sjcl.exception.corrupt("ccm: tag doesn't match");
return k.data},qa:function(a,b,c,d,e,f){var g=[],h=sjcl.bitArray,k=h.U;d=[h.partial(8,(b.length?64:0)|d-2<<2|f-1)];d=h.concat(d,c);d[3]|=e;d=a.encrypt(d);if(b.length)for(c=h.bitLength(b)/8,65279>=c?g=[h.partial(16,c)]:0xffffffff>=c&&(g=h.concat([h.partial(16,65534)],[c])),g=h.concat(g,b),b=0;b<g.length;b+=4)d=a.encrypt(k(d,g.slice(b,b+4).concat([0,0,0])));return d},Z:function(a,b,c,d,e,f){var g=sjcl.bitArray,h=g.U;e/=8;if(e%2||4>e||16<e)throw new sjcl.exception.invalid("ccm: invalid tag length");
if(0xffffffff<d.length||0xffffffff<b.length)throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data");c=sjcl.mode.ccm.qa(a,d,c,e,g.bitLength(b)/8,f);for(d=0;d<b.length;d+=4)c=a.encrypt(h(c,b.slice(d,d+4).concat([0,0,0])));return g.clamp(c,8*e)},$:function(a,b,c,d,e,f){var g,h=sjcl.bitArray;g=h.U;var k=b.length,m=h.bitLength(b),n=k/50,l=n;c=h.concat([h.partial(8,f-1)],c).concat([0,0,0]).slice(0,4);d=h.bitSlice(g(d,a.encrypt(c)),0,e);if(!k)return{tag:d,data:[]};for(g=0;g<k;g+=4)g>n&&(sjcl.mode.ccm.la(g/
k),n+=l),c[3]++,e=a.encrypt(c),b[g]^=e[0],b[g+1]^=e[1],b[g+2]^=e[2],b[g+3]^=e[3];return{tag:d,data:h.clamp(b,m)}}};void 0===sjcl.beware&&(sjcl.beware={});
sjcl.beware["CTR mode is dangerous because it doesn't protect message integrity."]=function(){sjcl.mode.ctr={name:"ctr",encrypt:function(a,b,c,d){return sjcl.mode.ctr.W(a,b,c,d)},decrypt:function(a,b,c,d){return sjcl.mode.ctr.W(a,b,c,d)},W:function(a,b,c,d){var e,f,g;if(d&&d.length)throw new sjcl.exception.invalid("ctr can't authenticate data");if(128!==sjcl.bitArray.bitLength(c))throw new sjcl.exception.invalid("ctr iv must be 128 bits");if(!(d=b.length))return[];c=c.slice(0);e=b.slice(0);b=sjcl.bitArray.bitLength(e);
for(g=0;g<d;g+=4)f=a.encrypt(c),e[g]^=f[0],e[g+1]^=f[1],e[g+2]^=f[2],e[g+3]^=f[3],c[3]++;return sjcl.bitArray.clamp(e,b)}}};sjcl.misc.hmac=function(a,b){this.aa=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.B=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.B[0].update(c[0]);this.B[1].update(c[1]);this.T=new b(this.B[0])};
sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){if(this.ga)throw new sjcl.exception.invalid("encrypt on already updated hmac called!");this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.T=new this.aa(this.B[0]);this.ga=!1};sjcl.misc.hmac.prototype.update=function(a){this.ga=!0;this.T.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.T.finalize(),a=(new this.aa(this.B[1])).update(a).finalize();this.reset();return a};
sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E3;if(0>d||0>c)throw sjcl.exception.invalid("invalid params to pbkdf2");"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,g,h,k,m=[],n=sjcl.bitArray;for(k=1;32*m.length<(d||1);k++){e=f=a.encrypt(n.concat(b,[k]));for(g=1;g<c;g++)for(f=a.encrypt(f),h=0;h<f.length;h++)e[h]^=f[h];m=m.concat(e)}d&&(m=n.clamp(m,d));return m};
sjcl.prng=function(a){this.h=[new sjcl.hash.sha256];this.u=[0];this.S=0;this.J={};this.P=0;this.Y={};this.da=this.j=this.v=this.na=0;this.g=[0,0,0,0,0,0,0,0];this.l=[0,0,0,0];this.N=void 0;this.O=a;this.F=!1;this.M={progress:{},seeded:{}};this.A=this.ma=0;this.K=1;this.L=2;this.ia=0x10000;this.V=[0,48,64,96,128,192,0x100,384,512,768,1024];this.ja=3E4;this.ha=80};
sjcl.prng.prototype={randomWords:function(a,b){var c=[],d;d=this.isReady(b);var e;if(d===this.A)throw new sjcl.exception.notReady("generator isn't seeded");if(d&this.L){d=!(d&this.K);e=[];var f=0,g;this.da=e[0]=(new Date).valueOf()+this.ja;for(g=0;16>g;g++)e.push(0x100000000*Math.random()|0);for(g=0;g<this.h.length&&(e=e.concat(this.h[g].finalize()),f+=this.u[g],this.u[g]=0,d||!(this.S&1<<g));g++);this.S>=1<<this.h.length&&(this.h.push(new sjcl.hash.sha256),this.u.push(0));this.j-=f;f>this.v&&(this.v=
f);this.S++;this.g=sjcl.hash.sha256.hash(this.g.concat(e));this.N=new sjcl.cipher.aes(this.g);for(d=0;4>d&&(this.l[d]=this.l[d]+1|0,!this.l[d]);d++);}for(d=0;d<a;d+=4)0===(d+1)%this.ia&&v(this),e=z(this),c.push(e[0],e[1],e[2],e[3]);v(this);return c.slice(0,a)},setDefaultParanoia:function(a,b){if(0===a&&"Setting paranoia=0 will ruin your security; use it only for testing"!==b)throw"Setting paranoia=0 will ruin your security; use it only for testing";this.O=a},addEntropy:function(a,b,c){c=c||"user";
var d,e,f=(new Date).valueOf(),g=this.J[c],h=this.isReady(),k=0;d=this.Y[c];void 0===d&&(d=this.Y[c]=this.na++);void 0===g&&(g=this.J[c]=0);this.J[c]=(this.J[c]+1)%this.h.length;switch(typeof a){case "number":void 0===b&&(b=1);this.h[g].update([d,this.P++,1,b,f,1,a|0]);break;case "object":c=Object.prototype.toString.call(a);if("[object Uint32Array]"===c){e=[];for(c=0;c<a.length;c++)e.push(a[c]);a=e}else for("[object Array]"!==c&&(k=1),c=0;c<a.length&&!k;c++)"number"!==typeof a[c]&&(k=1);if(!k){if(void 0===
b)for(c=b=0;c<a.length;c++)for(e=a[c];0<e;)b++,e=e>>>1;this.h[g].update([d,this.P++,2,b,f,a.length].concat(a))}break;case "string":void 0===b&&(b=a.length);this.h[g].update([d,this.P++,3,b,f,a.length]);this.h[g].update(a);break;default:k=1}if(k)throw new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string");this.u[g]+=b;this.j+=b;h===this.A&&(this.isReady()!==this.A&&A("seeded",Math.max(this.v,this.j)),A("progress",this.getProgress()))},isReady:function(a){a=this.V[void 0!==
a?a:this.O];return this.v&&this.v>=a?this.u[0]>this.ha&&(new Date).valueOf()>this.da?this.L|this.K:this.K:this.j>=a?this.L|this.A:this.A},getProgress:function(a){a=this.V[a?a:this.O];return this.v>=a?1:this.j>a?1:this.j/a},startCollectors:function(){if(!this.F){this.c={loadTimeCollector:B(this,this.pa),mouseCollector:B(this,this.ra),keyboardCollector:B(this,this.oa),accelerometerCollector:B(this,this.ka),touchCollector:B(this,this.sa)};if(window.addEventListener)window.addEventListener("load",this.c.loadTimeCollector,
!1),window.addEventListener("mousemove",this.c.mouseCollector,!1),window.addEventListener("keypress",this.c.keyboardCollector,!1),window.addEventListener("devicemotion",this.c.accelerometerCollector,!1),window.addEventListener("touchmove",this.c.touchCollector,!1);else if(document.attachEvent)document.attachEvent("onload",this.c.loadTimeCollector),document.attachEvent("onmousemove",this.c.mouseCollector),document.attachEvent("keypress",this.c.keyboardCollector);else throw new sjcl.exception.bug("can't attach event");
this.F=!0}},stopCollectors:function(){this.F&&(window.removeEventListener?(window.removeEventListener("load",this.c.loadTimeCollector,!1),window.removeEventListener("mousemove",this.c.mouseCollector,!1),window.removeEventListener("keypress",this.c.keyboardCollector,!1),window.removeEventListener("devicemotion",this.c.accelerometerCollector,!1),window.removeEventListener("touchmove",this.c.touchCollector,!1)):document.detachEvent&&(document.detachEvent("onload",this.c.loadTimeCollector),document.detachEvent("onmousemove",
this.c.mouseCollector),document.detachEvent("keypress",this.c.keyboardCollector)),this.F=!1)},addEventListener:function(a,b){this.M[a][this.ma++]=b},removeEventListener:function(a,b){var c,d,e=this.M[a],f=[];for(d in e)e.hasOwnProperty(d)&&e[d]===b&&f.push(d);for(c=0;c<f.length;c++)d=f[c],delete e[d]},oa:function(){C(this,1)},ra:function(a){var b,c;try{b=a.x||a.clientX||a.offsetX||0,c=a.y||a.clientY||a.offsetY||0}catch(d){c=b=0}0!=b&&0!=c&&this.addEntropy([b,c],2,"mouse");C(this,0)},sa:function(a){a=
a.touches[0]||a.changedTouches[0];this.addEntropy([a.pageX||a.clientX,a.pageY||a.clientY],1,"touch");C(this,0)},pa:function(){C(this,2)},ka:function(a){a=a.accelerationIncludingGravity.x||a.accelerationIncludingGravity.y||a.accelerationIncludingGravity.z;if(window.orientation){var b=window.orientation;"number"===typeof b&&this.addEntropy(b,1,"accelerometer")}a&&this.addEntropy(a,2,"accelerometer");C(this,0)}};
function A(a,b){var c,d=sjcl.random.M[a],e=[];for(c in d)d.hasOwnProperty(c)&&e.push(d[c]);for(c=0;c<e.length;c++)e[c](b)}function C(a,b){"undefined"!==typeof window&&window.performance&&"function"===typeof window.performance.now?a.addEntropy(window.performance.now(),b,"loadtime"):a.addEntropy((new Date).valueOf(),b,"loadtime")}function v(a){a.g=z(a).concat(z(a));a.N=new sjcl.cipher.aes(a.g)}function z(a){for(var b=0;4>b&&(a.l[b]=a.l[b]+1|0,!a.l[b]);b++);return a.N.encrypt(a.l)}
function B(a,b){return function(){b.apply(a,arguments)}}sjcl.random=new sjcl.prng(6);
a:try{var D,E,F,G;if(G="undefined"!==typeof module&&module.exports){var H;try{H=require("crypto")}catch(a){H=null}G=E=H}if(G&&E.randomBytes)D=E.randomBytes(128),D=new Uint32Array((new Uint8Array(D)).buffer),sjcl.random.addEntropy(D,1024,"crypto['randomBytes']");else if("undefined"!==typeof window&&"undefined"!==typeof Uint32Array){F=new Uint32Array(32);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(F);else if(window.msCrypto&&window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(F);
else break a;sjcl.random.addEntropy(F,1024,"crypto['getRandomValues']")}}catch(a){"undefined"!==typeof window&&window.console&&(console.log("There was an error collecting entropy from the browser:"),console.log(a))}sjcl.bn=function(a){this.initWith(a)};
sjcl.bn.prototype={radix:24,maxMul:8,f:sjcl.bn,copy:function(){return new this.f(this)},initWith:function(a){var b=0,c;switch(typeof a){case "object":this.limbs=a.limbs.slice(0);break;case "number":this.limbs=[a];this.normalize();break;case "string":a=a.replace(/^0x/,"");this.limbs=[];c=this.radix/4;for(b=0;b<a.length;b+=c)this.limbs.push(parseInt(a.substring(Math.max(a.length-b-c,0),a.length-b),16));break;default:this.limbs=[0]}return this},equals:function(a){"number"===typeof a&&(a=new this.f(a));
var b=0,c;this.fullReduce();a.fullReduce();for(c=0;c<this.limbs.length||c<a.limbs.length;c++)b|=this.getLimb(c)^a.getLimb(c);return 0===b},getLimb:function(a){return a>=this.limbs.length?0:this.limbs[a]},greaterEquals:function(a){"number"===typeof a&&(a=new this.f(a));var b=0,c=0,d,e,f;for(d=Math.max(this.limbs.length,a.limbs.length)-1;0<=d;d--)e=this.getLimb(d),f=a.getLimb(d),c|=f-e&~b,b|=e-f&~c;return(c|~b)>>>31},toString:function(){this.fullReduce();var a="",b,c,d=this.limbs;for(b=0;b<this.limbs.length;b++){for(c=
d[b].toString(16);b<this.limbs.length-1&&6>c.length;)c="0"+c;a=c+a}return"0x"+a},addM:function(a){"object"!==typeof a&&(a=new this.f(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]+=c[a];return this},doubleM:function(){var a,b=0,c,d=this.radix,e=this.radixMask,f=this.limbs;for(a=0;a<f.length;a++)c=f[a],c=c+c+b,f[a]=c&e,b=c>>d;b&&f.push(b);return this},halveM:function(){var a,b=0,c,d=this.radix,e=this.limbs;for(a=e.length-1;0<=a;a--)c=e[a],e[a]=c+b>>
1,b=(c&1)<<d;e[e.length-1]||e.pop();return this},subM:function(a){"object"!==typeof a&&(a=new this.f(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]-=c[a];return this},mod:function(a){var b=!this.greaterEquals(new sjcl.bn(0));a=(new sjcl.bn(a)).normalize();var c=(new sjcl.bn(this)).normalize(),d=0;for(b&&(c=(new sjcl.bn(0)).subM(c).normalize());c.greaterEquals(a);d++)a.doubleM();for(b&&(c=a.sub(c).normalize());0<d;d--)a.halveM(),c.greaterEquals(a)&&
c.subM(a).normalize();return c.trim()},inverseMod:function(a){var b=new sjcl.bn(1),c=new sjcl.bn(0),d=new sjcl.bn(this),e=new sjcl.bn(a),f,g=1;if(!(a.limbs[0]&1))throw new sjcl.exception.invalid("inverseMod: p must be odd");do for(d.limbs[0]&1&&(d.greaterEquals(e)||(f=d,d=e,e=f,f=b,b=c,c=f),d.subM(e),d.normalize(),b.greaterEquals(c)||b.addM(a),b.subM(c)),d.halveM(),b.limbs[0]&1&&b.addM(a),b.normalize(),b.halveM(),f=g=0;f<d.limbs.length;f++)g|=d.limbs[f];while(g);if(!e.equals(1))throw new sjcl.exception.invalid("inverseMod: p and x must be relatively prime");
return c},add:function(a){return this.copy().addM(a)},sub:function(a){return this.copy().subM(a)},mul:function(a){"number"===typeof a&&(a=new this.f(a));var b,c=this.limbs,d=a.limbs,e=c.length,f=d.length,g=new this.f,h=g.limbs,k,m=this.maxMul;for(b=0;b<this.limbs.length+a.limbs.length+1;b++)h[b]=0;for(b=0;b<e;b++){k=c[b];for(a=0;a<f;a++)h[b+a]+=k*d[a];--m||(m=this.maxMul,g.cnormalize())}return g.cnormalize().reduce()},square:function(){return this.mul(this)},power:function(a){a=(new sjcl.bn(a)).normalize().trim().limbs;
var b,c,d=new this.f(1),e=this;for(b=0;b<a.length;b++)for(c=0;c<this.radix;c++){a[b]&1<<c&&(d=d.mul(e));if(b==a.length-1&&0==a[b]>>c+1)break;e=e.square()}return d},mulmod:function(a,b){return this.mod(b).mul(a.mod(b)).mod(b)},powermod:function(a,b){a=new sjcl.bn(a);b=new sjcl.bn(b);if(1==(b.limbs[0]&1)){var c=this.montpowermod(a,b);if(0!=c)return c}for(var d,e=a.normalize().trim().limbs,f=new this.f(1),g=this,c=0;c<e.length;c++)for(d=0;d<this.radix;d++){e[c]&1<<d&&(f=f.mulmod(g,b));if(c==e.length-
1&&0==e[c]>>d+1)break;g=g.mulmod(g,b)}return f},montpowermod:function(a,b){function c(a,b){var c=b%a.radix;return(a.limbs[Math.floor(b/a.radix)]&1<<c)>>c}function d(a,c){var d,e,f=(1<<m+1)-1;d=a.mul(c);e=d.mul(r);e.limbs=e.limbs.slice(0,k.limbs.length);e.limbs.length==k.limbs.length&&(e.limbs[k.limbs.length-1]&=f);e=e.mul(b);e=d.add(e).normalize().trim();e.limbs=e.limbs.slice(k.limbs.length-1);for(d=0;d<e.limbs.length;d++)0<d&&(e.limbs[d-1]|=(e.limbs[d]&f)<<g-m-1),e.limbs[d]>>=m+1;e.greaterEquals(b)&&
e.subM(b);return e}a=(new sjcl.bn(a)).normalize().trim();b=new sjcl.bn(b);var e,f,g=this.radix,h=new this.f(1);e=this.copy();var k,m,n;n=a.bitLength();k=new sjcl.bn({limbs:b.copy().normalize().trim().limbs.map(function(){return 0})});for(m=this.radix;0<m;m--)if(1==(b.limbs[b.limbs.length-1]>>m&1)){k.limbs[k.limbs.length-1]=1<<m;break}if(0==n)return this;n=18>n?1:48>n?3:144>n?4:768>n?5:6;var l=k.copy(),p=b.copy();f=new sjcl.bn(1);for(var r=new sjcl.bn(0),q=k.copy();q.greaterEquals(1);)q.halveM(),0==
(f.limbs[0]&1)?(f.halveM(),r.halveM()):(f.addM(p),f.halveM(),r.halveM(),r.addM(l));f=f.normalize();r=r.normalize();l.doubleM();p=l.mulmod(l,b);if(!l.mul(f).sub(b.mul(r)).equals(1))return!1;e=d(e,p);h=d(h,p);l={};f=(1<<n-1)-1;l[1]=e.copy();l[2]=d(e,e);for(e=1;e<=f;e++)l[2*e+1]=d(l[2*e-1],l[2]);for(e=a.bitLength()-1;0<=e;)if(0==c(a,e))h=d(h,h),--e;else{for(p=e-n+1;0==c(a,p);)p++;q=0;for(f=p;f<=e;f++)q+=c(a,f)<<f-p,h=d(h,h);h=d(h,l[q]);e=p-1}return d(h,1)},trim:function(){var a=this.limbs,b;do b=a.pop();
while(a.length&&0===b);a.push(b);return this},reduce:function(){return this},fullReduce:function(){return this.normalize()},normalize:function(){var a=0,b,c=this.placeVal,d=this.ipv,e,f=this.limbs,g=f.length,h=this.radixMask;for(b=0;b<g||0!==a&&-1!==a;b++)a=(f[b]||0)+a,e=f[b]=a&h,a=(a-e)*d;-1===a&&(f[b-1]-=c);this.trim();return this},cnormalize:function(){var a=0,b,c=this.ipv,d,e=this.limbs,f=e.length,g=this.radixMask;for(b=0;b<f-1;b++)a=e[b]+a,d=e[b]=a&g,a=(a-d)*c;e[b]+=a;return this},toBits:function(a){this.fullReduce();
a=a||this.exponent||this.bitLength();var b=Math.floor((a-1)/24),c=sjcl.bitArray,d=[c.partial((a+7&-8)%this.radix||this.radix,this.getLimb(b))];for(b--;0<=b;b--)d=c.concat(d,[c.partial(Math.min(this.radix,a),this.getLimb(b))]),a-=this.radix;return d},bitLength:function(){this.fullReduce();for(var a=this.radix*(this.limbs.length-1),b=this.limbs[this.limbs.length-1];b;b>>>=1)a++;return a+7&-8}};
sjcl.bn.fromBits=function(a){var b=new this,c=[],d=sjcl.bitArray,e=this.prototype,f=Math.min(this.bitLength||0x100000000,d.bitLength(a)),g=f%e.radix||e.radix;for(c[0]=d.extract(a,0,g);g<f;g+=e.radix)c.unshift(d.extract(a,g,e.radix));b.limbs=c;return b};sjcl.bn.prototype.ipv=1/(sjcl.bn.prototype.placeVal=Math.pow(2,sjcl.bn.prototype.radix));sjcl.bn.prototype.radixMask=(1<<sjcl.bn.prototype.radix)-1;
sjcl.bn.pseudoMersennePrime=function(a,b){function c(a){this.initWith(a)}var d=c.prototype=new sjcl.bn,e,f;e=d.modOffset=Math.ceil(f=a/d.radix);d.exponent=a;d.offset=[];d.factor=[];d.minOffset=e;d.fullMask=0;d.fullOffset=[];d.fullFactor=[];d.modulus=c.modulus=new sjcl.bn(Math.pow(2,a));d.fullMask=0|-Math.pow(2,a%d.radix);for(e=0;e<b.length;e++)d.offset[e]=Math.floor(b[e][0]/d.radix-f),d.fullOffset[e]=Math.ceil(b[e][0]/d.radix-f),d.factor[e]=b[e][1]*Math.pow(.5,a-b[e][0]+d.offset[e]*d.radix),d.fullFactor[e]=
b[e][1]*Math.pow(.5,a-b[e][0]+d.fullOffset[e]*d.radix),d.modulus.addM(new sjcl.bn(Math.pow(2,b[e][0])*b[e][1])),d.minOffset=Math.min(d.minOffset,-d.offset[e]);d.f=c;d.modulus.cnormalize();d.reduce=function(){var a,b,c,d=this.modOffset,e=this.limbs,f=this.offset,p=this.offset.length,r=this.factor,q;for(a=this.minOffset;e.length>d;){c=e.pop();q=e.length;for(b=0;b<p;b++)e[q+f[b]]-=r[b]*c;a--;a||(e.push(0),this.cnormalize(),a=this.minOffset)}this.cnormalize();return this};d.fa=-1===d.fullMask?d.reduce:
function(){var a=this.limbs,b=a.length-1,c,d;this.reduce();if(b===this.modOffset-1){d=a[b]&this.fullMask;a[b]-=d;for(c=0;c<this.fullOffset.length;c++)a[b+this.fullOffset[c]]-=this.fullFactor[c]*d;this.normalize()}};d.fullReduce=function(){var a,b;this.fa();this.addM(this.modulus);this.addM(this.modulus);this.normalize();this.fa();for(b=this.limbs.length;b<this.modOffset;b++)this.limbs[b]=0;a=this.greaterEquals(this.modulus);for(b=0;b<this.limbs.length;b++)this.limbs[b]-=this.modulus.limbs[b]*a;this.cnormalize();
return this};d.inverse=function(){return this.power(this.modulus.sub(2))};c.fromBits=sjcl.bn.fromBits;return c};var I=sjcl.bn.pseudoMersennePrime;
sjcl.bn.prime={p127:I(127,[[0,-1]]),p25519:I(255,[[0,-19]]),p192k:I(192,[[32,-1],[12,-1],[8,-1],[7,-1],[6,-1],[3,-1],[0,-1]]),p224k:I(224,[[32,-1],[12,-1],[11,-1],[9,-1],[7,-1],[4,-1],[1,-1],[0,-1]]),p256k:I(0x100,[[32,-1],[9,-1],[8,-1],[7,-1],[6,-1],[4,-1],[0,-1]]),p192:I(192,[[0,-1],[64,-1]]),p224:I(224,[[0,1],[96,-1]]),p256:I(0x100,[[0,-1],[96,1],[192,1],[224,-1]]),p384:I(384,[[0,-1],[32,1],[96,-1],[128,-1]]),p521:I(521,[[0,-1]])};
sjcl.bn.random=function(a,b){"object"!==typeof a&&(a=new sjcl.bn(a));for(var c,d,e=a.limbs.length,f=a.limbs[e-1]+1,g=new sjcl.bn;;){do c=sjcl.random.randomWords(e,b),0>c[e-1]&&(c[e-1]+=0x100000000);while(Math.floor(c[e-1]/f)===Math.floor(0x100000000/f));c[e-1]%=f;for(d=0;d<e-1;d++)c[d]&=a.radixMask;g.limbs=c;if(!g.greaterEquals(a))return g}};sjcl.ecc={};
sjcl.ecc.point=function(a,b,c){void 0===b?this.isIdentity=!0:(b instanceof sjcl.bn&&(b=new a.field(b)),c instanceof sjcl.bn&&(c=new a.field(c)),this.x=b,this.y=c,this.isIdentity=!1);this.curve=a};
sjcl.ecc.point.prototype={toJac:function(){return new sjcl.ecc.pointJac(this.curve,this.x,this.y,new this.curve.field(1))},mult:function(a){return this.toJac().mult(a,this).toAffine()},mult2:function(a,b,c){return this.toJac().mult2(a,this,b,c).toAffine()},multiples:function(){var a,b,c;if(void 0===this.ca)for(c=this.toJac().doubl(),a=this.ca=[new sjcl.ecc.point(this.curve),this,c.toAffine()],b=3;16>b;b++)c=c.add(this),a.push(c.toAffine());return this.ca},negate:function(){var a=(new this.curve.field(0)).sub(this.y).normalize().reduce();
return new sjcl.ecc.point(this.curve,this.x,a)},isValid:function(){return this.y.square().equals(this.curve.b.add(this.x.mul(this.curve.a.add(this.x.square()))))},toBits:function(){return sjcl.bitArray.concat(this.x.toBits(),this.y.toBits())}};sjcl.ecc.pointJac=function(a,b,c,d){void 0===b?this.isIdentity=!0:(this.x=b,this.y=c,this.z=d,this.isIdentity=!1);this.curve=a};
sjcl.ecc.pointJac.prototype={add:function(a){var b,c,d,e;if(this.curve!==a.curve)throw"sjcl['ecc']['add'](): Points must be on the same curve to add them!";if(this.isIdentity)return a.toJac();if(a.isIdentity)return this;b=this.z.square();c=a.x.mul(b).subM(this.x);if(c.equals(0))return this.y.equals(a.y.mul(b.mul(this.z)))?this.doubl():new sjcl.ecc.pointJac(this.curve);b=a.y.mul(b.mul(this.z)).subM(this.y);d=c.square();a=b.square();e=c.square().mul(c).addM(this.x.add(this.x).mul(d));a=a.subM(e);b=
this.x.mul(d).subM(a).mul(b);d=this.y.mul(c.square().mul(c));b=b.subM(d);c=this.z.mul(c);return new sjcl.ecc.pointJac(this.curve,a,b,c)},doubl:function(){if(this.isIdentity)return this;var a=this.y.square(),b=a.mul(this.x.mul(4)),c=a.square().mul(8),a=this.z.square(),d=this.curve.a.toString()==(new sjcl.bn(-3)).toString()?this.x.sub(a).mul(3).mul(this.x.add(a)):this.x.square().mul(3).add(a.square().mul(this.curve.a)),a=d.square().subM(b).subM(b),b=b.sub(a).mul(d).subM(c),c=this.y.add(this.y).mul(this.z);
return new sjcl.ecc.pointJac(this.curve,a,b,c)},toAffine:function(){if(this.isIdentity||this.z.equals(0))return new sjcl.ecc.point(this.curve);var a=this.z.inverse(),b=a.square();return new sjcl.ecc.point(this.curve,this.x.mul(b).fullReduce(),this.y.mul(b.mul(a)).fullReduce())},mult:function(a,b){"number"===typeof a?a=[a]:void 0!==a.limbs&&(a=a.normalize().limbs);var c,d,e=(new sjcl.ecc.point(this.curve)).toJac(),f=b.multiples();for(c=a.length-1;0<=c;c--)for(d=sjcl.bn.prototype.radix-4;0<=d;d-=4)e=
e.doubl().doubl().doubl().doubl().add(f[a[c]>>d&15]);return e},mult2:function(a,b,c,d){"number"===typeof a?a=[a]:void 0!==a.limbs&&(a=a.normalize().limbs);"number"===typeof c?c=[c]:void 0!==c.limbs&&(c=c.normalize().limbs);var e,f=(new sjcl.ecc.point(this.curve)).toJac();b=b.multiples();var g=d.multiples(),h,k;for(d=Math.max(a.length,c.length)-1;0<=d;d--)for(h=a[d]|0,k=c[d]|0,e=sjcl.bn.prototype.radix-4;0<=e;e-=4)f=f.doubl().doubl().doubl().doubl().add(b[h>>e&15]).add(g[k>>e&15]);return f},negate:function(){return this.toAffine().negate().toJac()},
isValid:function(){var a=this.z.square(),b=a.square(),a=b.mul(a);return this.y.square().equals(this.curve.b.mul(a).add(this.x.mul(this.curve.a.mul(b).add(this.x.square()))))}};sjcl.ecc.curve=function(a,b,c,d,e,f){this.field=a;this.r=new sjcl.bn(b);this.a=new a(c);this.b=new a(d);this.G=new sjcl.ecc.point(this,new a(e),new a(f))};
sjcl.ecc.curve.prototype.fromBits=function(a){var b=sjcl.bitArray,c=this.field.prototype.exponent+7&-8;a=new sjcl.ecc.point(this,this.field.fromBits(b.bitSlice(a,0,c)),this.field.fromBits(b.bitSlice(a,c,2*c)));if(!a.isValid())throw new sjcl.exception.corrupt("not on the curve!");return a};
sjcl.ecc.curves={c192:new sjcl.ecc.curve(sjcl.bn.prime.p192,"0xffffffffffffffffffffffff99def836146bc9b1b4d22831",-3,"0x64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1","0x188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012","0x07192b95ffc8da78631011ed6b24cdd573f977a11e794811"),c224:new sjcl.ecc.curve(sjcl.bn.prime.p224,"0xffffffffffffffffffffffffffff16a2e0b8f03e13dd29455c5c2a3d",-3,"0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4","0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21",
"0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34"),c256:new sjcl.ecc.curve(sjcl.bn.prime.p256,"0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",-3,"0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b","0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296","0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),c384:new sjcl.ecc.curve(sjcl.bn.prime.p384,"0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973",
-3,"0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef","0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7","0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"),c521:new sjcl.ecc.curve(sjcl.bn.prime.p521,"0x1FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFA51868783BF2F966B7FCC0148F709A5D03BB5C9B8899C47AEBB6FB71E91386409",-3,"0x051953EB9618E1C9A1F929A21A0B68540EEA2DA725B99B315F3B8B489918EF109E156193951EC7E937B1652C0BD3BB1BF073573DF883D2C34F1EF451FD46B503F00",
"0xC6858E06B70404E9CD9E3ECB662395B4429C648139053FB521F828AF606B4D3DBAA14B5E77EFE75928FE1DC127A2FFA8DE3348B3C1856A429BF97E7E31C2E5BD66","0x11839296A789A3BC0045C8A5FB42C7D1BD998F54449579B446817AFBD17273E662C97EE72995EF42640C550B9013FAD0761353C7086A272C24088BE94769FD16650"),k192:new sjcl.ecc.curve(sjcl.bn.prime.p192k,"0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d",0,3,"0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d","0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d"),k224:new sjcl.ecc.curve(sjcl.bn.prime.p224k,
"0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7",0,5,"0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c","0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5"),k256:new sjcl.ecc.curve(sjcl.bn.prime.p256k,"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",0,7,"0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")};
sjcl.ecc.curveName=function(a){for(var b in sjcl.ecc.curves)if(sjcl.ecc.curves.hasOwnProperty(b)&&sjcl.ecc.curves[b]===a)return b;throw new sjcl.exception.invalid("no such curve");};
sjcl.ecc.deserialize=function(a){if(!a||!a.curve||!sjcl.ecc.curves[a.curve])throw new sjcl.exception.invalid("invalid serialization");if(-1===["elGamal","ecdsa"].indexOf(a.type))throw new sjcl.exception.invalid("invalid type");var b=sjcl.ecc.curves[a.curve];if(a.secretKey){if(!a.exponent)throw new sjcl.exception.invalid("invalid exponent");var c=new sjcl.bn(a.exponent);return new sjcl.ecc[a.type].secretKey(b,c)}if(!a.point)throw new sjcl.exception.invalid("invalid point");c=b.fromBits(sjcl.codec.hex.toBits(a.point));
return new sjcl.ecc[a.type].publicKey(b,c)};
sjcl.ecc.basicKey={publicKey:function(a,b){this.i=a;this.o=a.r.bitLength();b instanceof Array?this.m=a.fromBits(b):this.m=b;this.serialize=function(){var b=sjcl.ecc.curveName(a);return{type:this.getType(),secretKey:!1,point:sjcl.codec.hex.fromBits(this.m.toBits()),curve:b}};this.get=function(){var a=this.m.toBits(),b=sjcl.bitArray.bitLength(a),e=sjcl.bitArray.bitSlice(a,0,b/2),a=sjcl.bitArray.bitSlice(a,b/2);return{x:e,y:a}}},secretKey:function(a,b){this.i=a;this.o=a.r.bitLength();this.D=b;this.serialize=
function(){var b=this.get(),d=sjcl.ecc.curveName(a);return{type:this.getType(),secretKey:!0,exponent:sjcl.codec.hex.fromBits(b),curve:d}};this.get=function(){return this.D.toBits()}}};sjcl.ecc.basicKey.generateKeys=function(a){return function(b,c,d){b=b||0x100;if("number"===typeof b&&(b=sjcl.ecc.curves["c"+b],void 0===b))throw new sjcl.exception.invalid("no such curve");d=d||sjcl.bn.random(b.r,c);c=b.G.mult(d);return{pub:new sjcl.ecc[a].publicKey(b,c),sec:new sjcl.ecc[a].secretKey(b,d)}}};
sjcl.ecc.elGamal={generateKeys:sjcl.ecc.basicKey.generateKeys("elGamal"),publicKey:function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)},secretKey:function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)}};sjcl.ecc.elGamal.publicKey.prototype={kem:function(a){a=sjcl.bn.random(this.i.r,a);var b=this.i.G.mult(a).toBits();return{key:sjcl.hash.sha256.hash(this.m.mult(a).toBits()),tag:b}},getType:function(){return"elGamal"}};
sjcl.ecc.elGamal.secretKey.prototype={unkem:function(a){return sjcl.hash.sha256.hash(this.i.fromBits(a).mult(this.D).toBits())},dh:function(a){return sjcl.hash.sha256.hash(a.m.mult(this.D).toBits())},dhJavaEc:function(a){return a.m.mult(this.D).x.toBits()},getType:function(){return"elGamal"}};sjcl.ecc.ecdsa={generateKeys:sjcl.ecc.basicKey.generateKeys("ecdsa")};sjcl.ecc.ecdsa.publicKey=function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)};
sjcl.ecc.ecdsa.publicKey.prototype={verify:function(a,b,c){sjcl.bitArray.bitLength(a)>this.o&&(a=sjcl.bitArray.clamp(a,this.o));var d=sjcl.bitArray,e=this.i.r,f=this.o,g=sjcl.bn.fromBits(d.bitSlice(b,0,f)),d=sjcl.bn.fromBits(d.bitSlice(b,f,2*f)),h=c?d:d.inverseMod(e),f=sjcl.bn.fromBits(a).mul(h).mod(e),h=g.mul(h).mod(e),f=this.i.G.mult2(f,h,this.m).x;if(g.equals(0)||d.equals(0)||g.greaterEquals(e)||d.greaterEquals(e)||!f.equals(g)){if(void 0===c)return this.verify(a,b,!0);throw new sjcl.exception.corrupt("signature didn't check out");
}return!0},getType:function(){return"ecdsa"}};sjcl.ecc.ecdsa.secretKey=function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)};
sjcl.ecc.ecdsa.secretKey.prototype={sign:function(a,b,c,d){sjcl.bitArray.bitLength(a)>this.o&&(a=sjcl.bitArray.clamp(a,this.o));var e=this.i.r,f=e.bitLength();d=d||sjcl.bn.random(e.sub(1),b).add(1);b=this.i.G.mult(d).x.mod(e);a=sjcl.bn.fromBits(a).add(b.mul(this.D));c=c?a.inverseMod(e).mul(d).mod(e):a.mul(d.inverseMod(e)).mod(e);return sjcl.bitArray.concat(b.toBits(f),c.toBits(f))},getType:function(){return"ecdsa"}};

return sjcl; }

})();
