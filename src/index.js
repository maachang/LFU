//////////////////////////////////////////////////////////
// lambda main.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// lambda main.
exports.handler = async (event, context) => {
    // イベント11超えでメモリーリーク警告が出るのでこれを排除.
    require('events').EventEmitter.
        defaultMaxListeners = 0;
    ////////////////////////////////////
    // 初期処理系はここにセット.
    ////////////////////////////////////

    // HttpErrorを利用可能に設定.
    require("./httpError.js");
    // frequire利用可能に設定.
    require("./freqreg.js");
    // grequire利用可能に設定.
    require("./greqreg.js");
    // s3require利用可能に設定.
    require("./s3reqreg.js");

    ////////////////////////////////////
    // LFUSetup実行.
    ////////////////////////////////////
    return await
        (require("./LFUSetup.js").start(event))
        (event, context);
};

})();
