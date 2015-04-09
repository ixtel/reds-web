"use strict";

var TemporaryStorage = require("../shared/TemporaryStorage");

module.exports = exports = function() {
    // NOTE Remove unused streams after 30s, delay deletion by 5s 
    TemporaryStorage.call(this, 30000, 5000);

    this.$deleteTicket = this.$deleteTicket.bind(this);

    this.$tickets = new Object();
}

exports.prototype = Object.create(TemporaryStorage.prototype);

// BTOS
exports.prototype.$deleteItem = function(key) {
    var item;
    item = this.items[key];
    // NOTE Do nothing if the item has already been deleted
    if (item) {
        if (this.$tickets[item['tid']])
            delete this.$tickets[item['tid']][key];
    }
    TemporaryStorage.prototype.$deleteItem.call(this, key);
}

// BTOS
exports.prototype.$deleteTicket = function(tid) {
    console.log("$deleteTicket");
    var key;
    for (key in this.$tickets[tid])
        TemporaryStorage.prototype.$deleteItem.call(this, key);
    delete this.$tickets[tid];
}
    
exports.prototype.setItem =  function(key, value) {
    var item;
    TemporaryStorage.prototype.setItem.call(this, key, value);
    item = this.items[key];
    if (item['tid']) {
        if (! this.$tickets[item['tid']])
            this.$tickets[item['tid']] = new Object();
        this.$tickets[item['tid']][key] = item;
    }
}

exports.prototype.deleteTicket = function(tid) {
    console.log("deleteTicket");
    var key;
    for (key in this.$tickets[tid]) {
        if (this.$timeouts[key])
            clearTimeout(this.$timeouts[key]);
    }
    if (this.$tickets[tid])
        setTimeout(this.$deleteTicket, this.ttd, tid);
}
