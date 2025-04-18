//////////////////////////////////////////////////////////
// lambda main.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// イベント情報.
const events = require('events');

////////////////////////////////////
// 初期処理系はここにセット.
////////////////////////////////////

// HttpErrorを利用可能に設定.
require("./httpError.js");
// frequire利用可能に設定.
require("./freqreg.js");

// lorequire利用可能に設定.
if((process.env["require.loreqreg"] || "") != "false") {
    // [環境変数]require.loreqreg == "false" 以外は読み込む.
    require("./loreqreg.js");
}

// s3require利用可能に設定.
if((process.env["require.s3reqreg"] || "") != "false") {
    // [環境変数]require.s3reqreg == "false" 以外は読み込む.
    require("./s3reqreg.js");
}

// grequire利用可能に設定.
if((process.env["require.greqreg"] || "") != "false") {
    // [環境変数]require.greqreg == "false" 以外は読み込む.
    require("./greqreg.js");
}

// lambda main.
exports.handler = async function(
    event, context, callback) {
    ////////////////////////////////////
    // lambda用のcontext返却用 /
    // callback返却用 functionを定義.
    ////////////////////////////////////
    global.lambdaContext = function() {
        return context;
    }
    global.lambdaCallback = function() {
        return callback;
    }

    ////////////////////////////////////
    // イベント11超えでメモリーリーク
    // 警告が出るのでこれを排除.
    ////////////////////////////////////
    events.EventEmitter.defaultMaxListeners = 0;

    ////////////////////////////////////
    // callback実行後のhandler終了を
    // 待たない設定にする.
    ////////////////////////////////////
    context.callbackWaitsForEmptyEventLoop = false;

    ////////////////////////////////////
    // LFUSetup実行.
    ////////////////////////////////////
    return await (require("./LFUSetup.js")
        .start(event))(event);
};

})();
