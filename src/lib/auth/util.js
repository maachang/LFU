//////////////////////////////////////////////
// auth用ユーティリティ.
//////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// crypto.
const crypto = frequire('crypto');

// nullチェック.
const isNull = function(value) {
    return (value == undefined || value == null);
}

// 文字列が存在するかチェック.
// s 文字列を設定します.
// 戻り値: trueの場合、文字列が存在します.
const useString = (function() {
    const _USE_STR_REG = /\S/g;
    return function(str) {
        let s = str;
        if (isNull(s)) {
            return false;
        }
        if (typeof(s) != "string") {
            if (!isNull(s["length"])) {
                return s["length"] != 0;
            }
            s = "" + s;
        }
        return s.match(_USE_STR_REG) != undefined;
    }
})();

// 数字変換が可能かチェック.
const isNumeric = (function() {
    const _IS_NUMERIC_REG = /[^0-9.0-9]/g;
    return function(num){
        let n = "" + num;
        if (num == null || num == undefined) {
            return false;
        } else if(typeof(num) == "number") {
            return true;
        } else if(n.indexOf("-") == 0) {
            n = n.substring(1);
        }
        return !(n.length == 0 || n.match(_IS_NUMERIC_REG)) && 
            (targetCharCount(0, n, ".") > 1);
    }
})();

// base64の最後の=を削除.
// code 対象のbase64文字列を設定.
// 戻り値 最後の=を除いた値が返却.
const _cutEndBase64Eq = function(code) {
    const len = code.length;
    for(let i = len - 1; i >= 0; i --) {
        if(code[i] != "=") {
            return code.substring(0, i + 1);
        }
    }
    return "";
}

// sha256変換.
// code 変換元の内容を返却します.
// 戻り値 変換結果(base64)が返却されます.
const sha256 = function(code) {
    return _cutEndBase64Eq(crypto.createHash('sha256')
        .update(code).digest("base64"));
}

// [hex]hmacSHA256で変換.
// signature signatureを設定します.
// tokenKey tokenKeyを設定します.
// 戻り値 変換結果が返却されます.
const hmacSHA256 = function(signature, tokenKey) {
    return crypto.createHmac("sha256", signature)
        .update(tokenKey).digest("hex");
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.isNull = isNull;
exports.useString = useString;
exports.isNumeric = isNumeric;
exports.sha256 = sha256;
exports.hmacSHA256 = hmacSHA256;

})();