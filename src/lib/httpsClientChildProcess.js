///////////////////////////////////////////////////////////
// [同期]httpsClient用子プロセス実行用.
// この処理は 基本的に ./lib/httpsClientSync.js から呼ばれる.
// この処理は ./lib/httpsClient.jsの結果を stdoutで処理する.
// これにより同期で「HTTPSClient」アクセスができる.
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

// パラメータを取得: host名.
let host = process.env["HTTPS_PARAMS_HOST"];
// パラメータを取得: path名.
const path = process.env["HTTPS_PARAMS_PATH"];
// パラメータを取得: options(json).
const options = JSON.parse(process.env["HTTPS_PARAMS_OPTIONS"]);

// レスポンス情報の返却が必要な場合.
if(options.response == true) {
    options.response = {};
// レスポンス返却が不要な場合.
} else {
    options.response = undefined;
}

// 非同期HTTPSClientを子プロセスで実行.
asyncHttpsClient.request(host, path, options)
// 正常処理.
.then((body) => {
    // ヘッダを取得.
    const res = options.response;
    // status, header, bodyをJSONセット.
    const ret = {
        status: res != undefined ? res.status : undefined,
        header: res != undefined ? res.header : undefined,
        body: body.toString('base64')
    };
    // コンソール出力.
    process.stdout.write(
        JSON.stringify(ret)
    );
    // プロセス終了.
    process.exit();
})
// 失敗処理.
.catch((err) => {
    // エラーログを出力.
    console.error("httpsClientError: host: " +
        host + " path: " + path, err);
    // エラーメッセージをコンソール出力.
    const ret = {"#error": err.toString()};
    process.stdout.write(
        JSON.stringify(ret)
    );
    // プロセス終了.
    process.exit();
})

})();