"use strict";

module.exports = exports = function(ttl, ttd) {
	this.ttl = ttl;
	this.ttd = ttd;
	this.items = new Object();
	this.timeouts = new Object();
}

exports.$delete = function(items, key) {
	delete items[key];
}

exports.prototype.setItem =  function(key, values) {
	this.touchItem(key);
	this.items[key] = values;
}

exports.prototype.getItem = function(key) {
	this.touchItem(key);
	return this.items[key];
}

exports.prototype.touchItem = function(key) {
	if (this.timeouts[key])
		clearTimeout(this.timeouts[key]);
	this.timeouts[key] = setTimeout(this.$delete, this.ttl, this.items, key);
}

exports.prototype.removeItem = function(key) {
	if (this.timeouts[key])
		clearTimeout(this.timeouts[key]);
	this.timeouts[key] = setTimeout(this.$delete, this.ttd, this.items, key);
}
