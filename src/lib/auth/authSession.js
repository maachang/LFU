//////////////////////////////////////////
// 認証・認可用ログイントークン.
//////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// auth/util.
const authUtil = frequire("./lib/auth/util.js");

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// authUser.
const authUser = frequire("./lib/auth/authUser.js");

// １日 = ミリ秒.
const ONE_DAY_MS = 86400000;

// Cookieに格納するセッションID名.
const COOKIE_SESSION_KEY = "lfu-session-id";

// [ENV]ログイントークン作成キーコード.
const ENV_LOGIN_TOKEN_KEYCODE = "LOGIN_TOKEN_KEYCODE";

// [ENV]ログイントークン寿命定義.
const ENV_LOGIN_TOKEN_EXPIRE = "LOGIN_TOKEN_EXPIRE";

// [ENV]ログイントークン作成キーコードを取得.
const LOGIN_TOKEN_KEYCODE = process.env[ENV_LOGIN_TOKEN_KEYCODE];

// [ENV]ログイントークン寿命を取得.
// 指定してない場合は１日.
const LOGIN_TOKEN_EXPIRE = (process.env[ENV_LOGIN_TOKEN_EXPIRE]|0) <= 0 ?
	1 : process.env[ENV_LOGIN_TOKEN_EXPIRE]|0;

// token区切り文字.
const TOKEN_DELIMIRATER = "$_\n";

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// セッションログイン管理テーブル.
const sessionTable = defS3Kvs.currentTable("authSessions");

// 新しいユーザーセッションを作成.
// request Httpリクエスト情報を設定します.
// user 対象のユーザ名を設定します.
// 戻り値: nullでない場合正常に処理されました.
//        {passCode: string, sessionId: stringm lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const create = async function(request, user) {
	
}





})();