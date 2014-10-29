"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

function parseSelection(selection) {
	var result, type, tstr, estr, i;
	result = {
		'types': new Object(),
		'path': null
	};
	for (i=0; i<selection.length; i++) {
		if (!result.types[selection[i]['type']]) {
			result.types[selection[i]['type']] = new Array(selection[i]);
			result.types[selection[i]['type']].estr = selection[i]['eid'];
		}
		else {
			result.types[selection[i]['type']].push(selection[i]['eid']);
			result.types[selection[i]['type']].estr += ","+selection[i]['eid'];
		}
	}
	for (type in result.types) {
		tstr = (tstr ? tstr+"," : "/")+type;
		estr = (estr ? estr+";" : "/")+result.types[type].estr;
		delete result.types[type].estr;
	}
	result.path = tstr+estr;
	return result;
}

exports.POST = function(session) {
	var route;
	if (session.selector.last.value) {
		session.storage.registerEntity(session.selector, session.type.options['did'], afterRegisterEntity);
	}
	else {
		route = new Route(session.crypto, session.storage);
		route.addListener("error", onRouteError);
		route.addListener("ready", onRouteReady);
		route.addListener("response", onRouteResponse);
		route.resolve(session.type.options['did']);
	}

	function onRouteReady() {
		session.storage.reserveEntity(session.selector, session.type.options['did'], afterReserveEntity);
	}

	function afterReserveEntity(error, eid) {
		if (error)
			return session.abort(error);
		route.method = "POST";
		route.path = "/"+session.selector.last.key+"/"+eid;
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		var rselector;
		// NOTE This JSON dance is neccasary to create a real clone.
		rselector = JSON.parse(JSON.stringify(session.selector));
		rselector.last = rselector[rselector.length-1];
		rselector.last.value = route.responseJson['eid'];
		session.storage.registerEntity(rselector, session.type.options['did'], afterRegisterEntity);
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}

	function afterRegisterEntity(error, result) {
		if (error)
			return session.abort(error);
		// NOTE As long as we don't support mime multipart responses,
		//      the rsult of registerEntity can only be written when
		//      the route response hasn't been written already.
		if (!route) session.writeJSON(result);
		session.write(route.responseText, route.responseType);
		session.end();
	}
}

exports.HEAD = function(session) {
	session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);

	function afterSelectEntities(error, result) {
		var dids, i;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		dids = new Array();
		for (i=0; i<result.length; i++)
			dids.push(result[i]['did']);
		session.write(undefined, "application/x.reds.domain;did="+dids.join(","));
		session.end();
	}
}

exports.GET = function(session) {
	var route, selection;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);
	}

	function afterSelectEntities(error, result) {
		var types, eids, i, type;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		selection = parseSelection(result);
		route.method = "GET";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		// TODO Support multiple MIME types
		//session.write(route.responseText, route.responseType);
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}

exports.PUT = function(session) {
	var route, selection;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectEntities(session.selector, session.type.options['did'], afterSelectEntities);
	}

	function afterSelectEntities(error, result) {
		var types, eids, i, type;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		selection = parseSelection(result);
		route.method = "PUT";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		// TODO Support multiple MIME types
		//session.write(route.responseText, route.responseType);
		session.write(route.responseText, route.responseType);
		session.end();
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}
}

exports.DELETE = function(session) {
	var route, selection;
	route = new Route(session.crypto, session.storage);
	route.addListener("error", onRouteError);
	route.addListener("ready", onRouteReady);
	route.addListener("response", onRouteResponse);
	route.resolve(session.type.options['did']);

	function onRouteReady() {
		session.storage.selectCascade(session.selector, session.type.options['did'], afterSelectCascade);
	}

	function afterSelectCascade(error, result) {
		var types, eids, i, t;
		if (error)
			return session.abort(error);
		if (result.length == 0) {
			// NOTE Only return an error if the request asked for specific eids
			if (session.selector.last.value != "*")
				return session.abort(new HttpError(404, "entities not found"));
			else
				// TODO The 204 case should be handled by session end
				return session.abort(new HttpError(204, "empty response"));
		}
		selection = parseSelection(result);
		route.method = "DELETE";
		route.path = selection.path;
		route.write(session.requestText, session.request.headers['content-type']);
		route.send();
	}

	function onRouteResponse() {
		session.storage.unregisterEntities(session.selector, session.type.options['did'], afterUnregisterEntities);
	}

	function onRouteError(error) {
		session.abort(new HttpError(502, error.message));
	}

	function afterUnregisterEntities(error, result) {
		if (error)
			return session.abort(error);
		// TODO Support multiple MIME types
		//session.write(route.responseText, route.responseType);
		session.writeJSON(selection.types);
		session.end();
	}
}
