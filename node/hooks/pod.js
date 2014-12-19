"use strict";

var HttpError = require("../../shared/HttpError");
var Route = require("../Route");

exports.POST = function(session) {
    var route, authN;
    session.storage.createPod(session.requestJson, afterCreatePod.bind(this));

    function afterCreatePod(error, result) {
        if (error) {
            // TODO Error type should be returned by storage facility
            switch (error.code) {
                case "23505":
                    return session.abort(new HttpError(409, "pod already exists"));
                default:
                    return session.abort(error);
            }
        }

        authN = session.crypto.generateKeypair();
        route = new Route(session.crypto, session.storage);
        route.addListener("error", onRouteError);
        route.addListener("response", onRouteResponse);
        route.pod = result;
        route.method = "POST";
        route.path = "/!/node";
        route.writeJson({
            'pid': route.pod['pid'],
            'auth_n': authN.publicKey,
            'namespace': session.config.namespace,
            'types': session.config.types
        });
        route.send();
    }

    function onRouteResponse() {
        var auth = session.crypto.combineKeypair(authN.privateKey, route.responseJson['auth_p']);
        session.storage.updatePod({
            'pid': route.pod['pid'],
            'nid': route.responseJson['nid'],
            'auth': auth
        }, afterUpdatePod.bind(this));
    
        function afterUpdatePod(error, result) {
            if (error)
                return session.abort(error);
            session.writeJson({
                'pid': result['pid'],
                'url': result['url']
            });
            session.end();
        }
    }

    function onRouteError(error) {
        if (route.pod)
            session.storage.deletePod(route.pod['pid'], function() {
                session.abort(new HttpError(502, error.message));
            });
        else
            session.abort(new HttpError(502, error.message));
    }
}
