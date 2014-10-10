"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.GET = function(session) {
	// NOTE Convert alias in url from base64url to base64
	var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
	session.storage.readAlias(alias, afterReadAlias);

	function afterReadAlias(error, result) {
		if (error)
			return session.abort(error);
		if (!result)
			return session.abort(new HttpError(404, "alias not found"));
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var authN = session.crypto.generateKeypair();
	var auth = session.crypto.combineKeypair(authN.privateKey, session.requestJSON['auth_l']);
	// NOTE We don't want to modify requestJSON so we create our own JSON object here
	var values = JSON.parse(session.requestText);
	values['auth'] = auth;
	delete values['auth_l'];
	session.storage.createAccount(values, afterCreateAccount);

	function afterCreateAccount(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					return session.abort(new HttpError(409, "alias already exists"));
				default:
					return session.abort(error);
			}
		}
		result['auth_n'] = authN.publicKey;
		session.writeJSON(result);
		session.end();
	}
}

exports.PUT = function(session) {
	session.authorize(afterAuthorization);

	function afterAuthorization(error) { 
		if (error)
			return session.abort(error);
		// NOTE We don't want to modify requestJSON so we create our own JSON object here
		var values = JSON.parse(session.requestText);
		values['id'] = session.purl[0].value;
		session.storage.updateAccount(values, afterUpdateAccount);
	}
	
	function afterUpdateAccount(error, result) {
		if (error)
			return session.abort(error);
		if (!result)
			return session.abort(new HttpError(404, "account not found"));
		session.writeJSON(result);
		session.end();
	}
}

exports.DELETE = function(session) {
	session.authorize(afterAuthorization);

	function afterAuthorization(error) { 
		if (error)
			return session.abort(error);
		session.storage.deleteAccount(session.purl[0].value, afterDeleteAccount);
	}
	
	function afterDeleteAccount(error, result) {
		if (error)
			return session.abort(error);
		if (!result)
			return session.abort(new HttpError(404, "account not found"));
		session.end();
	}
}
