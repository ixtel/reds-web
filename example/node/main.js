var NodeServer = require("../../node/Server");
var config = require("./config.json");

var server = new NodeServer(config);
server.run();
