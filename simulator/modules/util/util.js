////////////////////////////////////////////////
// ユーティリティ.
////////////////////////////////////////////////
(function(_g) {
'use strict';

// 指定文字内に環境変数がある場合は変換.
// value 対象の文字列を設定します.
//       環境変数の解釈をする場合は以下のように行います.
//       "${環境変数名}"
//       また対象の`環境変数名`が存在しない場合は変換されません.
// 戻り値: 変換された結果が返却されます.
const changeEnv = function(value) {
    if(value.indexOf("${") == -1) {
        return value;
    }
    let p;
    const list = process.env;
    for(let k in list) {
        p = value.indexOf("${" + k + "}");
        if(p != -1) {
            value = value.substring(0, p) +
                list[k] + value.substring(p + k.length + 3);
        }
    }
    return value;
}
exports.changeEnv = changeEnv;

// getEnv処理.
// name ENV名を設定します.
// 戻り値: Env要素が返却されます.
const getEnv = function(name) {
    const value = process.env[name];
    if(typeof(value) == "string") {
        return changeEnv(value);
    }
    return undefined;
}
exports.getEnv = getEnv;

// 必須環境変数名をリスト指定して、定義されているかチェック.
// 定義されていない場合、エラーとなります.
// list [string, string, string, ...]
//      チェックしたい環境変数名を設定します.
// 戻り値: trueの場合、指定環境変数は定義されています.
const requireEnv = function(list) {
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        if(process.env[list[i]] == undefined) {
            console.error(
                "The specified environment variable \'" +
                    list[i] + "\' is a required setting.");
            return false;
        }    
    }
    return true;
}
exports.requireEnv = requireEnv;

})(global);