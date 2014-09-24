"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.GET = function(session) {
	var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
	session.storage.readAccount(alias, afterReadAccount);

	function afterReadAccount(error, result) {
		if (error)
			throw error;
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var account = null;
	var route = new Route(session.crypto, session.storage);
	route.init(session.requestJSON['pod'], session.domain.intercept(afterInitRoute));

	function afterInitRoute() {
		var authN = session.crypto.generateKeypair();
		var auth = session.crypto.combineKeypair(authN.privateKey, session.requestJSON['auth_l']);
		var values = Object.create(session.requestJSON);
		values['pod'] = route.pod['id'];
		values['auth'] = auth;
		values['auth_n'] = authN.publicKey;
		values['auth_l'] = undefined;
		session.storage.createNodeAccount(values, session.domain.bind(afterCreateAccount));
	}

	function afterCreateAccount(error, result) {
		if (error !== null) {
			switch (error.code) {
				case "23505":
					throw new HttpError(409, "alias already exists");
				default:
					throw error;
			}
		}
		account = result;
		var values = new Object();
		values['id'] = account['id'];
		values['akey_l'] = session.requestJSON['akey_l'];
		route.method = "POST";
		route.path = "/!/account/"+account['id'];
		route.sendJson(values, session.domain.bind(afterRoute));
	}

	function afterRoute(error) {
		if (error) {
			return session.storage.deleteAccount(account['id'], function() {
				throw new HttpError(502, error.toString());
			});
		}
		account['akey_p'] = route.responseJson['akey_p'];
		account['check'] = route.responseJson['check'];
		session.writeJSON(account);
		session.end();
	}
}

exports.PUT = function(session) {
	session.writeJSON({
		'id': Math.floor(Math.random()*1000)
	});
	session.end();
}

exports.DELETE = function(session) {
	console.log("DELETE account");
	session.end();
}
