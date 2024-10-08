//////////////////////////////////////////////////////////
// jhtml.js
// javascript html template.
//
// - jhtml組み込みタグ説明.
//   <% ... %>
//     基本的な組み込みタグ情報
//   <%= ... %>
//     実行結果をhtmlとして出力する組み込みタグ.
//   <%# ... %>
//     コメント用の組み込みタグ.
//   ${ ... }
//     実行結果をテンプレートとして出力する組み込みタグ.
//     <%= ... %> これと内容は同じ.
//     ただ利用推奨としては、変数出力時に利用する.
//
// - jhtml組み込み機能.
//   $out = function(string)
//     stringをhtmlとして出力するFunction.
//     戻り値が$outのfunctionなので
//     > $out("abc")(def) ... 的に実装が出来る.
//   $params = object
//     getまたはpostで渡されたパラメータ情報.
//     取得方法はたとえば `hoge` パラメータ取得なら $params.hoge で取得.
//     - getパラメータの場合 {key: value} のような形で格納される.
//     - postパラメータの場合 `application/x-www-form-urlencoded`の
//       場合は {key: value} のような形で格納される.
//       また`application/json` の場合は、JSONで渡された内容が格納される.
//   $request = object
//     リクエストオブジェクトが設定される.
//     ここにリクエストに対する各種リクエスト情報が設定されている.
//     - method = string: HTTPメソッド.
//     - protocol = string: HTTP/1.1 など.
//     - path = string: urlパス.
//     - header = httpHeader.js: リクエストHTTPヘッダ.
//     - queryParams = object: URLパラメータ.
//     - params = object: GET/POSTパラメータ.
//     - body = object: POSTに対してのmimeTypeがForm送信かJSON以外の場合設定される.
//     - isBinary = boolean: trueの場合、bodyがバイナリ情報として保持されている.
//   $status = httpStatus.js
//     レスポンス用のステータスが設定される.
//   $response = httpHeader.js
//     レスポンス用のHTTPヘッダが設定される.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("./freqreg.js");
    frequire = global.frequire;
}

// nodejs library(vm).
//const vm = frequire('vm');

// jhtml出力メソッド名.
const _OUT = "$out";

// クォーテーションに対するインデントの増減を行う.
// string 対象の文字列を設定します.
// dc [true]の場合は["], [false]の場合は['].
// 戻り値: 変換された内容が返却されます.
const indentQuote = function(string, dc) {
    const len = string.length;
    if (len <= 0) {
        return string;
    }
    const target = (dc) ? '\"' : '\'';
    let c, j, yenLen, buf;
    yenLen = 0;
    buf = "";
    for (let i = 0; i < len; i++) {
        if ((c = string[i]) == target) {
            if (yenLen > 0) {
                yenLen <<= 1;
                for (j = 0; j < yenLen; j++) {
                    buf += "\\";
                }
                yenLen = 0;
            }
            buf += "\\" + target;
        } else if ('\\' == c) {
            yenLen ++;
        } else {
            if (yenLen != 0) {
                for (j = 0; j < yenLen; j++) {
                    buf += "\\";
                }
                yenLen = 0;
            }
            buf += c;
        }
    }
    if (yenLen != 0) {
        for (j = 0; j < yenLen; j++) {
            buf += "\\";
        }
    }
    return buf;
}

// 改行に対するインデントの増減を行う.
// string 対象の文字列を設定します.
// 戻り値: 変換された内容が返却されます.
const indentEnter = function(s) {
    const len = s.length;
    if (len <= 0) {
        return s;
    }
    let c, ret;
    ret = "";
    for(let i = 0; i < len; i++) {
        if((c = s[i]) == "\n") {
            ret += "\\n";
        } else {
            ret += c;
        }
    }
    return ret;
}

