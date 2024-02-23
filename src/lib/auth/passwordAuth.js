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

// authログイン.
const authLogin = frequire("./lib/auth/authLogin.js");

// authユーザ.
const authUser = frequire("./lib/auth/authUser.js");

// authUtil.
const authUtil = frequire("./lib/auth/util.js");

// [ENV]仮パスワードの長さ.
const ENV_TENTATIVE_PASSWORD_LENGTH = "TENTATIVE_PASSWORD_LENGTH";

// デフォルト仮パスワードの長さ.
const DEF_TENTATIVE_PASSWORD_LENGTH = 24;

// 仮パスワードを生成処理.
// 戻り値: 仮パスワードが返却されます.
const generateTentativePassword = function() {
    // 環境変数から仮パスワード長を取得.
    let len = process.env[ENV_TENTATIVE_PASSWORD_LENGTH]|0;
    if(len == 0) {
        // 存在しない場合はデフォルトパスワード長.
        len = DEF_TENTATIVE_PASSWORD_LENGTH;
    }
    // 仮パスワード返却.
    return sig.random.getBytes(len).toString("base64").substring(0, len);
}

// パスワード認証ログイン確認.
// params: {user: string, password: string}を設定します.
//         user 対象のユーザ名を設定します.
//         password パスワードを設定します.
// 戻り値: user名が返却された場合、ログイン成功です.
const _confirm = async function(params) {
    // パスワードが存在しない.
    if(!authUtil.useString(params.password)) {
        return null;
    }
    // ユーザ情報を取得.
    const userInfo = await authUser.get(params.user);
    // ユーザ情報が存在しない。もしくはパスワードユーザじゃない場合.
    // またはパスワードが一致しない.
    if(userInfo == undefined || !userInfo.isPasswordUser() ||
        !userInfo.equalsPassword(password)) {
        return null;
    }
    // ログイン成功.
    return params.user;
}

// パスワード認証でのログイン処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// user 対象のユーザー名を設定します.
// password 対象のパスワードを設定します.
const login = async function(
    resHeader, request, user, password) {
    await authLogin.login(
        resHeader, request,
        {user: user, password: password},
        _confirm);
}
// パスワード認証用のユーザー情報を生成.
// user 対象のユーザ名を設定します.
// 戻り値: 仮のパスワードが返却されます.ß
const createUser = async function(user) {
    // 仮パスワード作成.
    const password = generateTentativePassword();
    // パスワード専用ユーザ作成.
    await authUser.create(
        user, authUser.USER_INFO_PASSWORD, password);
    // 仮のパスワードを返却.
    return password;
}

// パスワード変更.
// user 対象のユーザ名を設定します.
// srcPassword 元のパスワードを設定します.
// newPassword 新しいパスワードを設定します.
const changePassword = async function(
    user, srcPassword, newPassword) {
    const userInfo = userInfo.get(user);
    userInfo.setPassword(oldPassword, newPassword);
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.login = login;
exports.createUser = createUser;
exports.changePassword = changePassword;

})();