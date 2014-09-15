
module.exports = exports = function(crypto, storage) {
}

exports.prototype.init = function(pod, callback) {
	callback(null);
}

exports.prototype.sendJson = function(data, callback) {
	this.responseJson = data;
	callback(null);
}
