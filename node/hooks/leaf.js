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
		route.path = "/!/domain/"+session.selector[0].value+"/leaf";
		route.write(session.requestText, session.request.headers['content-type']);
		route.requestHeaders['authorization'] = session.request.headers['authorization'];
		route.send();
	}

	function onRouteResponse() {
		session.write(route.responseText, route.responseHeaders['content-type']);
		session.response.setHeader("Authorization", route.responseHeaders['authorization']);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}