// ${ ... } を <% ... %>変換する.
// jhtml 変換対象のjhtml内容を設定します.
// 戻り値: 変換された内容が返却されます.
const analysis$braces = function(jhtml) {
    let ret = "";
    let c, qt, by, $pos, braces;
    by = false;
    $pos = -1;
    braces = 0;
    const len = jhtml.length;
    for(let i = 0; i < len; i ++) {
        c = jhtml[i];

        // ${ 検出中
        if($pos != -1) {
            // クォーテーション内.
            if(qt != undefined) {
                // 今回の文字列が対象クォーテーション終端.
                if(!by && qt == c) {
                    qt = undefined;
                }
            // クォーテーション開始.
            } else if(c == "\"" || c == "\'") {
                qt = c;
            // 波括弧開始.
            } else if(c == "{") {
                braces ++;
            // 波括弧終了.
            } else if(c == "}") {
                braces --;
                // 波括弧が終わった場合.
                if(braces == 0) {
                    // <%= ... %> に置き換える.
                    ret += "<%=" + jhtml.substring($pos + 2, i) + "%>";
                    $pos = -1;
                }
            }
        // ${ ... }の開始位置を検出.
        } else if(c == "$" && i + 1 < len && jhtml[i + 1] == "{") {
            $pos = i;
        // それ以外.
        } else {
            ret += c;
        }
        // 円マークの場合.
        by = (c == "\\");
    }
    return ret;
}

// jhtmlを解析して実行可能なjs変換を行う.
// jhtml 対象のjhtmlを設定します.
// 戻り値: 実行可能なjs形式の情報が返却されます.
const analysisJHtml = function(jhtml) {
    let c, n, start, bef, ret;
    const len = jhtml.length;
    bef = 0;
    start = -1;
    ret = "";
    for(let i = 0; i < len; i ++) {
        c = jhtml[i];
        if(start != -1) {
            if(c == "%" && i + 1 < len && jhtml[i + 1] == ">") {
                if(ret.length != 0) {
                    ret += "\n";
                }
                n = jhtml.substring(bef, start);
                n = indentEnter(n);
                n = indentQuote(n, true);
                // HTML部分を出力.
                ret += _OUT + "(\"" + n + "\");\n";
                bef = i + 2;
                
                // 実行処理部分を実装.
                n = jhtml[start + 2];
                if(n == "=") {
                    // 直接出力.
                    n = jhtml.substring(start + 3, i).trim();
                    if(n.endsWith(";")) {
                        n = n.substring(0, n.length - 1).trim();
                    }
                    ret += _OUT + "(" + n + ");\n";
                } else if(n == "#") {
                    // コメントなので、何もしない.
                } else {
                    // 出力なしの実行部分.
                    ret += jhtml.substring(start + 2, i).trim() + "\n";
                }
                start = -1;
            }
        } else if(c == "<" && i + 1 < len && jhtml[i + 1] == "%") {
            start = i;
            i += 1;
        }
    }
    // のこりのHTML部分を出力.
    n = jhtml.substring(bef);
    n = indentEnter(n);
    n = indentQuote(n, true);
    // HTML部分を出力.
    ret += _OUT + "(\"" + n + "\");\n";

    return ret;
}

// ￥r￥nを ￥nに変換.
// s 対象の文字列を設定します.
// 戻り値: 変換された内容が返却されます.
const convertYrYnToYn = function(s) {
    let c, ret;
    const len = s.length;
    ret = "";
    for(let i = 0; i < len; i ++) {
        if((c = s[i]) != "\r") {
            ret += c;
        }
    }
    return ret;
}

// jhtmlをjsに変換.
// jhtml 対象のjhtmlを設定します.
// 戻り値: 実行可能なjs形式の情報が返却されます.
const convertJhtmlToJs = function(jhtml) {
    return analysisJHtml(
        analysis$braces(
            convertYrYnToYn(jhtml)
        )
    );
}

// jhtmlを実行.
// name jhtmlのファイルパスを設定します.
// js jhtmlを変換してjsに置き換えた内容を設定します.
// request 対象のリクエスト情報を設定します.
// status 対象のステータスを設定します.
// response 対象のレスポンスを設定します.
// params request.paramsでない、パラメータを設定する場合は、
//        こちらに設定します.
// 戻り値: 実行結果(string)が返却されます.
const executeJhtml = function(
    name, js, request, status, response, params) {
    
    // vm.Scriptで実行.
    //return _runVmScriptToJHTML(name, js, request, status, response, params);

    // Functionで実行.
    return _runFunctionToJHTML(name, js, request, status, response, params);
}

// jhtml実行js用実行パラメータ.
const JHTML_JS_ARGS =
    _OUT + ", $params, $request, $status, $response, $jthml";

