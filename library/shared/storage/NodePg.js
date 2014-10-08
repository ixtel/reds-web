"use strict";

var pg = require("pg");

module.exports = exports = function(options) {
	this.$client = null;
	this.$done = null;
	this.options = options||null;
}

exports.prototype.name = "nodepg-1"

exports.prototype.connect = function(callback) {
	pg.connect(this.options, afterConnect.bind(this));

	function afterConnect(error, client, done) {
		this.$client = client;
		this.$done = done;
		callback && callback(error);
	}
}

exports.prototype.disconnect = function(callback) {
	this.$done && this.$done();
	callback && callback(null);
}

// INFO Pod operation

exports.prototype.createPod = function(values, callback) {
	this.$client.query("INSERT INTO pods (url) "+
		"VALUES $1 "+
		"RETURNING id,url", [
		values['url']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readPod = function(pod, callback) {
	this.$client.query("SELECT id,url "+
		"FROM pods "+
		"WHERE url=$1", [
		pod
	], afterQuery);

	function afterQuery(error, result) {
		if (result.rows[0] === undefined)
			error = new Error("pod not found");
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Alias operations

exports.prototype.readAlias = function(alias, callback) {
	this.$client.query("SELECT id,encode(asalt,'base64') AS asalt,encode(keys,'base64') AS keys,encode(vec,'base64') AS vec "+
		"FROM accounts "+
		"WHERE alias=decode($1,'base64')", [
		alias
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Account operations

exports.prototype.createAccount = function(values, callback) {
	this.$client.query("INSERT INTO accounts (alias,auth,asalt) "+
		"VALUES (decode($1,'base64'),decode($2,'base64'),decode($3,'base64')) "+
		"RETURNING id", [
		values['alias'],
		values['auth'],
		values['asalt']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readAccount = function(id, callback) {
	this.$client.query("SELECT id,encode(auth,'base64') AS auth "+
		"FROM accounts "+
		"WHERE id=$1", [
		id
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.updateAccount = function(values, callback) {
	this.$client.query("UPDATE accounts "+
		"SET keys=decode($1,'base64'), vec=decode($2,'base64') "+
		"WHERE id=$3 "+
		"RETURNING id", [ 
		values['keys'],
		values['vec'],
		values['id']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.deleteAccount = function(id, callback) {
	this.$client.query("DELETE FROM accounts "+
		"WHERE id=$1", [
		id
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}
