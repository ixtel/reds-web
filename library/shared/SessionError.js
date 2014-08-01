"use strict";

module.exports = exports = function(code, message) {
	Error.call(this);
	this.name = "REDS_SESSION_ERROR";
	this.code = code || 500;
	this.message = message || ""; 
}

exports.prototype = Object.create(Error.prototype);

exports.prototype.toString = function() {
	return this.code+" ("+this.message+")";
}
