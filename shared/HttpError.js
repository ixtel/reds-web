(function(){
"use strict";

var HttpError = function(code, message, data) {
    Error.call(this);
    this.name = "REDS_HTTP_ERROR";
    this.code = code||500;
    this.message = message||"";
    this.data = data||null;
}

HttpError.prototype = Object.create(Error.prototype);

HttpError.prototype.toString = function() {
    return this.code+" ("+this.message+")";
}

// NOTE Export when loaded as a CommonJS module, add to global reds object otherwise.
typeof exports=='object' ? module.exports=exports=HttpError : (self.reds=self.reds||new Object()).HttpError = HttpError;

})();
