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

// 非同期HTTPSClient.
const asyncHttpsClient = frequire("./lib/httpsClient.js");

// 子プロセス実行処理用.
const chProc = frequire("child_process");

// httpHeader最大長.
const BUFFER_HTTP_HEADER = 65535;

// 最大バッファ(MBYTE)
const MAX_MEGA_BUFFER = 1;

// バッファサイズ.
const MAX_BUFFER = BUFFER_HTTP_HEADER +
    (0x0100000 * MAX_MEGA_BUFFER);

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
    // 子プロセスを作成して、コマンドを実行.
    let result = chProc.execFileSync(process.execPath,
        [ __dirname + "/httpsClientChildProcess.js" ], {
        env: {
            "HTTPS_PARAMS_HOST": host,
            "HTTPS_PARAMS_PATH": path,
            "HTTPS_PARAMS_OPTIONS": JSON.stringify(options)
        },
        timeout: options.timeout || undefined,
        maxBuffer: MAX_BUFFER,
    });
    // response情報をJSON変換.
    result = result = JSON.parse(result.toString());
    // エラー返却の場合.
    if(result["#error"] != undefined) {
        throw new Error(result["#error"]);
    }
    // レスポンス返却が必要な場合.
    if(response != undefined) {
        // 取得した内容をセット.
        response.status = result.status;
        response.header = result.header;
        // optionsにresponseを元に戻す.
        options.response = response;
    }
    // base64をデコードしてバイナリを返却.
    return Buffer.from(result.body, 'base64')
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.convertUrlParams = asyncHttpsClient.convertUrlParams;
exports.encodeURIToPath = asyncHttpsClient.encodeURIToPath;
exports.request = request;

})();