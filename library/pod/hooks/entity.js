"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	var values;
	// NOTE We don't want to modify requestJSON so we create our own JSON object here
	values = JSON.parse(session.requestText);
	values['eid'] = session.purl[0].value;
	values['did'] = session.ptype.options['did'];
	session.storage.createEntity(session.purl[0].key, values, afterCreateEntity);

	function afterCreateEntity(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "eid already exists"));
				default:
					return session.abort(error);
			}
		}
		session.writeJSON(result);
		session.end();
	}
}
