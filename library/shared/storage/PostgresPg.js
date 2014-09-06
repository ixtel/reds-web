"use strict";

var pg = require("pg");

module.exports = exports = function(options) {
	this.$client = null;
	this.$done = null;
	this.options = options||null;
}

exports.prototype.name = "POSTGRES_PG-1"

exports.prototype.connect = function(callback) {
	pg.connect(this.options, function(error, client, done) {
		this.$client = client;
		this.$done = done;
		callback && callback(error||null);
	}.bind(this));
}

exports.prototype.disconnect = function(callback) {
	this.$done && this.$done();
	callback && callback(null);
}
