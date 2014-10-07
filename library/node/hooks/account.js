"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.GET = function(session) {
	// NOTE Convert alias in url from base64url to base64
	var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
	session.storage.readAccount(alias, afterReadAccount);

	function afterReadAccount(error, result) {
		if (error)
			return session.abort(error);
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var account = null;
	var authN = session.crypto.generateKeypair();
	var route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.init(session.requestJSON['pod']);

	function onRouteReady() {
		var auth = session.crypto.combineKeypair(authN.privateKey, session.requestJSON['auth_l']);
		var values = Object.create(session.requestJSON);
		values['pod'] = route.pod['id'];
		values['auth'] = auth;
		values['auth_n'] = authN.publicKey;
		values['auth_l'] = undefined;
		session.storage.createNodeAccount(values, afterCreateAccount);

		function afterCreateAccount(error, result) {
			if (error !== null) {
				switch (error.code) {
					case "23505":
						return session.abort(new HttpError(409, "alias already exists"));
					default:
						return session.abort(error);
				}
			}
			account = result;
			account['auth_n'] = authN.publicKey;
			var values = new Object();
			values['id'] = account['id'];
			values['akey_l'] = session.requestJSON['akey_l'];
			route.method = "POST";
			route.path = "/!/account/"+account['id'];
			route.sendJson(values);
		}
	}

	function onRouteResponse() {
		account['akey_p'] = route.responseJson['akey_p'];
		account['psalt'] = route.responseJson['psalt'];
		session.writeJSON(account);
		session.end();
	}

	function onRouteError(error) {
		if (account)
			session.storage.deleteAccount(account['id'], function() {
				session.abort(new HttpError(502, error.message));
			});
		else
			session.abort(new HttpError(502, error.message));
	}
}

// TODO Check request signature
// TODO Route encrypted data to pod
exports.PUT = function(session) {
	var values = Object.create(session.requestJSON);
	values['id'] = session.purl[0].value;
	session.storage.updateAccount(values, afterUpdateAccount);
	
	function afterUpdateAccount(error, result) {
		if (error)
			return session.abort(error);
		session.writeJSON(result);
		session.end();
	}
}

exports.DELETE = function(session) {
	console.log("DELETE account");
	session.end();
}
