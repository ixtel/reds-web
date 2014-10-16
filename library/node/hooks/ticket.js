"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
	var route;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.selector[0].value);

	function onRouteReady() {
		route.method = "POST";
		route.path = "/!/domain/"+session.selector[0].value+"/ticket";
		route.sendJson(session.requestJSON);
	}

	function onRouteResponse() {
		session.writeJSON(route.responseJson);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}
