"use strict";

var HttpError = require("../../shared/HttpError");

// TODO Check for valid request data
exports.POST = function(session) {
	var values;
	// NOTE We don't want to modify requestJSON so we create our own JSON object here
	values = JSON.parse(session.requestText);
	values['eid'] = session.selector[0].value;
	values['did'] = session.type.options['did'];
	session.storage.createEntity(session.selector.last.key, values, afterCreateEntity);

	function afterCreateEntity(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "eid already exists"));
				default:
					return session.abort(error);
			}
		}
		// TODO Send domain data
		session.writeJSON(result, "application/x.reds.domain");
		session.end();
	}
}

// TODO Check for valid request data
exports.GET = function(session) {
	session.storage.readEntities(session.selector.last.key, session.selector.last.value.split(","), afterReadEntities);

	function afterReadEntities(error, result) {
		if (error !== null)
			return session.abort(error);
		if (result.length == 0)
			return session.abort(new HttpError(404, "entities not found"));
		// TODO Send domain data
		session.writeJSON(result, "application/x.reds.domain");
		session.end();
	}
}

// TODO Check for valid request data
exports.PUT = function(session) {
	// TODO Read eids from url instead from body
	//      [url1,url2,url3] => [body1,body2,body3]
	session.storage.updateEntities(session.selector.last.key, session.requestJSON, afterUpdateEntities);

	function afterUpdateEntities(error, result) {
		if (error !== null)
			return session.abort(error);
		if (result.length == 0)
			return session.abort(new HttpError(404, "entities not found"));
		// TODO Send domain data
		session.writeJSON(result, "application/x.reds.domain");
		session.end();
	}
}
