"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
	session.end();
	var route, domain;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.init(session.requestJSON['pod']);

	function onRouteReady() {
		session.storage.registerDomain({
			'pid': route.pod['id']
		}, afterRegisterDomain);
	}

	function afterRegisterDomain(error, result) {
		if (error)
			return session.abort(error);
		// NOTE We don't want to modify requestJSON so we create our own JSON object here
		domain = JSON.parse(session.requestText);
		domain['did'] = result['did'];
		route.method = "POST";
		route.path = "/!/domain/"+domain['did'];
		route.sendJson(domain);
	}

	function onRouteResponse() {
		session.writeJSON(route.responseJson);
		session.end();
	}

	function onRouteError(error) {
		if (domain)
			session.storage.deleteDomain(domain['did'], function() {
				session.abort(new HttpError(502, error.message));
			});
		else
			session.abort(new HttpError(502, error.message));
	}
}
