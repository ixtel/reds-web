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
	pg.end();

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
		"RETURNING pid,url",
		[values['url']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readPod = function(pod, callback) {
	this.$client.query("SELECT pid,url "+
		"FROM pods "+
		"WHERE "+(typeof pod == "number" ? "pid" : "url")+"=$1",
		[pod],
	afterQuery);

	function afterQuery(error, result) {
		if (result.rows[0] === undefined)
			error = new Error("pod not found");
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Alias operations

exports.prototype.readAlias = function(alias, callback) {
	this.$client.query("SELECT aid,encode(asalt,'base64') AS asalt,encode(vault,'base64') AS vault,encode(vec,'base64') AS vec "+
		"FROM accounts "+
		"WHERE alias=decode($1,'base64')",
		[alias],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Account operations

exports.prototype.createAccount = function(values, callback) {
	this.$client.query("INSERT INTO accounts (alias,auth,asalt) "+
		"VALUES (decode($1,'base64'),decode($2,'base64'),decode($3,'base64')) "+
		"RETURNING aid",
		[values['alias'], values['auth'], values['asalt']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readAccount = function(aid, callback) {
	this.$client.query("SELECT aid,encode(auth,'base64') AS auth "+
		"FROM accounts "+
		"WHERE aid=$1",
		[aid],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.updateAccount = function(values, callback) {
	this.$client.query("UPDATE accounts "+
		"SET vault=decode($1,'base64'), vec=decode($2,'base64') "+
		"WHERE aid=$3 "+
		"RETURNING aid",
		[values['vault'], values['vec'], values['aid']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.deleteAccount = function(aid, callback) {
	this.$client.query("DELETE FROM accounts "+
		"WHERE aid=$1 "+
		"RETURNING aid",
		[aid],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Domain operations

exports.prototype.registerDomain = function(values, callback) {
	this.$client.query("INSERT INTO domains (pid) "+
		"VALUES ($1) "+
		"RETURNING did",
		[values['pid']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.unregisterDomain = function(did, callback) {
	this.$client.query("DELETE FROM domains "+
		"WHERE did=$1 "+
		"RETURNING *",
		[did],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.createDomain = function(values, callback) {
	this.$client.query("INSERT INTO domains (did, dkey) "+
		"VALUES ($1,decode($2,'base64')) "+
		"RETURNING did",
		[values['did'], values['dkey']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readDomain = function(did, callback) {
	this.$client.query("SELECT * "+
		"FROM domains "+
		"WHERE did=$1 ",
		[did],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.deleteDomain = function(did, callback) {
	this.$client.query("DELETE FROM domains "+
		"WHERE did=$1 "+
		"RETURNING did",
		[did],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Ticket operations

exports.prototype.createTicket = function(values, callback) {
	this.$client.query("INSERT INTO tickets (did, tkey, tflags) "+
		"VALUES ($1,decode($2,'base64'), $3) "+
		"RETURNING tid, tflags",
		[values['did'], values['tkey'], values['tflags']],
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// INFO Entity operations

exports.prototype.reserveEntity = function(callback) {
	this.$client.query("SELECT nextval('entities_eid_seq')", afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]['nextval']:null);
	}
}

exports.prototype.registerEntity = function(selector, did, callback) {
	this.$client.query("INSERT INTO entities (eid, tid, did) "+
		"SELECT	$1, (SELECT tid FROM types WHERE name=$2), $3 "+
		"WHERE NOT EXISTS (SELECT eid FROM entities WHERE eid = $1)",
		[selector.last.value, selector.last.key, did],
	afterEntitiesQuery.bind(this));

	function afterEntitiesQuery(error, result) {
		if (selector.length > 1) {
			this.$client.query("INSERT INTO relations (parent, child) "+
				"VALUES ($1, $2) "+
				"RETURNING parent, child",
				[selector[selector.length-2].value, selector.last.value],
			afterRelationsQuery);
		}
		else {
			afterRelationsQuery(null, null);
		}
	}

	function afterRelationsQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

// TODO Check for SQL injection!
exports.prototype.unregisterEntities = function(selector, did, callback) {
	this.$client.query("SELECT set_cascade_domain($1)", did, afterCascadeQuery.bind(this));

	function afterCascadeQuery() {
		this.selectEntities(selector, did, afterSelectEntities.bind(this));
	}

	function afterSelectEntities(error, rows) {
		var eids,i;
		if (error)
			return callback(error);
		if (rows.length == 0)
			return callback(null, null);
		eids = new Array();
		for	(i=0; i<rows.length; i++)
			eids.push(rows[i]['eid']);
		this.$client.query("DELETE FROM entities WHERE eid IN ("+eids.join(",")+")", afterEntitiesQuery);
	}

	function afterEntitiesQuery(error, result) {
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
exports.prototype.selectCascade = function(selector, did, callback) {
	this.$client.query("SELECT set_cascade_domain($1)", did, afterCascadeQuery.bind(this));

	function afterCascadeQuery() {
		this.selectEntities(selector, did, afterSelectEntities.bind(this));
	}

	function afterSelectEntities(error, rows) {
		var eids,i;
		if (error)
			return callback(error);
		if (rows.length == 0)
			return callback(null, null);
		eids = new Array();
		for	(i=0; i<rows.length; i++)
			eids.push(rows[i]['eid']);
		console.log("SELECT simulate('DELETE FROM entities WHERE eid IN ("+eids.join(",")+")')");
		this.$client.query("SELECT simulate('DELETE FROM entities WHERE eid IN ("+eids.join(",")+")')", afterSimulateQuery.bind(this));
	}

	function afterSimulateQuery(error, result) {
		if (error)
			return callback(error);
		this.$client.query("SELECT e.eid,e.did,t.name AS type "+
			"FROM entities e JOIN types t ON t.tid=e.tid "+
			"WHERE eid IN ("+result.rows[0]['simulate']+")",
		afterEntitiesQuery);
	}

	function afterEntitiesQuery(error, result) {
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
		params,
	afterQuery);

	function afterQuery(error, result) {
		callback(error||null, result?result.rows[0]:null);
	}
}

exports.prototype.readEntities = function(types, eids, callback) {
	var values, errors, count;
	values = new Object();
	errors = new Array();
	types.forEach(readEntitiesForType.bind(this));

	function readEntitiesForType(type, index) {
		count = index;
		this.$client.query("SELECT * FROM "+type+" WHERE eid IN ("+eids[index].join(",")+")", afterQuery);

		function afterQuery(error, result) {
			if (error)
				errors.push(error);
			else
				values[type] = result.rows;
			if (--count < 0)
				callback(errors.length?errors:null, errors.length?null:values);
		}
	}
}

exports.prototype.updateEntities = function(types, values, callback) {
	var rvalues, errors, count;
	rvalues = new Object();
	errors = new Array();
	types.forEach(updateEntitiesForType.bind(this));

	function updateEntitiesForType(type, index) {
		var field, set, fields, params, vals, val, i;
		count = index;
		set = new Array();
		fields = new Array();
		vals = new Array();
		params = new Array();
		for (field in values[type][0]) {
			set.push(field+"=v."+field);
			fields.push(field);
		}
		for (i = 0; i < values[type].length; i++) {
			val = ""
			for (field in values[type][i]) {
				// NOTE NodePG seems to escape numbers as strings when we
				//      use the parameterized form here.
				// TODO Check for for SQL injection!
				if (typeof values[type][i][field] == "string")
					val += ",'"+values[type][i][field]+"'";
				else
					val += ","+values[type][i][field];
			}
			vals.push("("+val.substr(1)+")");
		}
		this.$client.query("UPDATE "+type+" t SET "+set.join(",")+" "+
			"FROM (VALUES "+vals.join(",")+") AS v("+fields.join(",")+") "+
			"WHERE t.eid = v.eid "+
			"RETURNING *",
		afterQuery);

		function afterQuery(error, result) {
			if (error)
				errors.push(error);
			else
				rvalues[type] = result.rows;
			if (--count < 0)
				callback(errors.length?errors:null, errors.length?null:rvalues);
		}
	}
}

exports.prototype.deleteEntities = function(types, eids, callback) {
	var values, errors, count;
	values = new Object();
	errors = new Array();
	types.forEach(deleteEntitiesForType.bind(this));

	function deleteEntitiesForType(type, index) {
		count = index;
		this.$client.query("DELETE FROM "+type+" WHERE eid IN ("+eids[index].join(",")+") RETURNING *", afterQuery);

		function afterQuery(error, result) {
			if (error)
				errors.push(error);
			else
				values[type] = result.rows;
			if (--count < 0)
				callback(errors.length?errors:null, errors.length?null:values);
		}
	}
}
