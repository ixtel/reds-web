var NodeServer = require("../../library/node/Server");
var NodeSession = require("../../library/node/Session");
var config = require("./config.json");

var MySession = function(config, request, response) {
	NodeSession.call(this, config, request, response);

	console.log("MySession");
	for (var prop in MySession.prototype.StorageFacilities)
		console.log(prop);
	console.log("NodeSession");
	for (var prop in NodeSession.prototype.StorageFacilities)
		console.log(prop);
}

MySession.prototype = Object.create(NodeSession.prototype);

//MySession.prototype.registerStorageFacility(require("../../library/shared/crypto/cryptojs"));
//NodeSession.prototype.registerStorageFacility(require("../../library/shared/crypto/sjcl"));

var server = new NodeServer(config, MySession);
server.run();