// vm.Script: jhtml実行js用ヘッダ.
/*const VM_SCRIPT_JHTML_JS_HEADER =
    "(function() {'use strict';return async function(" +
        JHTML_JS_ARGS + "){\n";
*/
// jhtmlを実行.
// vm.Script(...)で実行.
// name jhtmlのファイルパスを設定します.
// js jhtmlを変換してjsに置き換えた内容を設定します.
// request 対象のリクエスト情報を設定します.
// status 対象のステータスを設定します.
// response 対象のレスポンスを設定します.
// params request.paramsでない、パラメータを設定する場合は、
//        こちらに設定します.
// 戻り値: 実行結果(string)が返却されます.
/*const _runVmScriptToJHTML = async function(
    name, js, request, status, response, params) {
    try {
        // paramsが指定されていない場合.
        if(params == undefined || params == null) {
            // request.paramsをセット.
            params = request.params;
        }
        // Contextを生成.
        // runInContextはsandboxなので、現在のglobalメモリを設定する.
        let memory = global;
        let context = vm.createContext(memory);

        // jhtml実行JSのスクリプトを生成.
        let srcScript = VM_SCRIPT_JHTML_JS_HEADER
            + js
            + "\n};})();";
        // スクリプト実行環境を生成.
        let script = new vm.Script(srcScript, {filename: name});
        srcScript = null;
        const executeJs = script.runInContext(context, {filename: name});
        script = null; context = null; memory = null;
        
        // $outを生成.
        let outString = "";
        // outに追加する標準メソッド.
        const out = function(string) {
            outString += string;
            return out;
        }
        // outをクリアするメソッドを追加.
        out.clear = function() {
            outString = "";
            return out;
        }
        // スクリプトを実行して、exportsの条件を取得.
        await executeJs(out, params, request, status, response,
                jhtmlMethod(out, params, request, status, response));

        // コンテンツタイプが設定されていない場合.
        if(response.get("content-type") == undefined) {
            // htmlのmimeTypeをセット.
            response.put("content-type", request.mimeType("html").type);
        }
    
        // 実行結果を返却.
        return outString;
    } catch(e) {
        console.error("## [ERROR] _runVmScriptToJHTML name: " + name);
        throw e;
    }
}*/

// async用Functionオブジェクト定義.
const AsyncFunction = async function () {}.constructor;

// jhtmlを実行.
// Function(...)で実行.
// name jhtmlのファイルパスを設定します.
// js jhtmlを変換してjsに置き換えた内容を設定します.
// request 対象のリクエスト情報を設定します.
// status 対象のステータスを設定します.
// response 対象のレスポンスを設定します.
// params request.paramsでない、パラメータを設定する場合は、
//        こちらに設定します.
// 戻り値: 実行結果(string)が返却されます.
const _runFunctionToJHTML = async function(
    name, js, request, status, response, params) {
    // $outを生成.
    let outString = "";
    // outに追加する標準メソッド.
    const out = function(string) {
        outString += string;
        return out;
    }
    // outをクリアするメソッドを追加.
    out.clear = function() {
        outString = "";
        return out;
    }
    try {
        // AsyncFunction実行.
        await (AsyncFunction(
            _OUT, "$params", "$request", "$status", "$response", "$jthml",
            js
        ))(out, params, request, status, response,
            jhtmlMethod(out, params, request, status, response));
        // コンテンツタイプが設定されていない場合.
        if(response.get("content-type") == undefined) {
            // htmlのmimeTypeをセット.
            response.put("content-type", request.mimeType("html").type);
        }
        // 処理結果を返却.
        return outString;
    } catch(e) {
        console.error("## [ERROR] _runFunctionToJHTML name: " + name, e);
        throw e;
    }
}

// 指定パスから文字列コンテンツを取得.
// path 対象のパス名を設定します.
//      ここでのパスの解釈はexcontentで処理されます.
// charset 文字コードを設定します.
// 戻り値: 文字列が返却されます.
const getStringContents = async function(path, charset) {
    // 設定された環境からコンテンツを取得.
    let ret = await excontents(path);
    // charsetが設定されている場合.
    if(typeof(charset) == "string") {
        // binaryから文字列変換(charsetで変換).
        ret = ret.toString(charset);
    } else {
        // binaryから文字列変換(charset=utf8で変換).
        ret = ret.toString();
    }
    return ret;
}

