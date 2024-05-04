///////////////////////////////////////////////////////////
// [非同期]httpsClient.
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

// プロトコル.
const PROTOCOL = "https";

// httpsライブラリ.
const https = frequire(PROTOCOL);

// urlParamsを文字列に変換する.
// urlParams 解析されたURLパラメータを設定します.
// 戻り値: 変換された文字列が返却されます.
const convertUrlParams = function(urlParams) {
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
const encodeURIToPath = function(path) {
    path = path.trim();
    // "/"文字のみの場合.
    // パスが空かパス内に "%" すでにURLEncodeしている場合.
    if(path.length == 0 || path == "/" || path.indexOf("%") != -1) {
        // 処理しない.
        return path;
    }
    let n, ret;
    const list = path.split("/");
    const len = list.length;
    // pathの "/" はURLエンコードしないで、それ以外のみURLエンコード処理を行う.
    ret = "";
    for(let i = 0; i < len; i ++) {
        n = list[i].trim();
        if(n.length == 0) {
            ret = ret + "/";
        } else if(ret.length == 0 || ret == "/") {
            ret = ret + encodeURIComponent(n);
        } else {
            ret = ret + "/" + encodeURIComponent(n);
        }
    }
    return ret;
}

// httpsのURLを生成.
// host [必須]対象のホスト名を設定します.
// path [任意]対象のパス名を設定します.
// port [任意]対象のポート番号を設定します.
// urlParams [任意]urlパラメータを設定します.
const getUrl = function(host, path, port, urlParams) {
    if(path == undefined || path == null) {
        path = "";
    } else if((path = path.trim()).startsWith("/")) {
        path = path.substring(1).trim();
    }
    if(urlParams != undefined && urlParams != null) {
        urlParams = "?" + convertUrlParams(urlParams);
    } else {
        urlParams = "";
    }
    // URLを作成.
    return ((port|0) > 0) ?
        PROTOCOL + "://" + host + ":" + (port|0) + "/" + path + urlParams:
        PROTOCOL + "://" + host + "/" + path + urlParams;
}

// ヘッダ情報のキー文字を小文字変換.
// header 対象のヘッダを設定します.
// 戻り値: 変換されたヘッダ内容が返却されます.
const convertHeaderToLowerKey = function(header) {
    const ret = {}
    for(let k in header) {
        ret[k.trim().toLowerCase()] = header[k];
    }
    return ret;
}

// streamレスポンス処理.
// outResult レスポンスステータスやヘッダを取得する場合指定されます.
// stream 対象のstreamオブジェクトを設定します.
// responseEvent レスポンスEventを設定します.
// resolve promise成功結果を渡すfunction.
// reject promise失敗結果を渡すfunction.
// call (end, buf): streamを受け取るfunctionを設定.
//       end: trueの場合 データ読み込み終了です.
//       buf: stream取得時のbufferです.
//            end == trueの場合 undefinedです.
const _streamResponseCall = function(
    outResult, stream, responseEvent, resolve, reject, call) {
    // イベント11超えでメモリーリーク警告が出るのでこれを排除.
    stream.setMaxListeners(0);
    // データ受取.
    const dataCall = function(chunk) {
        call(false, chunk);
    }
    // データ受取終了.
    const endCall = function() {
        try {
            // レスポンス情報を受け付ける.
            if(outResult != undefined) {
                outResult.status = responseEvent.statusCode;
                outResult.header = convertHeaderToLowerKey(
                    responseEvent.headers);
            }
            // 通信終了.
            resolve(call(true));
        } finally {
            cleanup();
        }
    }
    // エラー.
    const errCall = function(e) {
        stream.end();
        reject(e);
        cleanup();
    }
    // クリーンアップ.
    const cleanup = function() {
        stream.removeListener('data', dataCall);
        stream.removeListener('end', endCall);
        stream.removeListener('error', errCall);
    }
    // response処理.
    try {
        stream.on("data", dataCall);
        stream.once("end", endCall);
        stream.once("error", errCall);
    } catch (err) {
        reject(err);
        cleanup();
    }
}

// httpsStreamリクエスト.
// response情報をstream処理で実行します.
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
// - directURL(boolean)
//    trueを設定した場合、host = URLになります.
// - gzip(boolean)
//    true を設定する事でgzipを解凍しながら取得します.
// call (end, buf): streamを受け取るfunctionを設定.
//       end: trueの場合 データ読み込み終了です.
//       buf: stream取得時のbufferです.
//            end == trueの場合 undefinedです.
// 戻り値: Promise(Buffer)が返却されます.
const streamRequest = function(host, path, options, call) {
    // optionsが存在しない場合.
    if(options == undefined || options == null) {
        options = {};
    }
    // requestメソッドを取得.
    const method = options.method == undefined ?
        "GET" : options.method.toUpperCase();
    // requestヘッダを取得.
    const header = options.header == undefined ?
        {} : convertHeaderToLowerKey(options.header);
    // requestBodyを取得.
    const body = options.body == undefined ?
        undefined : options.body;
    // httpsPortを取得.
    const port = options.port == undefined ?
        "" : options.port;
    // urlパラメータを取得.
    const urlParams = options.urlParams == undefined ?
        undefined : options.urlParams;
    // responseを取得.
    const response = options.response == undefined ?
        undefined : options.response;
    // bodyが存在して、header.content-lengthが存在しない.
    if(body != undefined && header["content-length"] == undefined &&
        header["transfer-encoding"] != "chunked") {
        header["content-length"] = Buffer.byteLength(body);
    }
    // hostにhttps://が存在する場合は除外.
    if(options["directURL"] != true && host.startsWith("https://")) {
        host = host.substring(8).trim();
    }
    // 非同期処理.
    return new Promise((resolve, reject) => {
        // 接続パラメータを作成.
        const params = {
            "method": method,
            "headers": header,
        };
        try {
            // urlを取得.
            const url = options["directURL"] == true ?
                host: getUrl(host, path, port, urlParams);
            // request作成.
            const req = https.request(url, params, function(responseEvent) {
                let stream = responseEvent;
                // gzip取得が有効な場合.
                if(options.gzip == true) {
                    stream = responseEvent.pipe(require("zlib").createGunzip());
                }
                // streamレスポンス処理.
                _streamResponseCall(response, stream, responseEvent,
                    resolve, reject, call)
            });
            // イベント11超えでメモリーリーク警告が出るのでこれを排除.
            req.setMaxListeners(0);
            // [request]エラー.
            const errCall = function(e) {
                req.end();
                reject(e)
                cleanup();
            }
            // [request]クリーンアップ.
            const cleanup = function() {
                req.removeListener('error', errCall);
            }
            // requestエラー処理.
            req.once('error', errCall);
            // bodyが存在する場合.
            if(body != undefined) {
                // body送信.
                req.write(body);
            }
            // request終了.
            req.end();
            // [request]クリーンアップ.
            cleanup();
        } catch (err) {
            // リジェクト.
            reject(err)
            // [request]クリーンアップ.
            cleanup();
        }
    });
}

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
// - directURL(boolean)
//    trueを設定した場合、host = URLになります.
// - gzip(boolean)
//    true を設定する事でgzipを解凍しながら取得します.
// 戻り値: Promise(Buffer)が返却されます.
const request = function(host, path, options) {
    const body = [];
    return streamRequest(host, path, options,
        function(end, buf) {
            // データ受信中.
            if(end == false) {
                body.push(buf);
            // データ受信終了.
            } else {
                return Buffer.concat(body);
            }
        }
    );
}

// レスポンスBodyを文字列変換.
const toString = function(binary, charset) {
    if(typeof(binary) == "string") {
        return binary;
    }
    if(charset == undefined) {
        charset = "utf-8";
    }
    return binary.toString(charset);
}

// レスポンスBodyをJSON変換.
const toJSON = function(binary, charset) {
    return JSON.parse(toString(binary, charset));
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.convertUrlParams = convertUrlParams;
exports.encodeURIToPath = encodeURIToPath;
exports.streamRequest = streamRequest;
exports.request = request;
exports.toString = toString;
exports.toJSON = toJSON;

})();