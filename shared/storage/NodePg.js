"use strict";

// NOTE Load node-postgres with native bindings if available
try {
    var pg = require("pg").native;
}
catch (e) {
    console.warn("WARNING Native pg bindings not available, falling back to JavaScript");
    pg = require("pg");
}

// NOTE This is a workaroud for the missing bigint support in NodePg.
//      https://github.com/brianc/node-pg-parse-float/issues/3
pg.types.setTypeParser(20, 'text', parseInt);

module.exports = exports = function(options) {
    this.$client = null;
    this.$done = null;
    this.options = options||null;
}

exports.prototype.$benchmark = false;

exports.prototype.name = "POSTGRESQL"

exports.prototype.connect = function(callback) {
    if (this.$benchmark) var s = Date.now();
    pg.connect(this.options.connect, afterConnect.bind(this));

    function afterConnect(error, client, done) {
        if (this.$benchmark) console.log("BENCHMARK storage/NodePg connect took "+(Date.now()-s)+" ms");
        if (!client)
            error = new Error("unable to create pg client");
        this.$client = client;
        this.$done = done;
        callback && callback(error);
    }
}

exports.prototype.disconnect = function(callback) {
    this.$done && this.$done();
    callback && callback(null);
}

// INFO Type operation

// TODO Delete old types
// TODO Insert all types in one query
exports.prototype.updateTypes = function(types, callback) {
    var rows, count, i;
    rows = new Array();
    count = types.length;
    for (i=0; i<types.length; i++) {
        this.$client.query("INSERT INTO types (name) "+
            "SELECT $1 WHERE NOT EXISTS (SELECT name FROM types WHERE name=$2) "+
            "RETURNING tid,name",
            [types[i], types[i]],
        afterInsertQuery);
    }

    function afterInsertQuery(error, result) {
        if (error) {
            count = -1;
            callback(error, null);
        }
        else if (count >= 0) {
            if (result.rows[0])
                rows.push(result.rows[0]);
            if (--count <= 0)
                callback(null, rows);
        }
    }
}

// INFO Pod operation

