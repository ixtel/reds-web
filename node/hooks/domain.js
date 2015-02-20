"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
    var route, domain;
    route = new Route(session.crypto, session.storage);
    route.addListener("error", onRouteError);
    route.addListener("ready", onRouteReady);
    route.addListener("response", onRouteResponse);
    route.init(session.requestJson['pod']);

    function onRouteReady() {
        session.storage.registerDomain({
            'pid': route.pod['pid']
        }, afterRegisterDomain);
    }

    function afterRegisterDomain(error, result) {
        if (error)
            return session.abort(error);
        domain = result;
        session.storage.registerInvitation({
            'iid': session.requestJson['iid'],
            'did': domain['did']
        }, afterRegisterInvitation.bind(this));
    }

    function afterRegisterInvitation(error, result) {
        if (error)
            return session.abort(error);
        route.method = "POST";
        route.path = "/!/domain/"+domain['did'];
        route.writeJson({
            'did': domain['did'],
            'iid': session.requestJson['iid'],
            'ikey_l': session.requestJson['ikey_l']
        });
        route.send();
    }

    function onRouteResponse() {
        session.write(route.responseText, route.responseHeaders['content-type']);
        session.response.setHeader("Authorization", route.responseHeaders['authorization']);
        session.end();
    }

    function onRouteError(error) {
        if (domain)
            session.storage.unregisterDomain(domain['did'], function() {
                session.abort(error);
            });
        else
            session.abort(error);
    }
}

exports.DELETE = function(session) {
    var route;
    route = new Route(session.crypto, session.storage);
    route.addListener("error", onRouteError);
    route.addListener("ready", onRouteReady);
    route.addListener("response", onRouteResponse);
    route.resolve(session.type.options['did']);

    function onRouteReady() {
        route.method = "DELETE";
        route.path = "/!/domain/"+session.type.options['did'];
        route.write(session.requestText, session.request.headers['content-type']);
        route.requestHeaders['authorization'] = session.request.headers['authorization'];
        route.send();
    }

    function onRouteResponse() {
        session.storage.unregisterDomain(session.type.options['did'], afterUnregisterDomain);
    }

    function afterUnregisterDomain(error, result) {
        session.write(route.responseText, route.responseHeaders['content-type']);
        session.response.setHeader("Authorization", route.responseHeaders['authorization']);
        session.end();
    }

    function onRouteError(error) {
        session.abort(error);
    }
}
