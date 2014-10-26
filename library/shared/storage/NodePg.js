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

// TODO Handle multiple types and eids
exports.prototype.linkEntities = function(selector, callback) {
	this.$client.query("INSERT INTO relations (parent, child) "+
		"VALUES ($1, $2) "+
		"RETURNING parent, child", [
		selector[selector.length-2].value,
		selector.last.value
	], afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// TODO Check for SQL injection!
exports.prototype.unregisterEntities = function(eids, did, callback) {
	this.$client.query("SELECT set_cascade_domain($1)", did, afterSelectQuery.bind(this));

	function afterSelectQuery() {
		this.$client.query("DELETE FROM entities "+
			"WHERE eid IN ("+eids.join(",")+")",
		afterDeleteQuery);
	}

	function afterDeleteQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}

// TODO Check for SQL injection!
// TODO Handle multiple types and eids
exports.prototype.selectEntities = function(selector, did, callback) {
	var from, where;
	from = " FROM ";
	where = " WHERE ";
	for (var i=selector.length-1,r=0; i>=0; i--,r++) {
		if (r>0)
			from += "JOIN entities e"+r+" ON r"+(r-1)+".parent=e"+r+".eid JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
		else
			from += "entities e"+r+" JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
		if (!selector[i].value)
			where += "t"+r+".name='"+selector[i].key+"' AND e"+r+".did="+did+" ";
		else
			where += "t"+r+".name='"+selector[i].key+"' AND e"+r+".eid IN ("+selector[i].value+") ";
		if (i>0) {
			from += "JOIN relations r"+r+" ON e"+r+".eid=r"+r+".child ";
			where += "AND ";
		}
	}
	this.$client.query("SELECT e0.eid,e0.did,t0.name AS type"+from+where, afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}

// TODO Check for SQL injection!
// TODO Handle multiple types and eids
exports.prototype.selectCascade = function(selector, did, callback) {
	this.$client.query("SELECT set_cascade_domain($1)", did, afterSelectQuery.bind(this));

	function afterSelectQuery() {
		var from, where;
		from = " FROM ";
		where = " WHERE ";
		for (var i=selector.length-1,r=0; i>=0; i--,r++) {
			if (r>0)
				from += "JOIN entities e"+r+" ON r"+(r-1)+".parent=e"+r+".eid JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
			else
				from += "entities e"+r+" JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
			if (!selector[i].value)
				where += "t"+r+".name='"+selector[i].key+"' AND e"+r+".did="+did+" ";
			else
				where += "t"+r+".name='"+selector[i].key+"' AND e"+r+".eid IN ("+selector[i].value+") ";
			if (i>0) {
				from += "JOIN relations r"+r+" ON e"+r+".eid=r"+r+".child ";
				where += "AND ";
			}
		}
		// TODO Merge this select with simulate query
		this.$client.query("SELECT e0.eid"+from+where, afterSelectEntities.bind(this));
	}

	function afterSelectEntities(error, result) {
		var eids,i;
		if (error)
			return callback(error);
		if (result.rows.length == 0)
			return callback(null, null);
		eids = new Array();
		for	(i=0; i<result.rows.length; i++)
			eids.push(result.rows[i]['eid']);
		console.log("SELECT simulate('DELETE FROM entities WHERE eid IN ("+eids.join(",")+")')");
		this.$client.query("SELECT simulate('DELETE FROM entities WHERE eid IN ("+eids.join(",")+")')", afterSimulationQuery.bind(this));
	}

	function afterSimulationQuery(error, result) {
		if (error)
			return callback(error);
		this.$client.query("SELECT e.eid,e.did,t.name AS type FROM entities e JOIN types t ON t.tid=e.tid WHERE eid IN ("+result.rows[0]['simulate']+")", afterQuery);
	}

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}

// TODO Check for SQL injection!
exports.prototype.createEntity = function(type, values, callback) {
	var fields, vals, params, field;
	fields = new Array();
	vals = new Array();
	params = new Array();
	for (field in values) {
		fields.push(field);
		params.push(values[field]);
		vals.push("$"+params.length);
	}
	this.$client.query("INSERT INTO "+type+" ("+fields.join(",")+") "+
		"VALUES ("+vals.join(",")+") "+
		"RETURNING *",
	params, afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// TODO Check for SQL injection!
// TODO Handle multiple types and eids
exports.prototype.readEntities = function(type, eids, callback) {
	this.$client.query("SELECT * "+
		"FROM "+type+" "+
		"WHERE eid IN ("+eids.join(",")+")",
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}

// TODO Check for SQL injection!
// TODO Handle multiple types and eids
exports.prototype.updateEntities = function(type, values, callback) {
	var ids, fields, params, set, field, i;
	ids = new Array();
	fields = new Object();
	params = new Array();
	for (i=0; i<values.length; i++) {
		params.push(values[i]['eid']);
		ids.push("$"+params.length);
		for (field in values[i]) {
			if (field != 'eid') {
				if (!fields[field])
					fields[field] = "";
				// NOTE psql seems to escape numbers as strings when they're
				//      used inside a when-then clause
				if (typeof values[i][field] == 'number') {
					fields[field] += "when eid="+ids[ids.length-1]+" then "+values[i][field];
				}
				else {
					params.push(values[i][field]);
					fields[field] += "when eid="+ids[ids.length-1]+" then $"+params.length;
				}
			}
		}
	}
	set = new Array();
	for (field in fields)
		set.push(field+"=case "+fields[field]+" end");
	this.$client.query("UPDATE "+type+" SET "+set.join(",")+" WHERE eid IN ("+ids.join(",")+") RETURNING *", params, afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}

// TODO Check for SQL injection!
// TODO Handle multiple types and eids
exports.prototype.deleteEntities = function(type, eids, callback) {
	this.$client.query("DELETE FROM "+type+" "+
		"WHERE eid IN ("+eids.join(",")+")",
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows:null);
	}
}
