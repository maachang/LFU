///////////////////////////////////////////////////////////
// [同期]httpsClient.
// nodejsでは、同期をやろうとすると child_processで行う必要
// がある.
// またAWS Lambdaでは通常のNodeJSの利用と違い、基本的に
// 呼び出される度に「起動・実行・終了」となるので、特に非同期
// のような最適化は「必要でない」と言える.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// 子プロセス実行処理用.
const chProc = frequire("child_process");

// [ENV]子プロセス結果のレスポンス情報格納バッファ長.
const ENV_HTTPS_CLIENT_SYNC_MAX_BUFFER = "HTTPS_CLIENT_SYNC_MAX_BUFFER";

// ENV定義の子プロセス結果のレスポンス情報格納バッファ長.
const HTTPS_CLIENT_SYNC_MAX_BUFFER = process.env[ENV_HTTPS_CLIENT_SYNC_MAX_BUFFER]

// httpHeader最大長.
const BUFFER_HTTP_HEADER = 65535;

// 最大バッファ(MBYTE)
const MAX_MEGA_BUFFER = 1.5;

// バッファサイズ.
const MAX_BUFFER = BUFFER_HTTP_HEADER +
    (0x0100000 * MAX_MEGA_BUFFER);

// デフォルトタイムアウト値(msec)
const DEFAULT_TIMEOUT = 30 * 1000;

// httpsリクエスト.
// host 対象のホスト名を設定します.
// path 対象のパス名を設定します.
// options その他オプションを設定します.
//  - method(string)
//    HTTPメソッドを設定します.
//    設定しない場合は GET.
//  - header({})
//    HTTPリクエストヘッダ(Object)を設定します.
//  - body(Buffer or String)
//    HTTPリクエストBodyを設定します.
//  - port(number)
//    HTTPS接続先ポート番号を設定します.
//  - urlParams(string or object)
//    urlパラメータを設定します.
//  - response({})
//    レスポンスステータスやレスポンスヘッダが返却されます.
//    response = {
//      status: number,
//      header: object
//    }
//  - timeout 応答タイムアウト値をミリ秒で設定します.
//  - maxBuffer 子プロセスから受け取るデータに対するバッファ長を
//              バイト数で設定します.
// 戻り値: Body内容としてBufferが返却されます.
const request = function(host, path, options) {
    let response = undefined;
    // optionsが設定されていない.
    if(options == undefined || options == null) {
        options = {response: false};
    // reponse返却が必要な場合.
    } else if(options.response != undefined) {
        response = options.response;
        options.response = true;
    // responseが不要な場合.
    } else {
        options.response = false;
    }
    // 子プロセス同期タイムアウト値.
    let timeout = options.timeout;
    if(timeout == undefined) {
        timeout = DEFAULT_TIMEOUT
    }
    // 子プロセスから受け取る最大バッファ長.
    let maxBuffer = options.maxBuffer;
    if(maxBuffer == undefined) {
        // 設定されていない場合は環境変数から取得.
        let env = HTTPS_CLIENT_SYNC_MAX_BUFFER;
        // 環境変数の情報が存在する場合.
        if(env != undefined && env != null) {
            // 数字変換.
            env = env|0;
            // 数字変換に失敗.
            if(env == 0) {
                // デフォルト.
                maxBuffer = MAX_BUFFER
            } else {
                // env設定.
                maxBuffer = env;
            }
        } else {
            // デフォルト.
            maxBuffer = MAX_BUFFER
        }
    }
    // [同期]子プロセスを作成して、nodejsのプログラムを実行.
    let result = chProc.execFileSync(process.execPath,
        [ __dirname + "/httpsClientChildProcess.js"], {
        // パラメータは環境変数で行う.
        env: {
            "HTTPS_PARAMS_HOST": host,
            "HTTPS_PARAMS_PATH": path,
            "HTTPS_PARAMS_OPTIONS": JSON.stringify(options)
        },
        // 同期タイムアウト.
        timeout: timeout,
        // stdoutの受け取りMaxバッファ長.
        maxBuffer: maxBuffer,
    });
    // response情報のJSON文字列をデコード処理.
    result = result = JSON.parse(result.toString());
    // エラー返却の場合.
    if(result["#error"] != undefined) {
        // エラーメッセージを取得して、例外返却.
        throw new Error(result["#error"]);
    }
    // レスポンス返却が必要な場合.
    if(response != undefined) {
        // 返却レスポンスを元のresponseにセット.
        response.status = result.status;
        response.header = result.header;
        // 元のresponseをoptionsに設定.
        options.response = response;
    }
    // base64をデコードしてバイナリを返却.
    return Buffer.from(result.body, 'base64');
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.request = request;

// urlParamsを文字列に変換する.
// urlParams 解析されたURLパラメータを設定します.
// 戻り値: 変換された文字列が返却されます.
exports.convertUrlParams = function(urlParams) {
    if(urlParams == undefined || urlParams == null) {
        return "";
    } else if(typeof(urlParams) == "string") {
        return urlParams;
    }
    const list = [];
    for(let k in urlParams) {
        list[list.length] =
            encodeURIComponent(k) + "=" +
            encodeURIComponent(urlParams[k]);
    }
    list.sort();
    const len = list.length;
    let ret = "";
    for(let i = 0; i < len; i ++) {
        if(i != 0) {
            ret += "&";
        }
        ret += list[i];
    }
    return ret;
}

// path内容をencodeURIComponentする.
// path 対象のパスを設定します.
// 戻り値: encodeURIComponent変換されたパスが返却されます.
exports.encodeURIToPath = function(path) {
    path = path.trim();
    // パスが空かパス内に "%" すでにURLEncodeしている場合.
    if(path.length == 0 || path.indexOf("%") != -1) {
        // 処理しない.
        return path;
    }
    let n, ret;
    const list = path.split("/");
    const len = list.length;
    ret = "";
    // パスの区切り文字[/]を除外して、
    // パス名だけをURLEncodeする.
    for(let i = 0; i < len; i ++) {
        n = list[i].trim();
        if(n.length == 0) {
            continue;
        }
        n = encodeURIComponent(n);
        if(ret.length == 0) {
            ret = n;
        } else {
            ret = ret + "/" + n;
        }
    }
    return ret;
}

})();