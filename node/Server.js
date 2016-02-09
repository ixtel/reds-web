"use strict";

var path = require("path");
var Server = require("../shared/Server");
var NodeSession = require("./Session");

module.exports = exports = function(config) {
    Server.call(this, config);
    this.config.types = require((this.config.types[0]=="/" ? "" : path.dirname(this.$cfgfile)+"/")+this.config.types);
}

exports.prototype = Object.create(Server.prototype);

exports.prototype.$enableBenchmarks = function() {
    Server.prototype.$enableBenchmarks.call(this);
    NodeSession.prototype.$benchmark = true;
}

exports.prototype.setup = function() {
    var storage;
    storage = this.createStorageFacility(this.config.storage.name, this.config.storage.options);
    storage.connect(afterConnect.bind(this));

    function afterConnect(error) {
        if (error)
            throw error;
        storage.updateTypes(Object.keys(this.config.types), afterUpdateTypes.bind(this))	
    }

    function afterUpdateTypes(error, rows) {
        var i;
        if (error)
            throw error;
        for (i=0; i<rows.length; i++)
            console.info("MASTER "+process.pid+" added type '"+rows[i]['name']+"'");
        storage.disconnect(afterDisconnect.bind(this));
    }

    function afterDisconnect(error) {
        if (error)
            throw error;
        Server.prototype.setup.call(this);
    }
}

exports.prototype.listen = function(request, response) {
    Server.prototype.listen.call(this, request, response);
    var session = new NodeSession(this, request, response);
    session.run();
}
