"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.GET = function(session) {
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		var alias = (new Buffer(session.purl[0].value, 'base64')).toString('base64');
		session.storage.readAccount(alias, session.domain.intercept(afterReadAccount));
	}

	function afterReadAccount(result) {
		if (result == null) {
			throw new HttpError(404, "alias not found");
		}
		session.writeJSON(result);
		session.end();
	}
}

exports.POST = function(session) {
	var accountId = null;
	var route = new Route(session.crypto, session.storage);
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		route.init(session.requestJSON['pod'], session.domain.intercept(afterInitRoute));
	}

	function afterInitRoute() {
		var authN = session.crypto.generateKeypair();
		var auth = session.crypto.combineKeypair(authN.privateKey, session.requestJSON['auth_l']);
		var values = Object.create(session.requestJSON);
		values['pod'] = route.podId;
		values['auth'] = auth;
		values['auth_n'] = authN.publicKey;
		session.storage.createAccount(values, session.domain.bind(afterCreateAccount));
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
		accountId = result['id'];
		var values = Object.create(session.requestJSON);
		values['id'] = result['id'];
		values['auth_n'] = result['auth_n'];
		values['auth_l'] = undefined;
		route.method = "POST";
		route.path = "/!/account/"+result['id'];
		route.sendJson(values, session.domain.bind(afterRoute));
	}

	function afterRoute(error) {
		if (error)
			return session.storage.deleteAccount(accountId, session.domain.intercept(afterDeleteAccount));
		session.writeJSON(route.responseJson);
		session.end();
	}

	function afterDeleteAccount() {
		throw new HttpError(502, "create account failed");
	}
}

exports.PUT = function(session) {
	console.log("PUT account");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.writeJSON({
			'id': Math.floor(Math.random()*1000)
		});
		session.end();
	}
}

exports.DELETE = function(session) {
	console.log("DELETE account");
	session.storage.connect(session.domain.intercept(afterConnect));

	function afterConnect() {
		session.end();
	}
}
