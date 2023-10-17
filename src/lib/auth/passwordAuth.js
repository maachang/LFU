//////////////////////////////////////////////
// パスワード認証を実現するためのモジュール.
//////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// ログインマネージャー.
const loginMan = frequire("./lib/auth/manager.js");

// authUtil.
const authUtil = frequire("./lib/auth/util.js");


// パスワード認証ログイン確認.
// user 対象のユーザ名を設定します.
// password パスワードを設定します.
// 戻り値: trueの場合、ログイン成功です.
const confirm = async function(user, password) {
    // パスワードが存在しない.
    if(!authUtil.useString(password)) {
        return false;
    }
    // パスワード認証のユーザ情報が存在しない場合.
    const userInfo = await loginMan.getUser(
        user, loginMan.createUserOptions(loginMan.USER_OPTIONS_AUTH_TYPE.name,
            loginMan.USER_OPTIONS_AUTH_TYPE.password));
    // パスワードをsha256変換.
    password = authUtil.sha256(password);
    // パスワードが不一致.
    if(userInfo[loginMan.USER_INFO_PASSWORD] != password) {
        return false;
    }
    // ログイン成功.
    return true;
}

// パスワード認証でのログイン処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// user 対象のユーザー名を設定します.
// password 対象のパスワードを設定します.
// 戻り値: trueの場合、ログインに成功しました.
const login = async function(
    resHeader, request, user, password) {
    try {
        // ログイン処理.
        const result = await confirm(user, password);
        // ログイン成功.
        if(result == true) {
            // 新しいセッションを作成.
            const sessions = await loginMan.createSession(request, user);
            if(sessions == null) {
                // 新しいセッション取得に失敗.
                throw new Error("Failed to get a login session.");
            }

            // ログイントークン作成用のキーコードを取得.
            const keyCode = loginMan.getLoginTokenKeyCode(request);

            // ログイントークンを作成.
            const token = sig.encodeToken(
                keyCode, user, sessions.passCode,
                sessions.sessionId, loginMan.LOGIN_TOKEN_EXPIRE);

            // レスポンスCookieにセッションキーを設定.
            resHeader.putCookie(loginMan.COOKIE_SESSION_KEY, {value: token});
            return true;
        }
    } catch(e) {
        console.error("I failed to login", e);
    }
    // ログイン失敗.
    return false;
}


// パスワード認証用のユーザー情報を生成.
// user 対象のユーザ名を設定します.
// password 対象のパスワードを設定します.
// userInfo ユーザ情報オプションを設定します.
// 戻り値: trueの場合登録できました.
const createUser = async function(
    user, password, userInfo) {
    if(!authUtil.useString(password)) {
        throw new Error("Password has not been set.");
    }
    // 登録ユーザ情報.
    const regUserInfo = {};
    if(userInfo != undefined && userInfo != null) {
        let kk;
        for(let k in userInfo) {
            // 先頭に@があるのは、追加できない.
            if((kk = k.trim()).startsWith("@")) {
                continue;
            }
            regUserInfo[kk] = userInfo[k];
        }
    }
    // password認証として登録.
    regUserInfo[loginMan.USER_INFO_LOGIN_TYPE.name] =
        loginMan.USER_INFO_LOGIN_TYPE.password;
    // パスワードをsha256変換.
    regUserInfo[loginMan.USER_INFO_PASSWORD] = authUtil.sha256(password);
    // 登録.
    return await loginMan.createUser(user, regUserInfo);
}

// パスワード変更.
// user 対象のユーザ名を設定します.
// srcPassword 元のパスワードを設定します.
// newPassword 新しいパスワードを設定します.
// 戻り値: trueの場合パスワードの変更ができました.
const changePassword = async function(
    user, srcPassword, newPassword) {
    if(!authUtil.useString(srcPassword)) {
        throw new Error("srcPassword has not been set.");
    } else if(!authUtil.useString(newPassword)) {
        throw new Error("newPassword has not been set.");
    }
    // パスワード認証のユーザ情報を取得.
    const userInfo = await loginMan.getUser(
        user, loginMan.createUserOptions(loginMan.USER_OPTIONS_AUTH_TYPE.name,
            loginMan.USER_OPTIONS_AUTH_TYPE.password));
    // 元のパスワードをsha256変換.
    srcPassword = authUtil.sha256(srcPassword);
    // パスワードが不一致.
    if(userInfo[loginMan.USER_INFO_PASSWORD] != srcPassword) {
        throw new Error("Original password does not match.");
    }
    // 新しいパスワードをsha256変換.
    newPassword = authUtil.sha256(newPassword);
    userInfo[loginMan.USER_INFO_PASSWORD] = newPassword;
    // 再登録.
    return await userTable.put("user", user, userInfo)
}


////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.manager = loginMan;
exports.login = login;
exports.createUser = createUser;
exports.changePassword = changePassword;


})();