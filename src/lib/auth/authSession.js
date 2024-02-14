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

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// セッションログイン管理テーブル.
const sessionTable = defS3Kvs.currentTable("authSessions");

// token区切り文字.
const TOKEN_DELIMIRATER = "$_\n";

// １日 = ミリ秒.
const ONE_DAY_MS = 86400000;

// (raw)ユーザーセッション情報を読み込む.
const _loadSession = async function(user, passCode, sessionId) {
    const ret = await sessionTable.get("user", user);
    if(ret != undefined) {
        // パスコードやセッションIDが一致しない場合エラー.
        if(ret.passCode != passCode ||
            ret.sessionId != sessionId) {
            throw new Error("Failed to get session: " + user);
        }
        // セッションタイムアウトの場合.
        const expire = LOGIN_TOKEN_EXPIRE * ONE_DAY_MS;
        if(Date.now() >= (lastModified + expire)) {
            throw new Error("Failed to get session: " + user);
        }
        return ret;
    }
    throw new Error("Failed to get session: " + user);
}

// パスコードを生成.
const _getPassCode = function(userInfo) {
    return sig.getPassCode(
        userInfo.getUserName(),
        TOKEN_DELIMIRATER + request.host
            + TOKEN_DELIMIRATER + userInfo.getUserType()
            + TOKEN_DELIMIRATER + userInfo.getPermission()
            + TOKEN_DELIMIRATER + userInfo.groupSize()
            + TOKEN_DELIMIRATER + userInfo.getOptionSize()
            + TOKEN_DELIMIRATER + userInfo.getUserName()
    );
}

// 新しいユーザーセッションを作成.
// request Httpリクエスト情報を設定します.
// user 対象のユーザ名を設定します.
// 戻り値: {passCode: string, sessionId: stringm lastModified: number, userInfo: object}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
//        userInfo: ログインユーザ情報(authUser.UserInfo)が設定されます.
const create = async function(request, user) {
    // ユーザ名からユーザ情報を取得.
	const userInfo = await authUser.get(user);
    // パスコードを設定.
    const passCode = _getPassCode(userInfo);
    // セッションIDを設定.
    const sessionId = sig.createSessionId();
    // 更新時間.
    const lastModified = Date.now();
    // セッション情報の戻り値を生成.
    const ret = {
        passCode: passCode,
        sessionId: sessionId,
        lastModified: lastModified,
        userInfo: userInfo.get()
    };
    // セッション登録.
    if(await sessionTable.put("user", user, ret)) {
        // 登録時はUserInfoは連想配列で保存なので
        // authUser.UserInfoに再変換(passwordなし)で返却する.
        ret.userInfo = authUser.userInfo(ret.userInfo);
        return ret;
    }
    // 登録失敗の場合.
    throw new Error("Session creation failed: " + user);
}

// ユーザーセッションを取得.
// user 対象のユーザ名を設定します.
// passCode 取得条件のパスコードを設定します.
// sessionId 取得条件のセッションIDを設定します.
// 戻り値: {passCode: string, sessionId: stringm lastModified: number, userInfo: object}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
//        userInfo: ログインユーザ情報(authUser.UserInfo)が設定されます.
const get = async function(user, passCode, sessionId) {
    try {
        const ret = _loadSession(user, passCode, sessionId);
        if(ret != undefined) {
            // 登録時はUserInfoは連想配列で保存なので
            // authUser.UserInfoに再変換(passwordなし)で返却する.
            ret.userInfo = authUser.userInfo(ret.userInfo);
            return ret;
        }
    } catch(e) {
        // 取得失敗の場合エラー.
        throw new Error("Failed to get session: " + user, e);
    }
    // 取得失敗の場合エラー.
    throw new Error("Failed to get session: " + user);
}

// ユーザーセッションを削除.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合ユーザーセッションは削除できました.
const remove = async function(user, passCode, sessionId) {
    try {
        const ret = await sessionTable.get("user", user);
        if(ret != undefined) {
            // パスコードやセッションIDが一致しない場合エラー.
            if(ret.passCode != passCode ||
                ret.sessionId != sessionId) {
                return false;
            }
            // セッション削除.
            return await sessionTable.remove("user", user);
        }
    } catch(e) {}
    return false;
}

// ユーザーセッションを更新.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合、ユーザーセッションの更新成功です.
const update = async function(user, passCode, sessionId) {
    try {
        // セッションを取得.
        const session = _loadSession(user, passCode, sessionId);
        // 更新日付を更新.
        session.lastModified = Date.now();
        // セッション更新
        return await sessionTable.put("user", user, session);
    } catch(e) {}
    return false;
}

// [lambda側定義]ログイントークンキーコードを取得.
// request Httpリクエスト情報.
// 戻り値: ログイントークンキーコードが返却されます.
const _tokenKeyCode = function(request) {
    // ログイントークン作成用のキーコードを取得.
    let ret = LOGIN_TOKEN_KEYCODE;
    // ログイントークンキーコードを取得.
    if(ret == undefined) {
        // 取得できない場合はhost情報をhash化.
        ret = request.header.get("host");
    }
    return ret;
}



/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;
exports.get = get;
exports.remove = remove;
exports.update = update;



})();