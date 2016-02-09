"use strict";

var cluster = require("cluster");
var http = require("http");
var os = require("os");
var FacilityManager = require("./FacilityManager");
var CryptoNodejs = require("./crypto/NodeJs");
var StorageNodePg = require("./storage/NodePg");

var CryptoFacilities = new FacilityManager();
CryptoFacilities.addFacility(CryptoNodejs);

var StorageFacilities = new FacilityManager();
StorageFacilities.addFacility(StorageNodePg);

module.exports = exports = function(cfgfile) {
    this.$cfgfile = cfgfile;
    this.config = require(this.$cfgfile);
    this.httpd = null;

    if (this.config.workers == "cores")
        this.config.workers = os.cpus().length;
}

CryptoFacilities.addFactoryToObject("createCryptoFacility", exports.prototype);
StorageFacilities.addFactoryToObject("createStorageFacility", exports.prototype);

exports.prototype.$enableBenchmarks = function() {
    CryptoNodejs.prototype.$benchmark = true;
    StorageNodePg.prototype.$benchmark = true;
}

exports.prototype.run = function() {
    if (cluster.isMaster)
        this.setup();
    else
        this.connect();
}

exports.prototype.setup = function() {
    console.info("MASTER "+process.pid+" starting workers");
    for (var i = 0; i < this.config.workers; i++)
        cluster.fork();
}

exports.prototype.connect = function() {
    console.info("WORKER "+process.pid+" starting http server");
    this.httpd = http.createServer();
    this.httpd.listen(this.config.port, this.config.host);
    this.httpd.addListener("listening", onListening.bind(this));
    this.httpd.addListener("request", this.listen.bind(this));

    function onListening() {
        var addr = this.httpd.address();
        console.info("WORKER "+process.pid+" listening at "+addr.address+":"+addr.port);
        process.setgid(this.config.group);
        console.info("WORKER "+process.pid+" gid is now "+process.getgid());
        process.setuid(this.config.user);
        console.info("WORKER "+process.pid+" uid is now "+process.getuid());
        if (process.getuid() == 0)
            console.warn("WORKER "+process.pid+" process runs with root privileges!")
    }
}

exports.prototype.listen = function(request, response) {
    (this.config.log == "debug") && console.log("REQUEST "+request.method+" "+request.url+" (WORKER "+process.pid+")");
    response.setHeader("Pragma", "no-cache");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Expires", "-1");
}
