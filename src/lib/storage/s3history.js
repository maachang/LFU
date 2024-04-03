///////////////////////////////////////////////////////////////////////
// たとえば、登録処理を行った内容を履歴管理を行います.
// 内容としては
// + yyyyMM
//     |
//     +- yyyyMMdd
//          |
//          +- yyyyMMddHHmmssSSS_name.(json or csv)
// 
// このような形式でS3に出力されます.
// 中身については、特に暗号化とかされないので、センシティブな情報の出力は
// 控えてください.
///////////////////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// s3client.
const s3 = frequire("./lib/s3client.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]メインS3Kvs-Prefix.
const ENV_MAIN_S3_HISTORY_PREFIX = "MAIN_S3_HISTORY_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "s3History";

// list取得での１度での最大リスト数.
const MAX_LIST = 100;






})();