// jhtmlファイル指定の場合、対象のパスを返却.
// path パスを設定します.
// 戻り値: パスが.jhtml拡張子の場合 .js.htmlに変換されます.
const convertJhtmlPath = function(path) {
    if(path.toLowerCase().endsWith(".jhtml")) {
        return path.substring(
            0, path.length - 6) + ".js.html";
    }
    return path;
}

// 拡張子が .js.html かチェック.
// path 対象のパスを設定します.
// 戻り値: 拡張子が .js.html の場合 true.
const isJsHTML = function(path) {
    return path.endsWith(".js.html");
}
 
// jhtmlを実行.
// path 拡張子が .js.html のパスが返却されます.
// jhtml 対象のJHTML読み込み文字列が設定されます.
// request 対象のリクエスト情報を設定します.
// status 対象のステータスを設定します.
// response 対象のレスポンスを設定します.
// 戻り値: 実行結果(string)が返却されます.
const execJHTML = async function(path, jhtml, request, status, response) {
    // jhtmlからjsに変換処理.
    const js = analysisJHtml(jhtml);
    // jhtmlを実行.
    return await executeJhtml(path, js, request, status, response);
}

// jhtmlMethod: 指定パスのHTMLを返却します.
const _jhtmlMethod_forwardHTML = async function(path, status, charset,
    $out, $params, $request, $status, $response) {
    // ステータスが設定されていない場合は200をセット.
    status = status|0;
    if(status == 0) {
        status = 200;
    }
    // ステータスを設定.
    $status.setStatus(status);
    // 対象パスが.jhtml拡張子の場合変換.
    path = convertJhtmlPath(path);
    // 設定された環境からコンテンツを取得.
    let ret = await getStringContents(path, charset);
    // jhtmlの場合、JHTML実行.
    if(isJsHTML(path)) {
        ret = await execJHTML(path, ret, $request, $status, $response);
    } else {
        // htmlのmimeTypeをセット.
        $response.put("content-type",
            $request.mimeType("html").type);
    }
    $out.clear()(ret);
}

// jhtmlMethod: 指定パスのHTMLをエラー返却します.
const _jhtmlMethod_errorHTML = async function(status, path, charset,
    $out, $params, $request, $status, $response) {
    // 対象パスが.jhtml拡張子の場合変換.
    path = convertJhtmlPath(path);
    // 設定された環境からコンテンツを取得.
    let ret = await getStringContents(path, charset);
    // jhtmlの場合、JHTML実行.
    if(isJsHTML(path)) {
        ret = await execJHTML(path, ret, $request, $status, $response);
    } else {
        // htmlのmimeTypeをセット.
        $response.put("content-type",
            $request.mimeType("html").type);
    }
    // ステータスが400以下の場合500を設定.
    status = status|0;
    // statusが400以下の場合.
    if(status <= 399) {
        // 500.
        status = 500;
    }
    // ステータスを設定.
    $status.setStatus(status);
    $out.clear()(ret);
}

// jhtml用専用メソッドを生成.
const jhtmlMethod = function($out, $params, $request, $status, $response) {
    const ret = {};
    // 指定パスのHTMLを返却します.
    // path 対象のパス名を設定します.
    //      ここでのパスの解釈はexcontentで処理されます.
    // status 返却対象のステータスを設定します.
    //        設定してない場合200が設定されます.
    // charset 文字コードを設定します.
    ret.forwardHTML = async function(path, status, charset) {
        await _jhtmlMethod_forwardHTML(path, status, charset,
            $out, $params, $request, $status, $response);
    }
    // 指定パスのHTMLをエラー返却します.
    // status 返却対象のステータスを設定します.
    //        設定してない場合500が設定されます.
    // path 対象のパス名を設定します.
    //      ここでのパスの解釈はexcontentで処理されます.
    // charset 文字コードを設定します.
    ret.errorHTML = async function(status, path, charset) {
        await _jhtmlMethod_errorHTML(status, path, charset,
            $out, $params, $request, $status, $response);
    }
    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.convertJhtmlToJs = convertJhtmlToJs;
exports.executeJhtml = executeJhtml;

})();