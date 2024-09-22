///////////////////////////////////////////////////////////////////////////////
// lambdaローカルファイルを読み込んでrequire的に使えるようにする.
// そのための登録用呼び出し.
// また、基本的にこの内容はユーザが任意に呼び出しを行う事は通常ない.
///////////////////////////////////////////////////////////////////////////////
(function() {
'use strict'

// すでに定義済みの場合.
if(global.lorequire != undefined) {
    const m = global.lorequire.exports;
    for(let k in m) {
        exports[k] = m[k];
    }
    return;
// [環境変数]require.loreqreg == "false" の場合.
} else if((process.env["require.loreqreg"] || "").toLowerCase() == "false") {
    // 何も処理しない.
    return;
}

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("./freqreg.js");
    frequire = global.frequire;
}

// ファイルI/O.
const fs = require('fs');

// jsプログラムコンパイル用.
const rjs = require("./reqjs.js");

// Baseカレントパス名.
const _BASE_CURRENT_PATH = __dirname + "/";

// デフォルトのカレントパス.
const _DEF_CURRENT_PATH = "public";

// カレントパス.
let _CURRENT_PATH = _DEF_CURRENT_PATH;

// lorequireでloadした内容をCacheする.
const _GBL_LO_VALUE_CACHE = {};

// カレントパスを設定.
// path 対象のカレントパスを設定します.
// 戻り値: trueの場合、正しく設定されました.
const setCurrentPath = function(path) {
    // パス内容が設定されていない場合.
    if((path = ("" + (path || "")).trim()) == "") {
        return false;
    }
    if(path.startsWith("/")) {
        path = path.substring(1).trim();
    }
    if(path.endsWith("/")) {
        path = path.substring(0, path.length - 1).trim();
    }
    _CURRENT_PATH = path;
    return true;
}

// カレントパスを取得.
const currentPath = function(name) {
    return _BASE_CURRENT_PATH + _CURRENT_PATH + "/" + name;
}

// ファイル存在確認.
// name 対象のファイル名を設定します.
// 戻り値: ファイル名が存在する場合 true.
const isFile = function(name) {
    return fs.existsSync(currentPath(name));
}

// 対象ファイルの最終更新日を取得.
// name 対象のファイル名を設定します.
// 戻り値: 更新時間がUnixTimeで返却されます.
const getFileLastTime = function(name) {
    try {
        const r = fs.statSync(currentPath(name));
        return parseInt(r.mtimeMs);
    } catch(e) {
        return -1;
    }
}

// ファイルを詠み込む.
// name 対象のファイル名を設定します.
// 戻り値: ファイル内容がstringで返却されます.
//        存在しない場合は null が返却されます.
const readFile = function(name) {
    try {
        return fs.readFileSync(currentPath(name));
    } catch(e) {
        return null;
    }
}




})();