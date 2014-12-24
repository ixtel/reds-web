(function(){
"use strict";

// NOTE The sjcl-1 implementation uses the following configuration
//      keylength: 256bit
//      cipher: AES128-CCM
//      hash: SHA256
//      shash: PBKDF2-HMAC-SHA256
//      curve: SECP256K1-1

var sjcl = loadSjcl();

var cache = new Object();

var Sjcl = function() {
    // NOTE Nothing to here (but maybe in other facilities)
}

Sjcl.prototype.name = "sjcl-1";

Sjcl.prototype.generateTimestamp = function() {
    var now = Date.now();
    var low = now&0xffffffff;
    var high = Math.floor(now/0xffffffff);
    var timeBytes = [high, low];
    var saltBytes = sjcl.random.randomWords(6, 10);
    return sjcl.codec.base64.fromBits(timeBytes.concat(saltBytes));
}

Sjcl.prototype.compareTimestamps = function(a, b) {
    var timeA = sjcl.codec.base64.toBits(a);
    var timeB = sjcl.codec.base64.toBits(b);
    var nowA = timeA[0]*0x100000000 + timeA[1];
    var nowB = timeB[0]*0x100000000 + timeB[1];
    return nowA - nowB;
}

// TODO Check if \n exists in arguments
Sjcl.prototype.concatenateStrings = function() {
    var values = Array.prototype.slice.apply(arguments);
    return values.join("\n");
}

Sjcl.prototype.generateSecureHash = function(data, salt, fresh) {
    var index = sjcl.hash.sha256.hash(this.concatenateStrings(data, salt));
    if (!fresh && cache[index])
        return cache[index];
    //console.warn("TODO Increase pbkdf2 iterations to 128000 before release.");
    var hashBits = sjcl.misc.pbkdf2(data, salt, 128000, 256);
    cache[index] = sjcl.codec.base64.fromBits(hashBits);
    return cache[index];
}

Sjcl.prototype.generateKey = function() {
    var keyBits = sjcl.random.randomWords(8, 10);
    return sjcl.codec.base64.fromBits(keyBits);
}

Sjcl.prototype.generateKeypair = function() {
    var privateBn = sjcl.bn.random(sjcl.ecc.curves.k256.r, 10);
    var publicBn = sjcl.ecc.curves.k256.G.mult(privateBn);
    return {
        'privateKey': sjcl.codec.base64.fromBits(privateBn.toBits()),
        'publicKey': sjcl.codec.base64.fromBits(publicBn.toBits())
    }
}

Sjcl.prototype.combineKeypair = function(privateKey, publicKey, padKey) {
    var privateBits = sjcl.codec.base64.toBits(privateKey);
    var publicBits = sjcl.codec.base64.toBits(publicKey);
    var privateBn = sjcl.bn.fromBits(privateBits);
    var publicBn = sjcl.ecc.curves.k256.fromBits(publicBits);
    var sharedBn = publicBn.mult(privateBn);
    var keyBits = sjcl.hash.sha256.hash(sharedBn.toBits());
    if (padKey) {
        var padBits = sjcl.codec.base64.toBits(padKey);
        keyBits[0] = keyBits[0]^padBits[0];
        keyBits[1] = keyBits[1]^padBits[1];
        keyBits[2] = keyBits[2]^padBits[2];
        keyBits[3] = keyBits[3]^padBits[3];
        keyBits[4] = keyBits[4]^padBits[4];
        keyBits[5] = keyBits[5]^padBits[5];
        keyBits[6] = keyBits[6]^padBits[6];
        keyBits[7] = keyBits[7]^padBits[7];
    }
    return sjcl.codec.base64.fromBits(keyBits);
}

Sjcl.prototype.generateHmac = function(data, key) {
    var keyBits = sjcl.codec.base64.toBits(key);
    var sha256Hmac = new sjcl.misc.hmac(keyBits, sjcl.hash.sha256);
    var hmacBits = sha256Hmac.encrypt(data);
    return sjcl.codec.base64.fromBits(hmacBits);
}

Sjcl.prototype.encryptData = function(data, key, vector) {
    // TODO Is one iteration enough to generate a decent key?
    //      Can/Shall we use just a SHA256 HMAC instead?
    var derivedBits = sjcl.misc.pbkdf2(key, vector, 1, 256);
    var keyBits = derivedBits.slice(0, 4);
    var ivBits = derivedBits.slice(4, 8);
    var dataBits = sjcl.codec.utf8String.toBits(data);
    var aes128Cipher = new sjcl.cipher.aes(keyBits);
    var cdataBits = sjcl.mode.ccm.encrypt(aes128Cipher, dataBits, ivBits);
    return sjcl.codec.base64.fromBits(cdataBits);
}

Sjcl.prototype.decryptData = function(cdata, key, vector) {
    // TODO Is one iteration enough to generate a decent key?
    //      Can/Shall we use just a SHA256 HMAC instead?
    var derivedBits = sjcl.misc.pbkdf2(key, vector, 1, 256);
    var keyBits = derivedBits.slice(0, 4);
    var ivBits = derivedBits.slice(4, 8);
    var cdataBits = sjcl.codec.base64.toBits(cdata);
    var aes128Cipher = new sjcl.cipher.aes(keyBits);
    var dataBits = sjcl.mode.ccm.decrypt(aes128Cipher, cdataBits, ivBits);
    return sjcl.codec.utf8String.fromBits(dataBits);
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


"use strict";function p(a){throw a;}var q=void 0,s=!0,u=!1;var sjcl={cipher:{},hash:{},keyexchange:{},mode:{},misc:{},codec:{},exception:{corrupt:function(a){this.toString=function(){return"CORRUPT: "+this.message};this.message=a},invalid:function(a){this.toString=function(){return"INVALID: "+this.message};this.message=a},bug:function(a){this.toString=function(){return"BUG: "+this.message};this.message=a},notReady:function(a){this.toString=function(){return"NOT READY: "+this.message};this.message=a}}};
"undefined"!==typeof module&&module.exports&&(module.exports=sjcl);"function"===typeof define&&define([],function(){return sjcl});
sjcl.cipher.aes=function(a){this.n[0][0][0]||this.I();var b,c,d,e,f=this.n[0][4],g=this.n[1];b=a.length;var h=1;4!==b&&(6!==b&&8!==b)&&p(new sjcl.exception.invalid("invalid aes key size"));this.d=[d=a.slice(0),e=[]];for(a=b;a<4*b+28;a++){c=d[a-1];if(0===a%b||8===b&&4===a%b)c=f[c>>>24]<<24^f[c>>16&255]<<16^f[c>>8&255]<<8^f[c&255],0===a%b&&(c=c<<8^c>>>24^h<<24,h=h<<1^283*(h>>7));d[a]=d[a-b]^c}for(b=0;a;b++,a--)c=d[b&3?a:a-4],e[b]=4>=a||4>b?c:g[0][f[c>>>24]]^g[1][f[c>>16&255]]^g[2][f[c>>8&255]]^g[3][f[c&
255]]};
sjcl.cipher.aes.prototype={encrypt:function(a){return x(this,a,0)},decrypt:function(a){return x(this,a,1)},n:[[[],[],[],[],[]],[[],[],[],[],[]]],I:function(){var a=this.n[0],b=this.n[1],c=a[4],d=b[4],e,f,g,h=[],k=[],l,r,n,m;for(e=0;0x100>e;e++)k[(h[e]=e<<1^283*(e>>7))^e]=e;for(f=g=0;!c[f];f^=l||1,g=k[g]||1){n=g^g<<1^g<<2^g<<3^g<<4;n=n>>8^n&255^99;c[f]=n;d[n]=f;r=h[e=h[l=h[f]]];m=0x1010101*r^0x10001*e^0x101*l^0x1010100*f;r=0x101*h[n]^0x1010100*n;for(e=0;4>e;e++)a[e][f]=r=r<<24^r>>>8,b[e][n]=m=m<<24^m>>>8}for(e=
0;5>e;e++)a[e]=a[e].slice(0),b[e]=b[e].slice(0)}};
function x(a,b,c){4!==b.length&&p(new sjcl.exception.invalid("invalid aes block size"));var d=a.d[c],e=b[0]^d[0],f=b[c?3:1]^d[1],g=b[2]^d[2];b=b[c?1:3]^d[3];var h,k,l,r=d.length/4-2,n,m=4,v=[0,0,0,0];h=a.n[c];a=h[0];var t=h[1],w=h[2],A=h[3],B=h[4];for(n=0;n<r;n++)h=a[e>>>24]^t[f>>16&255]^w[g>>8&255]^A[b&255]^d[m],k=a[f>>>24]^t[g>>16&255]^w[b>>8&255]^A[e&255]^d[m+1],l=a[g>>>24]^t[b>>16&255]^w[e>>8&255]^A[f&255]^d[m+2],b=a[b>>>24]^t[e>>16&255]^w[f>>8&255]^A[g&255]^d[m+3],m+=4,e=h,f=k,g=l;for(n=0;4>
n;n++)v[c?3&-n:n]=B[e>>>24]<<24^B[f>>16&255]<<16^B[g>>8&255]<<8^B[b&255]^d[m++],h=e,e=f,f=g,g=b,b=h;return v}
sjcl.bitArray={bitSlice:function(a,b,c){a=sjcl.bitArray.U(a.slice(b/32),32-(b&31)).slice(1);return c===q?a:sjcl.bitArray.clamp(a,c-b)},extract:function(a,b,c){var d=Math.floor(-b-c&31);return((b+c-1^b)&-32?a[b/32|0]<<32-d^a[b/32+1|0]>>>d:a[b/32|0]>>>d)&(1<<c)-1},concat:function(a,b){if(0===a.length||0===b.length)return a.concat(b);var c=a[a.length-1],d=sjcl.bitArray.getPartial(c);return 32===d?a.concat(b):sjcl.bitArray.U(b,d,c|0,a.slice(0,a.length-1))},bitLength:function(a){var b=a.length;return 0===
b?0:32*(b-1)+sjcl.bitArray.getPartial(a[b-1])},clamp:function(a,b){if(32*a.length<b)return a;a=a.slice(0,Math.ceil(b/32));var c=a.length;b&=31;0<c&&b&&(a[c-1]=sjcl.bitArray.partial(b,a[c-1]&2147483648>>b-1,1));return a},partial:function(a,b,c){return 32===a?b:(c?b|0:b<<32-a)+0x10000000000*a},getPartial:function(a){return Math.round(a/0x10000000000)||32},equal:function(a,b){if(sjcl.bitArray.bitLength(a)!==sjcl.bitArray.bitLength(b))return u;var c=0,d;for(d=0;d<a.length;d++)c|=a[d]^b[d];return 0===
c},U:function(a,b,c,d){var e;e=0;for(d===q&&(d=[]);32<=b;b-=32)d.push(c),c=0;if(0===b)return d.concat(a);for(e=0;e<a.length;e++)d.push(c|a[e]>>>b),c=a[e]<<32-b;e=a.length?a[a.length-1]:0;a=sjcl.bitArray.getPartial(e);d.push(sjcl.bitArray.partial(b+a&31,32<b+a?c:d.pop(),1));return d},X:function(a,b){return[a[0]^b[0],a[1]^b[1],a[2]^b[2],a[3]^b[3]]},byteswapM:function(a){var b,c;for(b=0;b<a.length;++b)c=a[b],a[b]=c>>>24|c>>>8&0xff00|(c&0xff00)<<8|c<<24;return a}};
sjcl.codec.utf8String={fromBits:function(a){var b="",c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b+=String.fromCharCode(e>>>24),e<<=8;return decodeURIComponent(escape(b))},toBits:function(a){a=unescape(encodeURIComponent(a));var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a.charCodeAt(c),3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};
sjcl.codec.base64={M:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",fromBits:function(a,b,c){var d="",e=0,f=sjcl.codec.base64.M,g=0,h=sjcl.bitArray.bitLength(a);c&&(f=f.substr(0,62)+"-_");for(c=0;6*d.length<h;)d+=f.charAt((g^a[c]>>>e)>>>26),6>e?(g=a[c]<<6-e,e+=26,c++):(g<<=6,e-=6);for(;d.length&3&&!b;)d+="=";return d},toBits:function(a,b){a=a.replace(/\s|=/g,"");var c=[],d,e=0,f=sjcl.codec.base64.M,g=0,h;b&&(f=f.substr(0,62)+"-_");for(d=0;d<a.length;d++)h=f.indexOf(a.charAt(d)),
0>h&&p(new sjcl.exception.invalid("this isn't base64!")),26<e?(e-=26,c.push(g^h>>>e),g=h<<32-e):(e+=6,g^=h<<32-e);e&56&&c.push(sjcl.bitArray.partial(e&56,g,1));return c}};sjcl.codec.base64url={fromBits:function(a){return sjcl.codec.base64.fromBits(a,1,1)},toBits:function(a){return sjcl.codec.base64.toBits(a,1)}};
sjcl.codec.bytes={fromBits:function(a){var b=[],c=sjcl.bitArray.bitLength(a),d,e;for(d=0;d<c/8;d++)0===(d&3)&&(e=a[d/4]),b.push(e>>>24),e<<=8;return b},toBits:function(a){var b=[],c,d=0;for(c=0;c<a.length;c++)d=d<<8|a[c],3===(c&3)&&(b.push(d),d=0);c&3&&b.push(sjcl.bitArray.partial(8*(c&3),d));return b}};sjcl.hash.sha256=function(a){this.d[0]||this.I();a?(this.v=a.v.slice(0),this.q=a.q.slice(0),this.k=a.k):this.reset()};sjcl.hash.sha256.hash=function(a){return(new sjcl.hash.sha256).update(a).finalize()};
sjcl.hash.sha256.prototype={blockSize:512,reset:function(){this.v=this.R.slice(0);this.q=[];this.k=0;return this},update:function(a){"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));var b,c=this.q=sjcl.bitArray.concat(this.q,a);b=this.k;a=this.k=b+sjcl.bitArray.bitLength(a);for(b=512+b&-512;b<=a;b+=512)y(this,c.splice(0,16));return this},finalize:function(){var a,b=this.q,c=this.v,b=sjcl.bitArray.concat(b,[sjcl.bitArray.partial(1,1)]);for(a=b.length+2;a&15;a++)b.push(0);b.push(Math.floor(this.k/
4294967296));for(b.push(this.k|0);b.length;)y(this,b.splice(0,16));this.reset();return c},R:[],d:[],I:function(){function a(a){return 0x100000000*(a-Math.floor(a))|0}var b=0,c=2,d;a:for(;64>b;c++){for(d=2;d*d<=c;d++)if(0===c%d)continue a;8>b&&(this.R[b]=a(Math.pow(c,0.5)));this.d[b]=a(Math.pow(c,1/3));b++}}};
function y(a,b){var c,d,e,f=b.slice(0),g=a.v,h=a.d,k=g[0],l=g[1],r=g[2],n=g[3],m=g[4],v=g[5],t=g[6],w=g[7];for(c=0;64>c;c++)16>c?d=f[c]:(d=f[c+1&15],e=f[c+14&15],d=f[c&15]=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+f[c&15]+f[c+9&15]|0),d=d+w+(m>>>6^m>>>11^m>>>25^m<<26^m<<21^m<<7)+(t^m&(v^t))+h[c],w=t,t=v,v=m,m=n+d|0,n=r,r=l,l=k,k=d+(l&r^n&(l^r))+(l>>>2^l>>>13^l>>>22^l<<30^l<<19^l<<10)|0;g[0]=g[0]+k|0;g[1]=g[1]+l|0;g[2]=g[2]+r|0;g[3]=g[3]+n|0;g[4]=g[4]+m|0;g[5]=g[5]+v|0;g[6]=
g[6]+t|0;g[7]=g[7]+w|0}
sjcl.mode.ccm={name:"ccm",encrypt:function(a,b,c,d,e){var f,g=b.slice(0),h=sjcl.bitArray,k=h.bitLength(c)/8,l=h.bitLength(g)/8;e=e||64;d=d||[];7>k&&p(new sjcl.exception.invalid("ccm: iv must be at least 7 bytes"));for(f=2;4>f&&l>>>8*f;f++);f<15-k&&(f=15-k);c=h.clamp(c,8*(15-f));b=sjcl.mode.ccm.O(a,b,c,d,e,f);g=sjcl.mode.ccm.P(a,g,c,b,e,f);return h.concat(g.data,g.tag)},decrypt:function(a,b,c,d,e){e=e||64;d=d||[];var f=sjcl.bitArray,g=f.bitLength(c)/8,h=f.bitLength(b),k=f.clamp(b,h-e),l=f.bitSlice(b,
h-e),h=(h-e)/8;7>g&&p(new sjcl.exception.invalid("ccm: iv must be at least 7 bytes"));for(b=2;4>b&&h>>>8*b;b++);b<15-g&&(b=15-g);c=f.clamp(c,8*(15-b));k=sjcl.mode.ccm.P(a,k,c,l,e,b);a=sjcl.mode.ccm.O(a,k.data,c,d,e,b);f.equal(k.tag,a)||p(new sjcl.exception.corrupt("ccm: tag doesn't match"));return k.data},O:function(a,b,c,d,e,f){var g=[],h=sjcl.bitArray,k=h.X;e/=8;(e%2||4>e||16<e)&&p(new sjcl.exception.invalid("ccm: invalid tag length"));(0xffffffff<d.length||0xffffffff<b.length)&&p(new sjcl.exception.bug("ccm: can't deal with 4GiB or more data"));
f=[h.partial(8,(d.length?64:0)|e-2<<2|f-1)];f=h.concat(f,c);f[3]|=h.bitLength(b)/8;f=a.encrypt(f);if(d.length){c=h.bitLength(d)/8;65279>=c?g=[h.partial(16,c)]:0xffffffff>=c&&(g=h.concat([h.partial(16,65534)],[c]));g=h.concat(g,d);for(d=0;d<g.length;d+=4)f=a.encrypt(k(f,g.slice(d,d+4).concat([0,0,0])))}for(d=0;d<b.length;d+=4)f=a.encrypt(k(f,b.slice(d,d+4).concat([0,0,0])));return h.clamp(f,8*e)},P:function(a,b,c,d,e,f){var g,h=sjcl.bitArray;g=h.X;var k=b.length,l=h.bitLength(b);c=h.concat([h.partial(8,
f-1)],c).concat([0,0,0]).slice(0,4);d=h.bitSlice(g(d,a.encrypt(c)),0,e);if(!k)return{tag:d,data:[]};for(g=0;g<k;g+=4)c[3]++,e=a.encrypt(c),b[g]^=e[0],b[g+1]^=e[1],b[g+2]^=e[2],b[g+3]^=e[3];return{tag:d,data:h.clamp(b,l)}}};sjcl.misc.hmac=function(a,b){this.Q=b=b||sjcl.hash.sha256;var c=[[],[]],d,e=b.prototype.blockSize/32;this.p=[new b,new b];a.length>e&&(a=b.hash(a));for(d=0;d<e;d++)c[0][d]=a[d]^909522486,c[1][d]=a[d]^1549556828;this.p[0].update(c[0]);this.p[1].update(c[1]);this.K=new b(this.p[0])};
sjcl.misc.hmac.prototype.encrypt=sjcl.misc.hmac.prototype.mac=function(a){this.W&&p(new sjcl.exception.invalid("encrypt on already updated hmac called!"));this.update(a);return this.digest(a)};sjcl.misc.hmac.prototype.reset=function(){this.K=new this.Q(this.p[0]);this.W=u};sjcl.misc.hmac.prototype.update=function(a){this.W=s;this.K.update(a)};sjcl.misc.hmac.prototype.digest=function(){var a=this.K.finalize(),a=(new this.Q(this.p[1])).update(a).finalize();this.reset();return a};
sjcl.misc.pbkdf2=function(a,b,c,d,e){c=c||1E3;(0>d||0>c)&&p(sjcl.exception.invalid("invalid params to pbkdf2"));"string"===typeof a&&(a=sjcl.codec.utf8String.toBits(a));"string"===typeof b&&(b=sjcl.codec.utf8String.toBits(b));e=e||sjcl.misc.hmac;a=new e(a);var f,g,h,k,l=[],r=sjcl.bitArray;for(k=1;32*l.length<(d||1);k++){e=f=a.encrypt(r.concat(b,[k]));for(g=1;g<c;g++){f=a.encrypt(f);for(h=0;h<f.length;h++)e[h]^=f[h]}l=l.concat(e)}d&&(l=r.clamp(l,d));return l};
sjcl.prng=function(a){this.f=[new sjcl.hash.sha256];this.l=[0];this.J=0;this.w={};this.H=0;this.N={};this.T=this.h=this.m=this.ca=0;this.d=[0,0,0,0,0,0,0,0];this.i=[0,0,0,0];this.D=q;this.F=a;this.u=u;this.C={progress:{},seeded:{}};this.o=this.ba=0;this.A=1;this.B=2;this.Z=0x10000;this.L=[0,48,64,96,128,192,0x100,384,512,768,1024];this.$=3E4;this.Y=80};
sjcl.prng.prototype={randomWords:function(a,b){var c=[],d;d=this.isReady(b);var e;d===this.o&&p(new sjcl.exception.notReady("generator isn't seeded"));if(d&this.B){d=!(d&this.A);e=[];var f=0,g;this.T=e[0]=(new Date).valueOf()+this.$;for(g=0;16>g;g++)e.push(0x100000000*Math.random()|0);for(g=0;g<this.f.length&&!(e=e.concat(this.f[g].finalize()),f+=this.l[g],this.l[g]=0,!d&&this.J&1<<g);g++);this.J>=1<<this.f.length&&(this.f.push(new sjcl.hash.sha256),this.l.push(0));this.h-=f;f>this.m&&(this.m=f);this.J++;
this.d=sjcl.hash.sha256.hash(this.d.concat(e));this.D=new sjcl.cipher.aes(this.d);for(d=0;4>d&&!(this.i[d]=this.i[d]+1|0,this.i[d]);d++);}for(d=0;d<a;d+=4)0===(d+1)%this.Z&&z(this),e=C(this),c.push(e[0],e[1],e[2],e[3]);z(this);return c.slice(0,a)},setDefaultParanoia:function(a,b){0===a&&"Setting paranoia=0 will ruin your security; use it only for testing"!==b&&p("Setting paranoia=0 will ruin your security; use it only for testing");this.F=a},addEntropy:function(a,b,c){c=c||"user";var d,e,f=(new Date).valueOf(),
g=this.w[c],h=this.isReady(),k=0;d=this.N[c];d===q&&(d=this.N[c]=this.ca++);g===q&&(g=this.w[c]=0);this.w[c]=(this.w[c]+1)%this.f.length;switch(typeof a){case "number":b===q&&(b=1);this.f[g].update([d,this.H++,1,b,f,1,a|0]);break;case "object":c=Object.prototype.toString.call(a);if("[object Uint32Array]"===c){e=[];for(c=0;c<a.length;c++)e.push(a[c]);a=e}else{"[object Array]"!==c&&(k=1);for(c=0;c<a.length&&!k;c++)"number"!==typeof a[c]&&(k=1)}if(!k){if(b===q)for(c=b=0;c<a.length;c++)for(e=a[c];0<e;)b++,
e>>>=1;this.f[g].update([d,this.H++,2,b,f,a.length].concat(a))}break;case "string":b===q&&(b=a.length);this.f[g].update([d,this.H++,3,b,f,a.length]);this.f[g].update(a);break;default:k=1}k&&p(new sjcl.exception.bug("random: addEntropy only supports number, array of numbers or string"));this.l[g]+=b;this.h+=b;h===this.o&&(this.isReady()!==this.o&&D("seeded",Math.max(this.m,this.h)),D("progress",this.getProgress()))},isReady:function(a){a=this.L[a!==q?a:this.F];return this.m&&this.m>=a?this.l[0]>this.Y&&
(new Date).valueOf()>this.T?this.B|this.A:this.A:this.h>=a?this.B|this.o:this.o},getProgress:function(a){a=this.L[a?a:this.F];return this.m>=a?1:this.h>a?1:this.h/a},startCollectors:function(){this.u||(this.c={loadTimeCollector:E(this,this.ea),mouseCollector:E(this,this.fa),keyboardCollector:E(this,this.da),accelerometerCollector:E(this,this.aa),touchCollector:E(this,this.ga)},window.addEventListener?(window.addEventListener("load",this.c.loadTimeCollector,u),window.addEventListener("mousemove",this.c.mouseCollector,
u),window.addEventListener("keypress",this.c.keyboardCollector,u),window.addEventListener("devicemotion",this.c.accelerometerCollector,u),window.addEventListener("touchmove",this.c.touchCollector,u)):document.attachEvent?(document.attachEvent("onload",this.c.loadTimeCollector),document.attachEvent("onmousemove",this.c.mouseCollector),document.attachEvent("keypress",this.c.keyboardCollector)):p(new sjcl.exception.bug("can't attach event")),this.u=s)},stopCollectors:function(){this.u&&(window.removeEventListener?
(window.removeEventListener("load",this.c.loadTimeCollector,u),window.removeEventListener("mousemove",this.c.mouseCollector,u),window.removeEventListener("keypress",this.c.keyboardCollector,u),window.removeEventListener("devicemotion",this.c.accelerometerCollector,u),window.removeEventListener("touchmove",this.c.touchCollector,u)):document.detachEvent&&(document.detachEvent("onload",this.c.loadTimeCollector),document.detachEvent("onmousemove",this.c.mouseCollector),document.detachEvent("keypress",
this.c.keyboardCollector)),this.u=u)},addEventListener:function(a,b){this.C[a][this.ba++]=b},removeEventListener:function(a,b){var c,d,e=this.C[a],f=[];for(d in e)e.hasOwnProperty(d)&&e[d]===b&&f.push(d);for(c=0;c<f.length;c++)d=f[c],delete e[d]},da:function(){F(1)},fa:function(a){var b,c;try{b=a.x||a.clientX||a.offsetX||0,c=a.y||a.clientY||a.offsetY||0}catch(d){c=b=0}0!=b&&0!=c&&sjcl.random.addEntropy([b,c],2,"mouse");F(0)},ga:function(a){a=a.touches[0]||a.changedTouches[0];sjcl.random.addEntropy([a.pageX||
a.clientX,a.pageY||a.clientY],1,"touch");F(0)},ea:function(){F(2)},aa:function(a){a=a.accelerationIncludingGravity.x||a.accelerationIncludingGravity.y||a.accelerationIncludingGravity.z;if(window.orientation){var b=window.orientation;"number"===typeof b&&sjcl.random.addEntropy(b,1,"accelerometer")}a&&sjcl.random.addEntropy(a,2,"accelerometer");F(0)}};function D(a,b){var c,d=sjcl.random.C[a],e=[];for(c in d)d.hasOwnProperty(c)&&e.push(d[c]);for(c=0;c<e.length;c++)e[c](b)}
function F(a){"undefined"!==typeof window&&window.performance&&"function"===typeof window.performance.now?sjcl.random.addEntropy(window.performance.now(),a,"loadtime"):sjcl.random.addEntropy((new Date).valueOf(),a,"loadtime")}function z(a){a.d=C(a).concat(C(a));a.D=new sjcl.cipher.aes(a.d)}function C(a){for(var b=0;4>b&&!(a.i[b]=a.i[b]+1|0,a.i[b]);b++);return a.D.encrypt(a.i)}function E(a,b){return function(){b.apply(a,arguments)}}sjcl.random=new sjcl.prng(6);
a:try{var G,H,I,J;if(J="undefined"!==typeof module){var K;if(K=module.exports){var L;try{L=require("crypto")}catch(M){L=null}K=(H=L)&&H.randomBytes}J=K}if(J)G=H.randomBytes(128),G=new Uint32Array((new Uint8Array(G)).buffer),sjcl.random.addEntropy(G,1024,"crypto['randomBytes']");else if("undefined"!==typeof window&&"undefined"!==typeof Uint32Array){I=new Uint32Array(32);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(I);else if(window.msCrypto&&window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(I);
else break a;sjcl.random.addEntropy(I,1024,"crypto['getRandomValues']")}}catch(N){"undefined"!==typeof window&&window.console&&(console.log("There was an error collecting entropy from the browser:"),console.log(N))}sjcl.bn=function(a){this.initWith(a)};
sjcl.bn.prototype={radix:24,maxMul:8,e:sjcl.bn,copy:function(){return new this.e(this)},initWith:function(a){var b=0,c;switch(typeof a){case "object":this.limbs=a.limbs.slice(0);break;case "number":this.limbs=[a];this.normalize();break;case "string":a=a.replace(/^0x/,"");this.limbs=[];c=this.radix/4;for(b=0;b<a.length;b+=c)this.limbs.push(parseInt(a.substring(Math.max(a.length-b-c,0),a.length-b),16));break;default:this.limbs=[0]}return this},equals:function(a){"number"===typeof a&&(a=new this.e(a));
var b=0,c;this.fullReduce();a.fullReduce();for(c=0;c<this.limbs.length||c<a.limbs.length;c++)b|=this.getLimb(c)^a.getLimb(c);return 0===b},getLimb:function(a){return a>=this.limbs.length?0:this.limbs[a]},greaterEquals:function(a){"number"===typeof a&&(a=new this.e(a));var b=0,c=0,d,e,f;for(d=Math.max(this.limbs.length,a.limbs.length)-1;0<=d;d--)e=this.getLimb(d),f=a.getLimb(d),c|=f-e&~b,b|=e-f&~c;return(c|~b)>>>31},toString:function(){this.fullReduce();var a="",b,c,d=this.limbs;for(b=0;b<this.limbs.length;b++){for(c=
d[b].toString(16);b<this.limbs.length-1&&6>c.length;)c="0"+c;a=c+a}return"0x"+a},addM:function(a){"object"!==typeof a&&(a=new this.e(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]+=c[a];return this},doubleM:function(){var a,b=0,c,d=this.radix,e=this.radixMask,f=this.limbs;for(a=0;a<f.length;a++)c=f[a],c=c+c+b,f[a]=c&e,b=c>>d;b&&f.push(b);return this},halveM:function(){var a,b=0,c,d=this.radix,e=this.limbs;for(a=e.length-1;0<=a;a--)c=e[a],e[a]=c+b>>
1,b=(c&1)<<d;e[e.length-1]||e.pop();return this},subM:function(a){"object"!==typeof a&&(a=new this.e(a));var b=this.limbs,c=a.limbs;for(a=b.length;a<c.length;a++)b[a]=0;for(a=0;a<c.length;a++)b[a]-=c[a];return this},mod:function(a){var b=!this.greaterEquals(new sjcl.bn(0));a=(new sjcl.bn(a)).normalize();var c=(new sjcl.bn(this)).normalize(),d=0;for(b&&(c=(new sjcl.bn(0)).subM(c).normalize());c.greaterEquals(a);d++)a.doubleM();for(b&&(c=a.sub(c).normalize());0<d;d--)a.halveM(),c.greaterEquals(a)&&
c.subM(a).normalize();return c.trim()},inverseMod:function(a){var b=new sjcl.bn(1),c=new sjcl.bn(0),d=new sjcl.bn(this),e=new sjcl.bn(a),f,g=1;a.limbs[0]&1||p(new sjcl.exception.invalid("inverseMod: p must be odd"));do{d.limbs[0]&1&&(d.greaterEquals(e)||(f=d,d=e,e=f,f=b,b=c,c=f),d.subM(e),d.normalize(),b.greaterEquals(c)||b.addM(a),b.subM(c));d.halveM();b.limbs[0]&1&&b.addM(a);b.normalize();b.halveM();for(f=g=0;f<d.limbs.length;f++)g|=d.limbs[f]}while(g);e.equals(1)||p(new sjcl.exception.invalid("inverseMod: p and x must be relatively prime"));
return c},add:function(a){return this.copy().addM(a)},sub:function(a){return this.copy().subM(a)},mul:function(a){"number"===typeof a&&(a=new this.e(a));var b,c=this.limbs,d=a.limbs,e=c.length,f=d.length,g=new this.e,h=g.limbs,k,l=this.maxMul;for(b=0;b<this.limbs.length+a.limbs.length+1;b++)h[b]=0;for(b=0;b<e;b++){k=c[b];for(a=0;a<f;a++)h[b+a]+=k*d[a];--l||(l=this.maxMul,g.cnormalize())}return g.cnormalize().reduce()},square:function(){return this.mul(this)},power:function(a){"number"===typeof a?
a=[a]:a.limbs!==q&&(a=a.normalize().limbs);var b,c,d=new this.e(1),e=this;for(b=0;b<a.length;b++)for(c=0;c<this.radix;c++)a[b]&1<<c&&(d=d.mul(e)),e=e.square();return d},mulmod:function(a,b){return this.mod(b).mul(a.mod(b)).mod(b)},powermod:function(a,b){for(var c=new sjcl.bn(1),d=new sjcl.bn(this),e=new sjcl.bn(a);;){e.limbs[0]&1&&(c=c.mulmod(d,b));e.halveM();if(e.equals(0))break;d=d.mulmod(d,b)}return c.normalize().reduce()},trim:function(){var a=this.limbs,b;do b=a.pop();while(a.length&&0===b);
a.push(b);return this},reduce:function(){return this},fullReduce:function(){return this.normalize()},normalize:function(){var a=0,b,c=this.placeVal,d=this.ipv,e,f=this.limbs,g=f.length,h=this.radixMask;for(b=0;b<g||0!==a&&-1!==a;b++)a=(f[b]||0)+a,e=f[b]=a&h,a=(a-e)*d;-1===a&&(f[b-1]-=c);return this},cnormalize:function(){var a=0,b,c=this.ipv,d,e=this.limbs,f=e.length,g=this.radixMask;for(b=0;b<f-1;b++)a=e[b]+a,d=e[b]=a&g,a=(a-d)*c;e[b]+=a;return this},toBits:function(a){this.fullReduce();a=a||this.exponent||
this.bitLength();var b=Math.floor((a-1)/24),c=sjcl.bitArray,d=[c.partial((a+7&-8)%this.radix||this.radix,this.getLimb(b))];for(b--;0<=b;b--)d=c.concat(d,[c.partial(Math.min(this.radix,a),this.getLimb(b))]),a-=this.radix;return d},bitLength:function(){this.fullReduce();for(var a=this.radix*(this.limbs.length-1),b=this.limbs[this.limbs.length-1];b;b>>>=1)a++;return a+7&-8}};
sjcl.bn.fromBits=function(a){var b=new this,c=[],d=sjcl.bitArray,e=this.prototype,f=Math.min(this.bitLength||0x100000000,d.bitLength(a)),g=f%e.radix||e.radix;for(c[0]=d.extract(a,0,g);g<f;g+=e.radix)c.unshift(d.extract(a,g,e.radix));b.limbs=c;return b};sjcl.bn.prototype.ipv=1/(sjcl.bn.prototype.placeVal=Math.pow(2,sjcl.bn.prototype.radix));sjcl.bn.prototype.radixMask=(1<<sjcl.bn.prototype.radix)-1;
sjcl.bn.pseudoMersennePrime=function(a,b){function c(a){this.initWith(a)}var d=c.prototype=new sjcl.bn,e,f;e=d.modOffset=Math.ceil(f=a/d.radix);d.exponent=a;d.offset=[];d.factor=[];d.minOffset=e;d.fullMask=0;d.fullOffset=[];d.fullFactor=[];d.modulus=c.modulus=new sjcl.bn(Math.pow(2,a));d.fullMask=0|-Math.pow(2,a%d.radix);for(e=0;e<b.length;e++)d.offset[e]=Math.floor(b[e][0]/d.radix-f),d.fullOffset[e]=Math.ceil(b[e][0]/d.radix-f),d.factor[e]=b[e][1]*Math.pow(0.5,a-b[e][0]+d.offset[e]*d.radix),d.fullFactor[e]=
b[e][1]*Math.pow(0.5,a-b[e][0]+d.fullOffset[e]*d.radix),d.modulus.addM(new sjcl.bn(Math.pow(2,b[e][0])*b[e][1])),d.minOffset=Math.min(d.minOffset,-d.offset[e]);d.e=c;d.modulus.cnormalize();d.reduce=function(){var a,b,c,d=this.modOffset,e=this.limbs,f=this.offset,m=this.offset.length,v=this.factor,t;for(a=this.minOffset;e.length>d;){c=e.pop();t=e.length;for(b=0;b<m;b++)e[t+f[b]]-=v[b]*c;a--;a||(e.push(0),this.cnormalize(),a=this.minOffset)}this.cnormalize();return this};d.V=-1===d.fullMask?d.reduce:
function(){var a=this.limbs,b=a.length-1,c,d;this.reduce();if(b===this.modOffset-1){d=a[b]&this.fullMask;a[b]-=d;for(c=0;c<this.fullOffset.length;c++)a[b+this.fullOffset[c]]-=this.fullFactor[c]*d;this.normalize()}};d.fullReduce=function(){var a,b;this.V();this.addM(this.modulus);this.addM(this.modulus);this.normalize();this.V();for(b=this.limbs.length;b<this.modOffset;b++)this.limbs[b]=0;a=this.greaterEquals(this.modulus);for(b=0;b<this.limbs.length;b++)this.limbs[b]-=this.modulus.limbs[b]*a;this.cnormalize();
return this};d.inverse=function(){return this.power(this.modulus.sub(2))};c.fromBits=sjcl.bn.fromBits;return c};var O=sjcl.bn.pseudoMersennePrime;
sjcl.bn.prime={p127:O(127,[[0,-1]]),p25519:O(255,[[0,-19]]),p192k:O(192,[[32,-1],[12,-1],[8,-1],[7,-1],[6,-1],[3,-1],[0,-1]]),p224k:O(224,[[32,-1],[12,-1],[11,-1],[9,-1],[7,-1],[4,-1],[1,-1],[0,-1]]),p256k:O(0x100,[[32,-1],[9,-1],[8,-1],[7,-1],[6,-1],[4,-1],[0,-1]]),p192:O(192,[[0,-1],[64,-1]]),p224:O(224,[[0,1],[96,-1]]),p256:O(0x100,[[0,-1],[96,1],[192,1],[224,-1]]),p384:O(384,[[0,-1],[32,1],[96,-1],[128,-1]]),p521:O(521,[[0,-1]])};
sjcl.bn.random=function(a,b){"object"!==typeof a&&(a=new sjcl.bn(a));for(var c,d,e=a.limbs.length,f=a.limbs[e-1]+1,g=new sjcl.bn;;){do c=sjcl.random.randomWords(e,b),0>c[e-1]&&(c[e-1]+=0x100000000);while(Math.floor(c[e-1]/f)===Math.floor(0x100000000/f));c[e-1]%=f;for(d=0;d<e-1;d++)c[d]&=a.radixMask;g.limbs=c;if(!g.greaterEquals(a))return g}};sjcl.ecc={};
sjcl.ecc.point=function(a,b,c){b===q?this.isIdentity=s:(b instanceof sjcl.bn&&(b=new a.field(b)),c instanceof sjcl.bn&&(c=new a.field(c)),this.x=b,this.y=c,this.isIdentity=u);this.curve=a};
sjcl.ecc.point.prototype={toJac:function(){return new sjcl.ecc.pointJac(this.curve,this.x,this.y,new this.curve.field(1))},mult:function(a){return this.toJac().mult(a,this).toAffine()},mult2:function(a,b,c){return this.toJac().mult2(a,this,b,c).toAffine()},multiples:function(){var a,b,c;if(this.S===q){c=this.toJac().doubl();a=this.S=[new sjcl.ecc.point(this.curve),this,c.toAffine()];for(b=3;16>b;b++)c=c.add(this),a.push(c.toAffine())}return this.S},isValid:function(){return this.y.square().equals(this.curve.b.add(this.x.mul(this.curve.a.add(this.x.square()))))},
toBits:function(){return sjcl.bitArray.concat(this.x.toBits(),this.y.toBits())}};sjcl.ecc.pointJac=function(a,b,c,d){b===q?this.isIdentity=s:(this.x=b,this.y=c,this.z=d,this.isIdentity=u);this.curve=a};
sjcl.ecc.pointJac.prototype={add:function(a){var b,c,d,e;this.curve!==a.curve&&p("sjcl['ecc']['add'](): Points must be on the same curve to add them!");if(this.isIdentity)return a.toJac();if(a.isIdentity)return this;b=this.z.square();c=a.x.mul(b).subM(this.x);if(c.equals(0))return this.y.equals(a.y.mul(b.mul(this.z)))?this.doubl():new sjcl.ecc.pointJac(this.curve);b=a.y.mul(b.mul(this.z)).subM(this.y);d=c.square();a=b.square();e=c.square().mul(c).addM(this.x.add(this.x).mul(d));a=a.subM(e);b=this.x.mul(d).subM(a).mul(b);
d=this.y.mul(c.square().mul(c));b=b.subM(d);c=this.z.mul(c);return new sjcl.ecc.pointJac(this.curve,a,b,c)},doubl:function(){if(this.isIdentity)return this;var a=this.y.square(),b=a.mul(this.x.mul(4)),c=a.square().mul(8),a=this.z.square(),d=this.curve.a.toString()==(new sjcl.bn(-3)).toString()?this.x.sub(a).mul(3).mul(this.x.add(a)):this.x.square().mul(3).add(a.square().mul(this.curve.a)),a=d.square().subM(b).subM(b),b=b.sub(a).mul(d).subM(c),c=this.y.add(this.y).mul(this.z);return new sjcl.ecc.pointJac(this.curve,
a,b,c)},toAffine:function(){if(this.isIdentity||this.z.equals(0))return new sjcl.ecc.point(this.curve);var a=this.z.inverse(),b=a.square();return new sjcl.ecc.point(this.curve,this.x.mul(b).fullReduce(),this.y.mul(b.mul(a)).fullReduce())},mult:function(a,b){"number"===typeof a?a=[a]:a.limbs!==q&&(a=a.normalize().limbs);var c,d,e=(new sjcl.ecc.point(this.curve)).toJac(),f=b.multiples();for(c=a.length-1;0<=c;c--)for(d=sjcl.bn.prototype.radix-4;0<=d;d-=4)e=e.doubl().doubl().doubl().doubl().add(f[a[c]>>
d&15]);return e},mult2:function(a,b,c,d){"number"===typeof a?a=[a]:a.limbs!==q&&(a=a.normalize().limbs);"number"===typeof c?c=[c]:c.limbs!==q&&(c=c.normalize().limbs);var e,f=(new sjcl.ecc.point(this.curve)).toJac();b=b.multiples();var g=d.multiples(),h,k;for(d=Math.max(a.length,c.length)-1;0<=d;d--){h=a[d]|0;k=c[d]|0;for(e=sjcl.bn.prototype.radix-4;0<=e;e-=4)f=f.doubl().doubl().doubl().doubl().add(b[h>>e&15]).add(g[k>>e&15])}return f},isValid:function(){var a=this.z.square(),b=a.square(),a=b.mul(a);
return this.y.square().equals(this.curve.b.mul(a).add(this.x.mul(this.curve.a.mul(b).add(this.x.square()))))}};sjcl.ecc.curve=function(a,b,c,d,e,f){this.field=a;this.r=new sjcl.bn(b);this.a=new a(c);this.b=new a(d);this.G=new sjcl.ecc.point(this,new a(e),new a(f))};
sjcl.ecc.curve.prototype.fromBits=function(a){var b=sjcl.bitArray,c=this.field.prototype.exponent+7&-8;a=new sjcl.ecc.point(this,this.field.fromBits(b.bitSlice(a,0,c)),this.field.fromBits(b.bitSlice(a,c,2*c)));a.isValid()||p(new sjcl.exception.corrupt("not on the curve!"));return a};
sjcl.ecc.curves={c192:new sjcl.ecc.curve(sjcl.bn.prime.p192,"0xffffffffffffffffffffffff99def836146bc9b1b4d22831",-3,"0x64210519e59c80e70fa7e9ab72243049feb8deecc146b9b1","0x188da80eb03090f67cbf20eb43a18800f4ff0afd82ff1012","0x07192b95ffc8da78631011ed6b24cdd573f977a11e794811"),c224:new sjcl.ecc.curve(sjcl.bn.prime.p224,"0xffffffffffffffffffffffffffff16a2e0b8f03e13dd29455c5c2a3d",-3,"0xb4050a850c04b3abf54132565044b0b7d7bfd8ba270b39432355ffb4","0xb70e0cbd6bb4bf7f321390b94a03c1d356c21122343280d6115c1d21",
"0xbd376388b5f723fb4c22dfe6cd4375a05a07476444d5819985007e34"),c256:new sjcl.ecc.curve(sjcl.bn.prime.p256,"0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",-3,"0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b","0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296","0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"),c384:new sjcl.ecc.curve(sjcl.bn.prime.p384,"0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973",
-3,"0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aef","0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7","0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5f"),k192:new sjcl.ecc.curve(sjcl.bn.prime.p192k,"0xfffffffffffffffffffffffe26f2fc170f69466a74defd8d",0,3,"0xdb4ff10ec057e9ae26b07d0280b7f4341da5d1b1eae06c7d","0x9b2f2f6d9c5628a7844163d015be86344082aa88d95e2f9d"),
k224:new sjcl.ecc.curve(sjcl.bn.prime.p224k,"0x010000000000000000000000000001dce8d2ec6184caf0a971769fb1f7",0,5,"0xa1455b334df099df30fc28a169a467e9e47075a90f7e650eb6b7a45c","0x7e089fed7fba344282cafbd6f7e319f7c0b0bd59e2ca4bdb556d61a5"),k256:new sjcl.ecc.curve(sjcl.bn.prime.p256k,"0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",0,7,"0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")};
sjcl.ecc.basicKey={publicKey:function(a,b){this.g=a;this.j=a.r.bitLength();this.t=b instanceof Array?a.fromBits(b):b;this.get=function(){var a=this.t.toBits(),b=sjcl.bitArray.bitLength(a),e=sjcl.bitArray.bitSlice(a,0,b/2),a=sjcl.bitArray.bitSlice(a,b/2);return{x:e,y:a}}},secretKey:function(a,b){this.g=a;this.j=a.r.bitLength();this.s=b;this.get=function(){return this.s.toBits()}}};
sjcl.ecc.basicKey.generateKeys=function(a){return function(b,c,d){b=b||0x100;"number"===typeof b&&(b=sjcl.ecc.curves["c"+b],b===q&&p(new sjcl.exception.invalid("no such curve")));d=d||sjcl.bn.random(b.r,c);c=b.G.mult(d);return{pub:new sjcl.ecc[a].publicKey(b,c),sec:new sjcl.ecc[a].secretKey(b,d)}}};
sjcl.ecc.elGamal={generateKeys:sjcl.ecc.basicKey.generateKeys("elGamal"),publicKey:function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)},secretKey:function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)}};sjcl.ecc.elGamal.publicKey.prototype={kem:function(a){a=sjcl.bn.random(this.g.r,a);var b=this.g.G.mult(a).toBits();return{key:sjcl.hash.sha256.hash(this.t.mult(a).toBits()),tag:b}}};
sjcl.ecc.elGamal.secretKey.prototype={unkem:function(a){return sjcl.hash.sha256.hash(this.g.fromBits(a).mult(this.s).toBits())},dh:function(a){return sjcl.hash.sha256.hash(a.t.mult(this.s).toBits())},dhJavaEc:function(a){return a.t.mult(this.s).x.toBits()}};sjcl.ecc.ecdsa={generateKeys:sjcl.ecc.basicKey.generateKeys("ecdsa")};sjcl.ecc.ecdsa.publicKey=function(a,b){sjcl.ecc.basicKey.publicKey.apply(this,arguments)};
sjcl.ecc.ecdsa.publicKey.prototype={verify:function(a,b,c){sjcl.bitArray.bitLength(a)>this.j&&(a=sjcl.bitArray.clamp(a,this.j));var d=sjcl.bitArray,e=this.g.r,f=this.j,g=sjcl.bn.fromBits(d.bitSlice(b,0,f)),d=sjcl.bn.fromBits(d.bitSlice(b,f,2*f)),h=c?d:d.inverseMod(e),f=sjcl.bn.fromBits(a).mul(h).mod(e),h=g.mul(h).mod(e),f=this.g.G.mult2(f,h,this.t).x;if(g.equals(0)||d.equals(0)||g.greaterEquals(e)||d.greaterEquals(e)||!f.equals(g)){if(c===q)return this.verify(a,b,s);p(new sjcl.exception.corrupt("signature didn't check out"))}return s}};
sjcl.ecc.ecdsa.secretKey=function(a,b){sjcl.ecc.basicKey.secretKey.apply(this,arguments)};sjcl.ecc.ecdsa.secretKey.prototype={sign:function(a,b,c,d){sjcl.bitArray.bitLength(a)>this.j&&(a=sjcl.bitArray.clamp(a,this.j));var e=this.g.r,f=e.bitLength();d=d||sjcl.bn.random(e.sub(1),b).add(1);b=this.g.G.mult(d).x.mod(e);a=sjcl.bn.fromBits(a).add(b.mul(this.s));c=c?a.inverseMod(e).mul(d).mod(e):a.mul(d.inverseMod(e)).mod(e);return sjcl.bitArray.concat(b.toBits(f),c.toBits(f))}};

return sjcl; }

})();
