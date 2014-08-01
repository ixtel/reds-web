"use strict";

module.exports = exports = function(session) {
	this.session = session;
}

exports.prototype.GET = function() {
	console.log("GET user");
	this.session.writeJSON({
		'id': Math.floor(Math.random()*1000)
	});
	this.session.end();
}

exports.prototype.POST = function() {
	console.log("POST user");
	this.session.writeJSON({
		'id': Math.floor(Math.random()*1000)
	});
	this.session.end();
}

exports.prototype.PUT = function() {
	console.log("PUT user");
	this.session.writeJSON({
		'id': Math.floor(Math.random()*1000)
	});
	this.session.end();
}

exports.prototype.DELETE = function() {
	console.log("DELETE user");
	this.session.writeJSON({
		'id': Math.floor(Math.random()*1000)
	});
	this.session.end();
}
