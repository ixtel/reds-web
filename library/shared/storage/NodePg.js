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
		"WHERE "+(typeof pod == "number" ? "id" : "url")+"=$1", [
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
	this.$client.query("SELECT id,encode(asalt,'base64') AS asalt,encode(vault,'base64') AS vault,encode(vec,'base64') AS vec "+
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
		"SET vault=decode($1,'base64'), vec=decode($2,'base64') "+
		"WHERE id=$3 "+
		"RETURNING id", [ 
		values['vault'],
		values['vec'],
		values['id']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.deleteAccount = function(id, callback) {
	this.$client.query("DELETE FROM accounts "+
		"WHERE id=$1 "+
		"RETURNING id", [
		id
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Domain operations

// TODO Merge with create
exports.prototype.registerDomain = function(values, callback) {
	this.$client.query("INSERT INTO domains (pid) "+
		"VALUES ($1) "+
		"RETURNING did", [
		values['pid']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.createDomain = function(values, callback) {
	this.$client.query("INSERT INTO domains (did, dkey) "+
		"VALUES ($1,decode($2,'base64')) "+
		"RETURNING did", [
		values['did'],
		values['dkey']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readDomain = function(did, callback) {
	this.$client.query("SELECT * "+
		"FROM domains "+
		"WHERE did=$1", [
		did
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.deleteDomain = function(id, callback) {
	this.$client.query("DELETE FROM domains "+
		"WHERE did=$1 "+
		"RETURNING did", [
		id
	], afterQuery);

	function afterQuery(error) {
		callback(error||null);
	}
}

// INFO Ticket operations

exports.prototype.createTicket = function(values, callback) {
	this.$client.query("INSERT INTO tickets (did, tkey, tflags) "+
		"VALUES ($1,decode($2,'base64'), $3) "+
		"RETURNING tid, tflags", [
		values['did'],
		values['tkey'],
		values['tflags']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Entity operations

// TODO Handle child entities
exports.prototype.registerEntity = function(selector, did, callback) {
	this.$client.query("INSERT INTO entities (tid, did) "+
		"VALUES ((SELECT tid FROM types WHERE name=$1), $2) "+
		"RETURNING eid", [
		selector.last.key,
		did
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// TODO Handle child entities
exports.prototype.selectEntities = function(selector, did, callback) {
	this.$client.query("SELECT entities.eid "+
		"FROM entities JOIN types ON entities.tid=types.tid "+
		"WHERE types.name=$1 AND entities.did=$2", [
		selector.last.key,
		did
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}	
}

exports.prototype.createEntity = function(type, values, callback) {
	// TODO Check type for SQL injection!
	this.$client.query("INSERT INTO "+type+" (eid, did, text) "+
		"VALUES ($1,$2,$3) "+
		"RETURNING *", [
		values['eid'],
		values['did'],
		values['text']
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readEntities = function(type, eids, callback) {
	// TODO Check type and eids for SQL injection!
	this.$client.query("SELECT * "+
		"FROM "+type+" "+
		"WHERE eid IN ("+eids.join(",")+")",
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}
