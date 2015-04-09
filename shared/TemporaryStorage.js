"use strict";

module.exports = exports = function(ttl, ttd) {
    this.$deleteItem = this.$deleteItem.bind(this);

    this.$timeouts = new Object();
    this.ttl = ttl; // NOTE Time to live (ms until an untuched item will be deleted)
    this.ttd = ttd; // NOTE Time to die (ms between remove call and deletion of the item)
    this.items = new Object();
}

// BTOS
exports.prototype.$deleteItem = function(key) {
    delete this.items[key];
}

exports.prototype.setItem =  function(key, value) {
    this.touchItem(key);
    this.items[key] = value;
}

exports.prototype.getItem = function(key) {
    this.touchItem(key);
    return this.items[key];
}

exports.prototype.touchItem = function(key) {
    if (this.$timeouts[key])
        clearTimeout(this.$timeouts[key]);
    if (this.items[key])
        this.$timeouts[key] = setTimeout(this.$deleteItem, this.ttl, key);
}

exports.prototype.deleteItem = function(key) {
    if (this.$timeouts[key])
        clearTimeout(this.$timeouts[key]);
    if (this.items[key])
        setTimeout(this.$deleteItem, this.ttd, key);
}
