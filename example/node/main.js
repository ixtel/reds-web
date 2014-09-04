var NodeServer = require("../../library/node/Server");
var config = require("./config.json");

var server = new NodeServer(config);
server.run();
