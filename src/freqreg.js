///////////////////////////////////////////////////////////////////////////////
// lambda側のjsファイルをrequireする(file require).
// これを理由する理由としては grequireやs3requireではrequireのような相対パスを
// 意識した呼び出しは行えない。
// frequireは、ローカルのファイルに対して相対パスではなく、規定パスを絶対パスと
// した形で呼び出す形としている。
///////////////////////////////////////////////////////////////////////////////
(function() {
'use strict'

// HttpErrorの読み込み.
if(global.HttpError != undefined) {
    require("./httpError.js");
}

// すでに定義済みの場合.
if(global.frequire != undefined) {
    return;
}

// nodejs library.
const fs = require('fs');

// Baseカレントパス名.
const _BASE_CURRENT_PATH = __dirname + "/";

// 元のrequire.
const srcRequire = require;

// 指定パス名を整形.
// jsFlag true の場合jsファイルを対象とします.
// name パス名を設定.
// 戻り値: 整形されたパス名が返却されます.
const trimPath = function(jsFlag, name) {
    if(name.startsWith("/")) {
        name = name.substring(1).trim();
    }
    const checkName = name.toLowerCase(); 
    // jsファイルを対象読み込みで、拡張子がjsでない場合.
    if(jsFlag == true &&
        !checkName.endsWith(".js")) {
        // ただし、json拡張子を除く.
        if(!checkName.endsWith(".json")) {
            name += ".js";
        }
    }
    return name;
}

// ファイル存在確認.
// name 対象のファイル名を設定します.
// 戻り値: ファイル名が存在する場合 true.
const isFile = function(name) {
    return fs.existsSync(_BASE_CURRENT_PATH + name);
}

// ファイルを詠み込む.
// name 対象のファイル名を設定します.
// 戻り値: ファイル内容がstringで返却されます.
//        存在しない場合は null が返却されます.
const readFile = function(name) {
    //if(isFile(name)) {
    //    return fs.readFileSync(_BASE_CURRENT_PATH + name);
    //}
    //return null;
    try {
        return fs.readFileSync(_BASE_CURRENT_PATH + name);
    } catch(e) {
        return null;
    }
}

// 禁止requireファイル群.
const _FORBIDDEN_FREQUIRES = {
    "httpError.js": true,
    "freqreg.js": true,
    "s3reqreg.js": true,
    "greqreg.js": true,
    "LFUSetup.js": true,
    "index.js": true,
};

// file or 元のrequire 用の require.
// name require先のファイルを取得します.
// 戻り値: require結果が返却されます.
const frequire = function(name) {
    // ファイル名を整形.
    const jsName = trimPath(true, name);
    // 禁止されたrequire先.
    if(_FORBIDDEN_FREQUIRES[jsName] == true) {
        // エラー返却.
        throw new Error(
            "Forbidden require destinations specified: " +
            name);
    }
    // ファイルが存在する場合.
    // ここでnode.jsのパッケージ読み込みと、LFUの基本ライブラリの
    // 読み込みを区分けする.
    if(isFile(jsName)) {
        // currentPath入りで、読み込む.
        return srcRequire(_BASE_CURRENT_PATH + jsName);
    }
    // 指定のまま読み込む.
    return srcRequire(name);
}

// file 用の contents.
// name contains先のファイルを取得します.
// 戻り値: contains結果(binary)が返却されます.
const fcontents = function(name) {
    // ファイル名を整形.
    const containsName = trimPath(false, name); 
    // ファイル内容を取得.
    const ret = readFile(containsName);
    if(ret == null) {
        throw new Error(
            "Specified file name does not exist: " +
            name);
    }
    return ret;
}

// キャッシュをクリア.
const clearCache = function() {
    // srcRequireキャッシュ削除.
    const cache = srcRequire.cache;
    for(let k in cache) {
        delete cache[k];
    }
}

// 初期設定.
const init = function() {
    // キャッシュクリアをセット.
    frequire.clearCache = clearCache;
    Object.defineProperty(global, "frequire",
        {writable: false, value: frequire});
    Object.defineProperty(global, "fcontents",
        {writable: false, value: fcontents});
}

// 初期化設定を行って `frequire` をgrobalに登録.
init();

})();
