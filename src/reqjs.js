///////////////////////////////////////////////////////////////////////////////
// javascriptプログラムを読み込んで実行可能な形式にコンパイル.
///////////////////////////////////////////////////////////////////////////////
(function() {
'use strict'

/*
// [vm]nodejs library.
const vm = require('vm');

// vm.Scriptスクリプトheader.
const VM_SCRIPT_HEADER =
    "(function() {" +
    "'use strict';" +
    "return function(args){" +
    "const exports = args;";
    "const module = {exports: args};\n";

// originRequireを実施.
// vm.Script(...)で実行.
// path load対象のPathを設定します.
// js load対象のjsソース・ファイルを設定します.
// 戻り値: exportsに設定された内容が返却されます.
const _runVmScriptRequire = function(path, js) {
    try {
        // Contextを生成.
        // runInContextはsandboxなので、現在のglobalメモリを設定する.
        let memory = global;
        let context = vm.createContext(memory);

        // origin的なrequireスクリプトを生成.
        let srcScript = VM_SCRIPT_HEADER
            + js
            + "\n};})();";
    
        // スクリプト実行環境を生成.
        let script = new vm.Script(srcScript, {filename: path});
        srcScript = null;
        const executeJs = script.runInContext(context, {filename: path});
        script = null; context = null; memory = null;
    
        // スクリプトを実行して、exportsの条件を取得.
        const ret = {};
        executeJs(ret);
    
        // 実行結果を返却.
        return ret;
    } catch(e) {
        console.error("## [ERROR] _runVmScriptRequire path: " + path);
        throw e;
    }
}
*/

// originRequireを実施.
// Function(...)で実行.
// path load対象のPathを設定します.
// js load対象のjsソース・ファイルを設定します.
// 戻り値: exportsに設定された内容が返却されます.
const _runFunctionRequire = function(path, js) {
    try {
        const exp = {};
        Function("exports", "module", js)(
            exp, {exports: exp}
        );
        return exp;
    } catch(e) {
        console.error("## [ERROR] _runFunctionRequire path: " + path);
        throw e;
    }
}

// javascriptを実行形式にコンパイル.
// path load対象のPathを設定します.
// js load対象のjsソース・ファイルを設定します.
// 戻り値: exportsに設定された内容が返却されます.
const require_js = function(path, js) {
    // vm.Scriptで実行.
    //return _runVmScriptRequire(path, js);

    // Functionで実行.
    return _runFunctionRequire(path, js);
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.require_js = require_js;

})();