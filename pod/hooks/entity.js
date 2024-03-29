"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
    if (session.selector.length != 1)
        return session.abort(new HttpError(400, "invalid url depth"));
    if (session.selector.last.key.match(/[^\w]/))
        return session.abort(new HttpError(400, "invalid url type"));
    if (session.selector.last.value.match(/[^\d]/))
        return session.abort(new HttpError(400, "invalid url id"));
    session.authorizeStream(afterAuthorization);

    function afterAuthorization(error) {
        var values;
        if (error)
            return session.abort(error);
        if (session.selector.query == "relation") {
            // TODO Read entity
            afterCreateEntity(null, null);
        }
        else {
            // NOTE We don't want to modify requestEncrypted so we clone it
            values = JSON.parse(JSON.stringify(session.requestEncrypted));
            console.log(values);
            values['eid'] = session.selector[0].value;
            values['did'] = session.type.options['did'];
            session.storage.createEntity(session.selector.last.key, values, afterCreateEntity);
        }
    }

    function afterCreateEntity(error, result) {
        if (error !== null) {
            // TODO Error type should be returned by storage facility
            switch (error.code) {
                case "23505":
                    return session.abort(new HttpError(409, "eid already exists"));
                default:
                    return session.abort(error);
            }
        }
        session.writeEncrypted(result);
        session.signStream();
        session.end();
    }
}

exports.GET = function(session) {
    if (session.$benchmark) console.log("BENCHMARK entity/get start "+(Date.now()-session.$s)+" ms");
    if (session.selector.last.key == null)
        return 
    if (session.selector.length != 1)
        return session.abort(new HttpError(400, "invalid url depth"));
    if (session.selector.last.key.match(/[^\w,]|,,/))
        return session.abort(new HttpError(400, "invalid url types"));
    if (session.selector.last.value && session.selector.last.value.match(/[^\d,;]|,,|;;/))
        return session.abort(new HttpError(400, "invalid url ids"));
    session.authorizeStream(afterAuthorization);

    function afterAuthorization(error) {
        if (session.$benchmark) console.log("BENCHMARK entity/get afterAuthorization() start "+(Date.now()-session.$s)+" ms");
        var types, eids, fields, i;
        if (error)
            return session.abort(error);
        // NOTE Return empty response if URL contains no eids
        if (session.selector.last.value == null)
            return afterReadEntities(null, undefined);
        types = session.selector.last.key.split(",");
        eids = session.selector.last.value.split(";");
        if (types.length != eids.length)
            return session.abort(new HttpError(400, "url types and ids mismatch"));
        for (i=0; i<eids.length; i++)
            eids[i] = eids[i].split(",");
        if ((fields = session.selector.query) && (fields = session.selector.query.match(/(?:^|&)fields=([\w,]+)(?:&|$)$/)))
            fields = fields[1].split(",");
        session.storage.readEntities(types, eids, fields, afterReadEntities);
    }

    function afterReadEntities(errors, result) {
        if (session.$benchmark) console.log("BENCHMARK entity/get afterReadEntities() start "+(Date.now()-session.$s)+" ms");
        if (errors !== null)
            return session.abort(errors[0]);
        if (result && result.length == 0)
            return session.abort(new HttpError(404, "entities not found"));
        session.writeEncrypted(result);
        session.signStream();
        session.end(result?200:204);
    }
}

exports.PUT = function(session) {
    if (session.$benchmark) console.log("BENCHMARK entity/put start "+(Date.now()-session.$s)+" ms");
    if (session.selector.length != 1)
        return session.abort(new HttpError(400, "invalid url depth"));
    if (session.selector.last.key.match(/[^\w,]|,,/))
        return session.abort(new HttpError(400, "invalid url types"));
    if (session.selector.last.value.match(/[^\d,;]|,,|;;/))
        return session.abort(new HttpError(400, "invalid url ids"));
    session.authorizeStream(afterAuthorization);

    function afterAuthorization(error) {
        if (session.$benchmark) console.log("BENCHMARK entity/put afterAuthorization() start "+(Date.now()-session.$s)+" ms");
        var types, eids, values, fields, i, j;
        if (error)
            return session.abort(error);
        types = session.selector.last.key.split(",");
        eids = session.selector.last.value.split(";");
        values = session.requestEncrypted;
        if (types.length != eids.length)
            return session.abort(new HttpError(400, "url types and ids mismatch"));
        if (types.length != Object.keys(values).length)
            return session.abort(new HttpError(400, "body and url types mismatch"));
        for (i = 0; i < types.length; i++) {
            eids[i] = eids[i].split(",");
            if (!values[types[i]])
                return session.abort(new HttpError(400, "body and url types mismatch"));
            if (eids[i].length != values[types[i]].length)
                return session.abort(new HttpError(400, "body and url ids mismatch"));
            for (j = 0; j < values[types[i]].length; j++) 
                if (eids[i].indexOf(values[types[i]][j]['eid'].toString()) == -1)
                    return session.abort(new HttpError(400, "body and url ids mismatch"));
        }
        session.storage.updateEntities(types, values, afterUpdateEntities);
    }

    function afterUpdateEntities(error, result) {
        if (session.$benchmark) console.log("BENCHMARK entity/put afterUpdateEntities() start "+(Date.now()-session.$s)+" ms");
        if (error !== null)
            return session.abort(error);
        if (result.length == 0)
            return session.abort(new HttpError(404, "entities not found"));
        session.writeEncrypted(result);
        session.signStream();
        session.end();
    }
}

exports.DELETE = function(session) {
    if (session.selector.length != 1)
        return session.abort(new HttpError(400, "invalid url depth"));
    if (session.selector.last.key.match(/[^\w,]|,,/))
        return session.abort(new HttpError(400, "invalid url types"));
    if (session.selector.last.value.match(/[^\d,;]|,,|;;/))
        return session.abort(new HttpError(400, "invalid url ids"));
    session.authorizeStream(afterAuthorization);

    function afterAuthorization(error) {
        var types, eids, values, fields, i, j;
        if (error)
            return session.abort(error);
        types = session.selector.last.key.split(",");
        eids = session.selector.last.value.split(";");
        if (types.length != eids.length)
            return session.abort(new HttpError(400, "url types and ids mismatch"));
        for (i=0; i<eids.length; i++)
            eids[i] = eids[i].split(",");
        if ((fields = session.selector.query) && (fields = session.selector.query.match(/(?:^|&)fields=([\w,]+)(?:&|$)$/)))
            fields = fields[1].split(",");
        if (session.selector.query && session.selector.query.match(/(?:^|&)relation(?:&|$)/))
            session.storage.readEntities(types, eids, fields, afterDeleteEntities);
        else
            session.storage.deleteEntities(types, eids, fields, afterDeleteEntities);
    }

    function afterDeleteEntities(errors, result) {
        if (errors !== null)
            return session.abort(errors[0]);
        if (result.length == 0)
            return session.abort(new HttpError(404, "entities not found"));
        session.writeEncrypted(result);
        session.signStream();
        session.end();
    }
}
