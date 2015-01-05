"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
    var route, iid;
    route = new Route(session.crypto, session.storage);
    route.addListener("error", onRouteError);
    route.addListener("ready", onRouteReady);
    route.addListener("response", onRouteResponse);
    route.resolve(session.type.options['did']);

    function onRouteReady() {
        route.method = "POST";
        route.path = "/!/invitation/"+session.selector.last.value;
        route.write(session.requestText, session.request.headers['content-type']);
        route.requestHeaders['authorization'] = session.request.headers['authorization'];
        route.send();
    }

    function onRouteResponse() {
        session.storage.registerInvitation({
            // NOTE Convert iid in url from base64url to base64
            'iid': (new Buffer(session.selector.last.value, 'base64')).toString('base64'),
            'did': session.type.options['did']
        }, afterRegisterInvitation.bind(this));
    }

    function afterRegisterInvitation(error, result) {
        if (error)
            session.abort(error);
        session.write(route.responseText, route.responseHeaders['content-type']);
        session.response.setHeader("Authorization", route.responseHeaders['authorization']);
        session.end();
    }

    function onRouteError(error) {
        session.abort(error);
    }
}

exports.PUT = function(session) {
    var iid, route;
    // NOTE Convert iid in url from base64url to base64
    iid = (new Buffer(session.selector.last.value, 'base64')).toString('base64');
    route = new Route(session.crypto, session.storage);
    route.addListener("error", onRouteError);
    route.addListener("ready", onRouteReady);
    route.addListener("response", onRouteResponse);
    route.resolve(iid);

    function onRouteReady() {
        route.method = "PUT";
        route.path = "/!/invitation/"+session.selector.last.value;
        route.write(session.requestText, session.request.headers['content-type']);
        route.requestHeaders['authorization'] = session.request.headers['authorization'];
        route.send();
    }

    function onRouteResponse() {
        session.storage.unregisterInvitation(iid, afterUnregisterInvitation);
    }

    function afterUnregisterInvitation(error, result) {
        if (error != null)
            session.abort(error);
        session.write(route.responseText, route.responseHeaders['content-type']);
        session.response.setHeader("Authorization", route.responseHeaders['authorization']);
        session.end();
    }

    function onRouteError(error) {
        session.abort(error);
    }
}
