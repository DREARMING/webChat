module.exports = Utils;

function Utils() {
    if (!(this instanceof Utils)) return new Utils();
}

Utils.prototype.isEmpty = function(content) {
    if (content === undefined || content === "")  {
        return true;
    }
    return false;
};

Utils.prototype.rspStr = function(code, msg) {
    return JSON.stringify({code: code, msg: msg});
};

Utils.prototype.rspData = function(code, data) {
    return JSON.stringify({code: code, data: data});
};

Utils.prototype.rsp = function(code, data) {
    return {code: code, data: data};
};