//////////////////////////////////////////
// ログイン認証処理.
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

// authSession. 
const authSession = frequire("./lib/auth/authSession.js");

// authUser. 
const authUser = frequire("./lib/auth/authUser.js");

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// Cookieに格納するセッションID名.
const COOKIE_SESSION_KEY = "lfu-session-id";

// [ENV]ログイントークン作成キーコード.
const ENV_LOGIN_TOKEN_KEYCODE = "LOGIN_TOKEN_KEYCODE";

// [ENV]ログイントークン作成キーコードを取得.
const LOGIN_TOKEN_KEYCODE = process.env[ENV_LOGIN_TOKEN_KEYCODE];

// userInfo用のRequestキャッシュ名.
const USER_INFO_REQUEST_CACHE = "userInfoCache";

// ログイントークンキーコードを取得.
// request Httpリクエスト情報.
// 戻り値: ログイントークンキーコードが返却されます.
const getTokenKeyCode = function(request) {
    // ログイントークン作成用のキーコードを取得.
    let ret = LOGIN_TOKEN_KEYCODE;
    // ログイントークンキーコードを取得.
    if(ret == undefined) {
        // 取得できない場合はhost情報をhash化.
        ret = request.header.get("host");
    }
    return ret;
}

// ログイン処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// params ログインパラメータを設定します.
// call ログイン固有の実行処理を設定します.
//      userInfo = await call(params)の形で処理します.
//      またuserInfoが返却されない場合、ログイン失敗となります.
// 戻り値: 成功した場合はuserInfoが返却されます.
const login = async function(resHeader, request, params, call) {
    try {
        // ログイン処理.
        const userInfo = await call(params);
        
        // ログイン成功.
        if(userInfo != null && userInfo != undefined) {
            // 新しいログインセッションを作成.
            const session = await authSession.create(
                request, userInfo.getUserName());
            if(session == null) {
                // 新しいセッション取得に失敗.
                throw new Error("Failed to get a login session.");
            }
            // ログイントークン作成用のキーコードを取得.
            const keyCode = getTokenKeyCode(request);

            // ログイントークンを作成.
            const token = sig.encodeToken(
                keyCode, userInfo.getUserName(), session.passCode,
                session.sessionId, authSession.LOGIN_TOKEN_EXPIRE);

            // レスポンスCookieにセッションキーを設定.
            resHeader.putCookie(COOKIE_SESSION_KEY, {value: token});
            return userInfo;
        }
    } catch(e) {
        console.error("I failed to login", e);
    }
    // ログイン失敗.
    throw new Error("Login processing failed.");
}

// ログアウト処理.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// 戻り値: trueの場合、ログアウトに成功しました.
const logout = async function(resHeader, request) {
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていない.
            return false;
        }
        // トークンの解析・内容を取得.
        const keyCode = getTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);
        // ユーザーセッションを削除.
        const res = await authSession.remove(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        // ユーザセッション削除に成功した場合.
        if(res == true) {
            // cookieセッションを削除.
            resHeader.putCookie(COOKIE_SESSION_KEY,
                {value: token, "max-age": 0});
        }
        return res;
    } catch(e) {
        // ログイン確認エラー
        console.error("I failed to logout", e);
    }
    // ログアウト失敗.
    return false;
}

