"use strict";

var pg = require("pg");

module.exports = exports = function(options) {
	this.$client = null;
	this.$done = null;
	this.options = options||null;
}

exports.prototype.name = "nodepg-1"

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

// INFO Account operations

exports.prototype.createAccount = function(values, callback) {
	this.$client.query("INSERT INTO accounts (alias,salt,ksalt,ssalt,auth,auth_n) "+
		"VALUES (decode($1,'base64'),decode($2,'base64'),decode($3,'base64'),decode($4,'base64'),decode($5,'base64'),decode($6,'base64')) "+
		"RETURNING id,encode(auth_n,'base64') AS auth_n", [
		values['alias'],
		values['salt'],
		values['ksalt'],
		values['ssalt'],
		values['auth'],
		values['auth_n']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readAccount = function(alias, callback) {
	this.$client.query("SELECT id,encode(salt,'base64') AS salt,encode(ksalt,'base64') AS ksalt,encode(ssalt,'base64') AS ssalt,encode(auth_n,'base64') AS auth_n "+
		"FROM accounts "+
		"WHERE alias=decode($1,'base64')", [
		alias
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}
