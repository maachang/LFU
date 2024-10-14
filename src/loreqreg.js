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
} else if((process.env["require.loreqreg"] || "") == "false") {
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

// sha256用.
const crypto = require('crypto');

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

// カレントパスを取得.
// name 対象のファイル名を指定します.
// _cpath カレントパスを直接指定する場合に指定します.
// 戻り値: カレントパスが返却されます.
const _currentPath = function(name, _cpath) {
    return _BASE_CURRENT_PATH +
        (_cpath || _CURRENT_PATH) + "/" + name;
}

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

// 後ろの`=`が続く限り削除.
// value 対象の文字列を設定します.
// 戻り値 後ろの`=`を削除します.
const cutBeforeEq = function(value) {
    const len = value.length;
    for(let i = len - 1; i >= 0; i --) {
        if(value.charAt(i) != "=") {
            return value.substring(0, i + 1);
        }
    }
    return "";
}

// 対象条件からetagを作成.
// name ファイル名を設定します.
// fileLen ファイル長を設定します.
// fileTime 最終更新時間を設定します.
// 戻り値: sha256(base64)で返却します.
const getEtag = function(
    name, fileLen, fileTime) {
    return cutBeforeEq(
        crypto.createHash('sha256').update(
            name + "\n" +
            fileLen + "\n" +
            fileTime
        ).digest("base64")
    );
}

// ローカルファイルを指定してrequire.
// path require対象のパス名 + ファイル名を設定します.
// currentPath デフォルトのカレントパス名以外を指定したい場合は、設定します.
// 戻り値: promiseが返却されます.
//         内容はrequireされたモジュールが返却されます.
const lorequire = async function(path, currentPath) {
    // キャッシュ情報を取得.
    let result = _GBL_LO_VALUE_CACHE[path];
    if(result != undefined) {
        // キャッシュが存在する場合キャッシュを返却する.
        return result;
    }
    // ファイルパス名を取得.
    const fileName = _currentPath(path, currentPath);
    // キャッシュに存在しない場合.
    try {
        // ファイルを読み込む.
        result = fs.readFileSync(fileName);
        // ただし指定内容がJSONの場合はJSON.parseでキャッシュ
        // なしで返却.
        if(path.toLowerCase().endsWith(".json")) {
            return JSON.parse(result.toString());
        }
        // jsを実行.
        result = rjs.require_js(path, result.toString());
        // キャッシュにセット.
        _GBL_LO_VALUE_CACHE[path] = result;
        // 返却処理.
        return result;
    } catch(e) {
        console.error("## [ERROR] lorequire path: " + fileName);
        throw e;
    }
}

// ローカルファイルパスを設定して、設定してコンテンツ(binary)を取得.
// path コンテンツ取得対象のパス名＋ファイル名を指定します.
// currentPath デフォルトのカレントパス名以外を指定したい場合は、設定します.
// 戻り値: promiseが返却されます.
//         内容はコンテンツ(binary)が返却されます.
const locontents = async function(path, currentPath) {
    // ファイルパス名を取得.
    const fileName = _currentPath(path, currentPath);
    try {
        return fs.readFileSync(fileName);
    } catch(e) {
        console.error("## [ERROR] loconstants path: " + fileName);
        throw e;
    }
}

// ローカルファイルパスを設定して、対象ファイルの状態を取得します.
// path コンテンツ取得対象のパス名＋ファイル名を指定します.
// currentPath デフォルトのカレントパス名以外を指定したい場合は、設定します.
// 戻り値: promiseが返却されます.
//         内容は対象ファイルの状態が返却されます.
const lohead = async function(path, currentPath) {
    // ファイルパス名を取得.
    const fileName = _currentPath(path, currentPath);
    try {
        // stat情報を取得.
        const r = fs.statSync(fileName);
        return {
            "status": 200
            ,"header": {
                "server": "local/file"
                ,"date": new Date().toUTCString()
                ,"content-length": ("" + r.size)
                ,"last-modified": (r.mtime.toUTCString())
                ,"etag": getEtag(path, r.size, r.mtimeMs)
            }
        };
    } catch(e) {
        console.error("## [ERROR] lohead path: " + fileName);
        throw e;
    }
}

// キャッシュをクリア.
const clearCache = function() {
    for(let k in _GBL_LO_VALUE_CACHE) {
        delete _GBL_LO_VALUE_CACHE[k];
    }
}

// 初期設定.
const init = function() {
    // キャッシュクリアをセット.
    lorequire.clearCache = clearCache;
    // lorequireをglobalに登録(書き換え禁止).
    Object.defineProperty(global, "lorequire",
        {writable: false, value: lorequire});
    // locontentsをglobalに登録(書き換え禁止).
    Object.defineProperty(global, "locontents",
        {writable: false, value: locontents});
    // loheadをglobalに登録(書き換え禁止).
    Object.defineProperty(global, "lohead",
        {writable: false, value: lohead});

    // exportsを登録.
    lorequire.exports = {
        setCurrentPath: setCurrentPath
    };

    /////////////////////////////////////////////////////
    // 外部定義.
    /////////////////////////////////////////////////////
    const m = lorequire.exports;
    for(let k in m) {
        exports[k] = m[k];
    }
}

// 初期化設定を行って `lorequire`, `locontents` を
// grobalに登録.
init();

})();