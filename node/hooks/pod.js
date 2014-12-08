"use strict";

var HttpError = require("../../shared/HttpError");

exports.POST = function(session) {
	session.storage.createPod(session.requestJson, afterCreatePod.bind(this));

	function afterCreatePod(error, result) {
		if (error) {
			// TODO Error type should be returned by storage facility
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "pod already exists"));
				default:
					return session.abort(error);
			}
		}
		session.writeJson(result);
		session.end();
	}
}