// ログイン確認.
// 対象のリクエストでログイン済みかチェックします.
// level チェックレベルを設定します.
//       0: トークンの存在確認を行います.
//       1: level = 0 + トークンのexpireチェックを行います.
//       2: level = 1 + トークンをs3kvsに問い合わせます.
// resHeader レスポンスヘッダ(./lib/httpHeader.js)
// request Httpリクエスト情報.
// 戻り値: trueの場合、ログインされています.
const isLogin = async function(level, resHeader, request) {
    // マイナス値の場合は処理しない.
    level = level|0;
    if(level < 0) {
        // ログイン済みとみなす.
        return true;
    }
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていない.
            return false;
        }
        // level=0の場合、ログインされているとみなす.
        if(level == 0) {
			// トークンがCookieに存在.
            // level=0的にログイン担保.
            return true;
        }
        // トークンの解析.
        const keyCode = getTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);
        // expire値を超えている場合.
        if(Date.now() >= dtoken.expire) {
            // ログインされていない.
            return false;
        }
        // level=1の場合、ログインされているとみなす.
        if(level == 1) {
            // level=1的にログイン担保.
            return true;
        }
        // ユーザーセッションをアップデート(この処理が結構重い).
        const ret = await authSession.update(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        
        // アップデート成功の場合.
        if(ret == true) {
            // セッションアップデートのタイミングでcookie内容も更新する.

            // 更新するログイントークンを作成.
            const nextToken = sig.encodeToken(
                keyCode, dtoken.user, dtoken.passCode,
                dtoken.sessionId, authSession.LOGIN_TOKEN_EXPIRE);

            // レスポンスにセッションキーを再設定.
            resHeader.putCookie(COOKIE_SESSION_KEY, {value: nextToken});
            // 前のセッションを削除.
            resHeader.putCookie(COOKIE_SESSION_KEY,
                {value: token, "max-age": 0});
        }

        return ret;
    } catch(e) {
        // ログイン確認エラー
        console.error("Login verification failed.", e);
        // ログインされていない.
        return false;
    }
}

// 現在ログイン中のユーザ名を取得.
// request 対象のrequestを設定.
// 戻り値: ログイン中のユーザを返却.
//        ログインしていない場合はundefined.
const getUserName = function(request) {
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(
			COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていないので空返却.
            return undefined;
        }
        // トークンの解析.
        const keyCode = getTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);

        // expire値を超えている場合(セッション切れ)
        if(Date.now() >= dtoken.expire) {
            // ログインされていないので空返却.
            return undefined;
        }
        // ユーザー名返却.
        return dtoken.user;
    } catch(e) {
        // 例外なので空返却.
        console.log("[error]", e);
    }
    return undefined;
}

// 現在ログイン中のUserInfoを取得.
// ※ またこの機能はよく使われるので、一度取得したuserInfoは
// request内で一時保存されます.
// request 対象のrequestを設定.
// 戻り値: ログイン中のUserInfoを返却.
//        ログインしていない場合はundefined.
const getUserInfo = async function(request) {
	const userName = getUserName(request);
	if(userName == undefined) {
		return undefined;
	}
    // userInfoはRequestにキャッシュ化する事で無駄なI/Oを回避する.
    let userInfo = request[USER_INFO_REQUEST_CACHE];
    if(userInfo == undefined || userInfo.getUserName() != userName) {
        userInfo = await authUser.get(userName);
        request[USER_INFO_REQUEST_CACHE] = userInfo;
    }
    return userInfo;
}

// ログイン済みか確認をするfilter実行.
// _ Array[0]に返却対象の処理結果のレスポンスBodyを設定します
//   ※ 設定無用.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request Httpリクエスト情報.
// noCheckPaths チェック対象外のパス郡を設定します.
//              {"/index.html", true} のような感じで.
//              ※ 条件を設定しない場合は対象としません.
// 戻り値: true / false(boolean).
//        trueの場合filter処理で処理終了となります.
const filter = async function(
    _, resState, resHeader, request, noCheckPaths) {
    // チェック対象外のパス.
    if(noCheckPaths != undefined && noCheckPaths != null &&
        noCheckPaths[request.path]) {
        return false;
    }
    // 拡張子を取得.
    const extension = request.extension;
    let level = 0;
    // 動的処理のリクエストの場合.
    if(extension == undefined || extension == "jhtml") {
        // トークンの完全チェック.
        level = 2;
    // htmlファイルの場合.
    } else if(extension == "htm" || extension == "html") {
        // トークンの存在チェック.
        level = 2;
    // メイン以外のコンテンツ情報.
    } else {
        // チェックしない.
        level = -1;
    }
    // ログインされていない事を確認.
    if(!(await isLogin(level, resHeader, request))) {
        // エラー403返却.
        resState.setStatus(403);
        return true;
    }
    // 正常な状態.
    return false;
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.COOKIE_SESSION_KEY = COOKIE_SESSION_KEY;
exports.login = login;
exports.logout = logout;
exports.isLogin = isLogin;
exports.getUserName = getUserName;
exports.getUserInfo = getUserInfo;
exports.getTokenKeyCode = getTokenKeyCode;
exports.filter = filter;

})();