exports.prototype.createPod = function(values, callback) {
    this.$client.query("INSERT INTO pods (url) "+
        "VALUES ($1) "+
        "RETURNING pid,url",
        [values['url']],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.readPod = function(pid_url, callback) {
    this.$client.query("SELECT pid,url,nid,encode(auth,'base64') AS auth "+
        "FROM pods "+
        "WHERE "+(typeof(pid_url) == "number" ? "pid" : "url")+"=$1",
        [pid_url],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.updatePod = function(values, callback) {
    this.$client.query("UPDATE pods "+
        "SET nid=$1, auth=decode($2,'base64') "+
        "WHERE pid=$3 "+
        "RETURNING pid,url,nid,encode(auth,'base64') AS auth",
        [values['nid'], values['auth'], values['pid']],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.deletePod = function(pid, callback) {
    this.$client.query("DELETE FROM pods "+
        "WHERE pid=$1 "+
        "RETURNING pid",
        [pid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.resolvePodFromDomain = function(did, callback) {
    this.$client.query("SELECT p.pid,p.url,p.nid,encode(p.auth,'base64') AS auth "+
        "FROM pods p JOIN domains d ON p.pid=d.pid "+
        "WHERE did=$1",
        [did],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.resolvePodFromInvitation = function(iid, callback) {
    this.$client.query("SELECT p.pid,p.url,p.nid,encode(p.auth,'base64') AS auth "+
        "FROM pods p JOIN domains d ON p.pid=d.pid JOIN invitations i ON d.did=i.did "+
        "WHERE i.iid=decode($1,'base64')",
        [iid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Node operations

exports.prototype.createNode = function(values, callback) {
    this.$client.query("INSERT INTO nodes (namespace,pid,auth) "+
        "VALUES ($1,$2,decode($3,'base64')) "+
        "RETURNING nid, namespace, pid, encode(auth,'base64') AS auth",
        [values['namespace'], values['pid'], values['auth']],
    afterQuery.bind(this));

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.readNode = function(nid, callback) {
    this.$client.query("SELECT nid,namespace,pid,encode(auth,'base64') AS auth "+
        "FROM nodes "+
        "WHERE nid=$1",
        [nid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.deleteNode = function(nid, callback) {
    this.$client.query("DELETE FROM nodes "+
        "WHERE nid=$1 "+
        "RETURNING nid",
        [nid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Namespace operations

exports.prototype.createNamespace = function(name, types, callback) {
    var count, errors;
    this.$client.query("CREATE SCHEMA \""+name+"\"", afterCreateQuery.bind(this));

    function afterCreateQuery(error, result) {
        if (error)
            return cleanupAfterError.call(this, error);
        this.$client.query("CREATE TABLE \""+name+"\".domains "+
            "(did INTEGER PRIMARY KEY)",
        afterDomainQuery.bind(this));
    }

    function afterDomainQuery(error, result) {
        if (error)
            return cleanupAfterError.call(this, error);
        this.$client.query("CREATE TABLE \""+name+"\".invitations "+
            "(iid BYTEA PRIMARY KEY, did INTEGER NOT NULL REFERENCES \""+name+"\".domains ON UPDATE CASCADE ON DELETE CASCADE, ikey BYTEA NOT NULL, tflags INTEGER NOT NULL, timestamp TIMESTAMP NOT NULL)",
        afterInvitationQuery.bind(this));
    }

    function afterInvitationQuery(error, result) {
        if (error)
            return cleanupAfterError.call(this, error);
        this.$client.query("CREATE TABLE \""+name+"\".tickets "+
            "(tid SERIAL PRIMARY KEY, did INTEGER NOT NULL REFERENCES \""+name+"\".domains ON UPDATE CASCADE ON DELETE CASCADE, tkey BYTEA NOT NULL, tflags INTEGER NOT NULL, tdata TEXT)",
        afterTicketQuery.bind(this));
    }

    function afterTicketQuery(error) {
        var type, columns, column;
        if (error)
            return cleanupAfterError.call(this, error);
        errors = new Array();
        count = 0;
        for (type in types) {
            columns = "eid INTEGER PRIMARY KEY, did INTEGER NOT NULL REFERENCES \""+name+"\".domains ON UPDATE CASCADE ON DELETE CASCADE";
            for (column in types[type])
                columns += ", "+column+" "+types[type][column];
            this.$client.query("CREATE TABLE \""+name+"\".entity_"+type+" "+
                "("+columns+")",
            afterTypeQuery.bind(this));
            count++;
        }
    }

    function afterTypeQuery(error) {
        if (error)
            errors.push(error);
        if (--count == 0) {
            if (errors.length)
                cleanupAfterError.call(this, errors);
            else
                callback(null);
        }
    }

    function cleanupAfterError(error) {
        this.$client.query("DROP SCHEMA IF EXISTS \""+name+"\" CASCADE", function(err) {
            // NOTE Simply logging the error is probably not the best way to handle it ;)
            if (err)
                console.error(err);
            callback(error);
        });
    }
}

exports.prototype.deleteNamespace = function(name, types, callback) {
    this.$client.query("DROP SCHEMA IF EXISTS \""+name+"\" CASCADE", afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Alias operations

exports.prototype.readAlias = function(alias, callback) {
    this.$client.query("SELECT aid,encode(asalt,'base64') AS asalt,encode(vault,'base64') AS vault,encode(vec,'base64') AS vec,modified "+
        "FROM accounts "+
        "WHERE alias=decode($1,'base64')",
        [alias],
    afterQuery);

    function afterQuery(error, result) {
        if (error)
            return callback(error, null);
        if (result.rows[0])
            result.rows[0]['modified'] = parseInt(result.rows[0]['modified']);
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Account operations

exports.prototype.createAccount = function(values, callback) {
    this.$client.query("INSERT INTO accounts (alias,auth,asalt, modified) "+
        "VALUES (decode($1,'base64'),decode($2,'base64'),decode($3,'base64'), $4) "+
        "RETURNING aid,encode(asalt,'base64') AS asalt,modified",
        [values['alias'], values['auth'], values['asalt'], values['modified']],
    afterQuery);

    function afterQuery(error, result) {
        if (error)
            return callback(error, null);
        if (result.rows[0])
            result.rows[0]['modified'] = parseInt(result.rows[0]['modified']);
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.readAccount = function(aid, callback) {
    this.$client.query("SELECT aid,encode(auth,'base64') AS auth,encode(vault,'base64') AS vault,encode(vec,'base64') AS vec,modified "+
        "FROM accounts "+
        "WHERE aid=$1",
        [aid],
    afterQuery);

    function afterQuery(error, result) {
        if (error)
            return callback(error, null);
        if (result.rows[0])
            result.rows[0]['modified'] = parseInt(result.rows[0]['modified']);
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.updateAccount = function(values, callback) {
    var params, set, field;
    params = [values['aid']];
    set = [];
    for (field in values) {
        switch (field) {
            case "aid":
                break;
            case "alias":
            case "auth":
            case "asalt":
            case "vault":
            case "vec":
                params.push(values[field]);
                set.push(field+"=decode($"+params.length+", 'base64')");
                break;
            case "modified":
                params.push(values[field]);
                set.push(field+"=$"+params.length);
                break;
        }
    }
    this.$client.query("UPDATE accounts SET "+set+" WHERE aid=$1 "+
        "RETURNING aid,encode(auth,'base64') AS auth,encode(vault,'base64') AS vault,encode(vec,'base64') AS vec,modified ",
    params, afterQuery);

    function afterQuery(error, result) {
        if (error)
            return callback(error, null);
        if (result.rows[0])
            result.rows[0]['modified'] = parseInt(result.rows[0]['modified']);
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

// TODO Check for SQL injection!
exports.prototype.createDomain = function(values, callback) {
    var table = "\""+this.options['namespace']+"\".domains";
    this.$client.query("INSERT INTO "+table+" (did) "+
        "VALUES ($1) "+
        "RETURNING did",
        [values['did']],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.readDomain = function(did, callback) {
    var table = "\""+this.options['namespace']+"\".domains";
    this.$client.query("SELECT did "+
        "FROM "+table+" "+
        "WHERE did=$1 ",
        [did],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.deleteDomain = function(did, callback) {
    var table = "\""+this.options['namespace']+"\".domains";
    this.$client.query("DELETE FROM "+table+" "+
        "WHERE did=$1 "+
        "RETURNING did",
        [did],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Invitation operations

exports.prototype.registerInvitation = function(values, callback) {
    this.$client.query("INSERT INTO invitations (iid, did, timestamp) "+
        "VALUES (decode($1,'base64'), $2, CURRENT_TIMESTAMP) "+
        "RETURNING encode(iid,'base64') AS iid, did",
        [
            values['iid'],
            values['did']
        ],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

exports.prototype.unregisterInvitation = function(iid, callback) {
    this.$client.query("DELETE FROM invitations	"+
        "WHERE iid=decode($1,'base64') "+
        "RETURNING encode(iid,'base64') AS iid, did",
        [iid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.createInvitation = function(values, callback) {
    console.log(values);
    var table = "\""+this.options['namespace']+"\".invitations";
    this.$client.query("INSERT INTO "+table+" (iid, ikey, did, tflags, timestamp) "+
        "VALUES (decode($1,'base64'), decode($2,'base64'), $3, $4, CURRENT_TIMESTAMP) "+
        "RETURNING encode(iid,'base64') AS iid, encode(ikey,'base64') AS ikey, did, tflags",
        [values['iid'], values['ikey'], values['did'], values['tflags']],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.readInvitation = function(iid, callback) {
    var table = "\""+this.options['namespace']+"\".invitations";
    this.$client.query("SELECT encode(iid,'base64') AS iid, did, encode(ikey,'base64') AS ikey, tflags "+
        "FROM "+table+" "+
        "WHERE iid=decode($1,'base64') ",
        [iid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.deleteInvitation = function(iid, callback) {
    var table = "\""+this.options['namespace']+"\".invitations";
    this.$client.query("DELETE FROM "+table+" "+
        "WHERE iid=decode($1,'base64') "+
        "RETURNING encode(iid,'base64') AS iid",
        [iid],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]:null);
    }
}

// INFO Ticket operations

// TODO Check for SQL injection!
exports.prototype.createTicket = function(values, callback) {
    var table = "\""+this.options['namespace']+"\".tickets";
    this.$client.query("INSERT INTO "+table+" (did, tkey, tflags) "+
        "VALUES ($1,decode($2,'base64'), $3) "+
        "RETURNING tid, did, tflags",
        [values['did'], values['tkey'], values['tflags']],
    afterQuery.bind(this));

    function afterQuery(error, result) {
        if (error)
            return callback(error);
        callback(error||null, error?null:result.rows[0]);
    }
}

// TODO Check for SQL injection!
exports.prototype.readTickets = function(tids, did, callback) {
    var table = "\""+this.options['namespace']+"\".tickets";
    this.$client.query("SELECT tid, did, encode(tkey,'base64') AS tkey, tflags, tdata "+
        "FROM "+table+" "+
        "WHERE did=$1"+(tids?" AND tid IN ("+tids+")":""),
        [did],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.updateTickets = function(values, did, callback) {
    var table, field, set, fields, vals, val, i;
    table = "\""+this.options['namespace']+"\".tickets";
    set = new Array();
    fields = new Array();
    vals = new Array();
    for (field in values[0]) {
        set.push(field+"=v."+field);
        fields.push(field);
    }
    for (i = 0; i < values.length; i++) {
        val = ""
        for (field in values[i]) {
            // NOTE NodePG seems to escape numbers as strings when we
            //      use the parameterized form here.
            if (typeof values[i][field] == "string")
                val += ",'"+values[i][field]+"'";
            else
                val += ","+values[i][field];
        }
        vals.push("("+val.substr(1)+")");
    }
    this.$client.query("UPDATE "+table+" t SET "+set.join(",")+" "+
        "FROM (VALUES "+vals.join(",")+") AS v("+fields.join(",")+") "+
        "WHERE t.tid = v.tid "+
        "RETURNING *",
    afterQuery);
    
    function afterQuery(error, result) {
        callback(error||null, result?result.rows:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.deleteTickets = function(tids, did, callback) {
    console.log(did);
    var table = "\""+this.options['namespace']+"\".tickets";
    this.$client.query("DELETE FROM "+table+" "+
        "WHERE did=$1 AND tid IN ("+tids+") "+
        "RETURNING tid",
        [did],
    afterQuery);

    function afterQuery(error, result) {
        callback(error||null, result?result.rows:null);
    }
}

// INFO Entity operations

// TODO Check for SQL injection!
// TODO Handle multiple types
// TODO This onlyHard thingy is dirty as hell and just a workaround to prevent
//      the deletion of soft linked entities on the pod. The whole relation handling
//      needs a total workover ASAP!!!!!
exports.prototype.selectEntities = function(selector, did, callback, onlyHard) {
    var from, where;
    from = " FROM ";
    where = " WHERE ";
    for (var i=selector.length-1,r=0; i>=0; i--,r++) {
        if (r>0)
            from += "JOIN entities e"+r+" ON r"+(r-1)+".parent=e"+r+".eid JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
        else
            from += "entities e"+r+" JOIN types t"+r+" ON e"+r+".tid=t"+r+".tid ";
        if (selector[i].value == "*")
            where += "t"+r+".name='"+selector[i].key+(did?"' AND e"+r+".did="+did+" ":"' ");
        else
            where += "t"+r+".name='"+selector[i].key+"' AND e"+r+".eid IN ("+selector[i].value+") ";
        if (i>0) {
            from += "JOIN relations r"+r+" ON e"+r+".eid=r"+r+".child ";
            where += onlyHard ? "AND r"+r+".hard=true AND " : "AND "
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
        this.selectEntities(selector, did, afterSelectEntities.bind(this), true);
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

exports.prototype.reserveEntity = function(selector, did, callback) {
    // TODO Move this test into entity hook
    if (selector.length > 1)
        this.selectEntities(selector.slice(0, selector.length-1), did, afterSelectEntities.bind(this));
    else
        this.$client.query("SELECT count(eid) FROM entities WHERE did=$1", [did], afterDomainQuery.bind(this));

    function afterSelectEntities(error, rows) {
        if (error)
            return callback(error, null);
        if (rows.length == 0)
            return callback(null, null);
        this.$client.query("SELECT nextval('entities_eid_seq')", afterQuery);
    }

    function afterDomainQuery(error, result) {
        if (error)
            return callback(error, null);
        this.$client.query("SELECT nextval('entities_eid_seq')", afterQuery);
    }

    function afterQuery(error, result) {
        callback(error||null, result?result.rows[0]['nextval']:null);
    }
}

exports.prototype.registerEntity = function(selector, did, callback) {
    var entity;
    this.$client.query("INSERT INTO entities (eid, tid, did) "+
        "SELECT	$1, (SELECT tid FROM types WHERE name=$2), $3 "+
        "WHERE NOT EXISTS (SELECT eid FROM entities WHERE eid = $1) "+
        "RETURNING *",
        [
            selector.last.value,
            selector.last.key,
            did
        ],
    afterEntitiesQuery.bind(this));

    // TODO Fail for hard relations tha span over domain boarders
    function afterEntitiesQuery(error, result) {
        if (error)
            return callback(error, null);
        entity = result.rows[0]||null;
        if (selector.length > 1) {
            this.$client.query("INSERT INTO relations (parent, child, hard) "+
                "VALUES ($1, $2, $3) "+
                "RETURNING parent, child",
                [
                    selector[selector.length-2].value,
                    selector.last.value,
                    selector.hard
                ],
            afterRelationsQuery);
        }
        else {
            afterRelationsQuery(null, null);
        }
    }

    function afterRelationsQuery(error, result) {
        callback(error||null, entity);
    }
}

// TODO Check for SQL injection!
exports.prototype.unregisterEntities = function(selector, did, callback) {
    if (selector.length == 1) {
        this.$client.query("SELECT set_cascade_domain($1)", did, afterCascadeQuery.bind(this));
    }
    else {
        // NOTE I'm pretty sure that this might delete some relations by accident if the selector length
        // 		is greater than 2 or if there are multiple parents involved...
        this.$client.query("DELETE FROM relations "+
            "WHERE child IN ("+selector.last.value+") AND parent IN ("+selector[selector.length-2].value+")"+
            "RETURNING child AS eid",
        afterEntitiesQuery.bind(this));
    }

    // TODO Move this code into entity hook
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
        this.$client.query("DELETE FROM entities "+
            "WHERE eid IN ("+eids.join(",")+") "+
            "RETURNING eid",
        afterEntitiesQuery.bind(this));
    }

    function afterEntitiesQuery(error, result) {
        callback(error||null, error?null:result.rows);
    }
}

// TODO Check for SQL injection!
exports.prototype.createEntity = function(type, values, callback) {
    if (this.$benchmark) var s = Date.now();
    var table, fields, vals, params, field;
    table = "\""+this.options['namespace']+"\".entity_"+type;
    fields = new Array();
    vals = new Array();
    params = new Array();
    for (field in values) {
        fields.push(field);
        params.push(values[field]);
        vals.push("$"+params.length);
    }
    this.$client.query("INSERT INTO "+table+" ("+fields.join(",")+") "+
        "VALUES ("+vals.join(",")+") "+
        "RETURNING *",
        params,
    afterQuery.bind(this));

    function afterQuery(error, result) {
        if (this.$benchmark) console.log("BENCHMARK storage/NodePg createEntity took "+(Date.now()-s)+" ms");
        callback(error||null, result?result.rows[0]:null);
    }
}

// TODO Check for SQL injection!
exports.prototype.readEntities = function(types, eids, fields, callback) {
    if (this.$benchmark) var s = Date.now();
    var values, errors, count;
    fields = fields||"*";
    values = new Object();
    errors = new Array();
    types.forEach(readEntitiesForType.bind(this));

    function readEntitiesForType(type, index) {
        var table;
        table = "\""+this.options['namespace']+"\".entity_"+type;
        count = index;
        this.$client.query("SELECT "+fields+" FROM "+table+" WHERE eid IN ("+eids[index].join(",")+")", afterQuery.bind(this));

        function afterQuery(error, result) {
            if (error)
                errors.push(error);
            else
                values[type] = result.rows;
            if (--count < 0) {
                if (this.$benchmark) console.log("BENCHMARK storage/NodePg readEntities took "+(Date.now()-s)+" ms");
                callback(errors.length?errors:null, errors.length?null:values);
            }
        }
    }
}

// TODO Check for SQL injection!
exports.prototype.updateEntities = function(types, values, callback) {
    if (this.$benchmark) var s = Date.now();
    var rvalues, errors, count;
    rvalues = new Object();
    errors = new Array();
    types.forEach(updateEntitiesForType.bind(this));

    function updateEntitiesForType(type, index) {
        var table, field, set, fields, vals, val, params, i;
        table = "\""+this.options['namespace']+"\".entity_"+type;
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
            // NOTE The currently used SQL query casts all values to text. Until this is
            //      fixed we have to use explicit typecasting here.
            for (field in values[type][i]) {
                if (values[type][i][field] === null) {
                    // NOTE Works only if automatic typecasting from integer to boolean is activated.
                    //      This may have sideeffects: https://dba.stackexchange.com/a/46199
                    val += ",NULL::integer";
                }
                else {
                    params.push(values[type][i][field]);
                    switch (typeof values[type][i][field]) {
                        case "number":
                            if (values[type][i][field]%1 === 0)
                                // NOTE I'm pretty sure the differentiation between bigint and integer
                                //      is broken for negative values near -0xFFFF ;)
                                val += ",$"+params.length+(Math.abs(values[type][i][field])>0xFFFF ? "::bigint" : "::integer");
                            else
                                val += ",$"+params.length+"::real";
                            break;
                        case "boolean":
                            val += ",$"+params.length+"::boolean";
                            break;
                        default:
                            val += ",$"+params.length;
                    }
                }
            }
            vals.push("("+val.substr(1)+")");
        }
        this.$client.query("UPDATE "+table+" t SET "+set.join(",")+" "+
            "FROM (VALUES "+vals.join(",")+") AS v("+fields.join(",")+") "+
            "WHERE t.eid = v.eid "+
            "RETURNING t.eid,t.did",
            params,
        afterQuery.bind(this));

        function afterQuery(error, result) {
            if (error)
                errors.push(error);
            else
                rvalues[type] = result.rows;
            if (--count < 0) {
                if (this.$benchmark) console.log("BENCHMARK storage/NodePg updateEntities took "+(Date.now()-s)+" ms");
                callback(errors.length?errors:null, errors.length?null:rvalues);
            }
        }
    }
}

// TODO Check for SQL injection!
exports.prototype.deleteEntities = function(types, eids, fields, callback) {
    if (this.$benchmark) var s = Date.now();
    var values, errors, count;
    fields = fields||"*";
    values = new Object();
    errors = new Array();
    types.forEach(deleteEntitiesForType.bind(this));

    function deleteEntitiesForType(type, index) {
        var table;
        table = "\""+this.options['namespace']+"\".entity_"+type;
        count = index;
        this.$client.query("DELETE FROM "+table+" WHERE eid IN ("+eids[index].join(",")+") RETURNING "+fields, afterQuery.bind(this));

        function afterQuery(error, result) {
            if (error)
                errors.push(error);
            else
                values[type] = result.rows;
            if (--count < 0) {
                if (this.$benchmark) console.log("BENCHMARK storage/NodePg deleteEntities took "+(Date.now()-s)+" ms");
                callback(errors.length?errors:null, errors.length?null:values);
            }
        }
    }
}
