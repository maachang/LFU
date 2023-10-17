//////////////////////////////////////////
// ログインマネージャー.
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

// １日 = ミリ秒.
const ONE_DAY_MS = 86400000;

// Cookieに格納するセッションID名.
const COOKIE_SESSION_KEY = "lfu-session-id";

// [ENV]ログイントークン作成キーコード.
const ENV_LOGIN_TOKEN_KEYCODE = "LOGIN_TOKEN_KEYCODE";

// [ENV]最大ユーザー表示件数設定.
const ENV_LOGIN_USER_LIST_LIMIT = "LOGIN_USER_LIST_LIMIT";

// [ENV]ログイントークン寿命定義.
const ENV_LOGIN_TOKEN_EXPIRE = "LOGIN_TOKEN_EXPIRE";

// [ENV]ログイントークン作成キーコードを取得.
const LOGIN_TOKEN_KEYCODE = process.env[ENV_LOGIN_TOKEN_KEYCODE];

// [ENV]最大表示件数.
let LOGIN_USER_LIST_LIMIT = process.env[ENV_LOGIN_USER_LIST_LIMIT]|0;
if(LOGIN_USER_LIST_LIMIT >= 100) {
    LOGIN_USER_LIST_LIMIT = 100;
} else if(LOGIN_USER_LIST_LIMIT <= 0) {
    LOGIN_USER_LIST_LIMIT = 25;
}

// [ENV]ログイントークン寿命を取得.
let LOGIN_TOKEN_EXPIRE = process.env[ENV_LOGIN_TOKEN_EXPIRE];
if(LOGIN_TOKEN_EXPIRE == undefined) {
    LOGIN_TOKEN_EXPIRE = 1;
}

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// ログインユーザテーブル.
const userTable = defS3Kvs.currentTable("loginUser");

// セッションログイン管理テーブル.
const sessionTable = defS3Kvs.currentTable("loginSession");

// [UserInfo]ユーザー名.
const USER_INFO_USER = "@user";

// [UserInfo]パスワード.
const USER_INFO_PASSWORD = "@password";

// [UserInfo]ログインタイプ.
const USER_INFO_LOGIN_TYPE = {
    // タイプ名.
    name: "@loginType",
    // [ログインタイプ]パスワード.
    password: "password",
    // [ログインタイプ]oauth.
    oauth: "oauth"
};

// [userOptions]認証タイプ.
const USER_OPTIONS_AUTH_TYPE = {
    name: "@authType",
    // [認証タイプ]全て.
    all: "all",
    // [認証タイプ]パスワード.
    password: USER_INFO_LOGIN_TYPE.password,
    // [認証タイプ]oauth.
    oauth: USER_INFO_LOGIN_TYPE.oauth
};

// [userOptions]パスワード除外.
const USER_OPTIONS_NONE_PASSWORD = "nonePassword";

// ユーザ情報オプションを生成します.
// arguments
//   [key, value ...]
//   引数に対してkey, valueを設定します.
// 戻り値: ユーザー情報オプションが返却されます.
const createUserOptions = function() {
    const args = arguments;
    const len = args.length;
    const ret = {};
    for(let i = 0; i < len; i += 2) {
        ret[args[i]] = args[i + 1];
    }
    return ret;
}

// S3に登録されているユーザー情報を取得.
// user 対象のユーザ名を設定します.
// 戻り値: {@password: string, .... }
//         @password: パスワード(sha256)が返却されます.
//         それ以外のパラメータも設定されています.
const _getUser = async function(user) {
    if(!authUtil.useString(user)) {
        throw new Error("User has not been set.");
    }
    try {
        // ユーザー情報を取得.
        const ret = await userTable.get("user", user);
        if(ret != undefined && ret != null) {
            // 取得成功.
            return ret;
        }
    } catch(e) {
        // 例外.
        throw new Error("The user ("
            + user + ") does not exist.", e);
    }
    // 取得失敗.
    throw new Error("The user ("
        + user + ") does not exist.");
}

// 指定ユーザー名が物理的に登録されているかチェック.
// user 対象のユーザ名を設定します.
// 戻り値: trueの場合存在します.
const isUser = async function(user) {
    try {
        // ここでは、単純にユーザ情報が登録されているかを
        // 確認する.
        await _getUser(user);
        return true;
    } catch(e) {
    }
    return false;
}

// ユーザーオプションを指定したユーザ情報を取得.
// user 対象のユーザ名を設定します.
// userInfo ユーザー情報オプションを設定します.
//          ここに 取得したいauthTypeを設定します.
//          またパスワードを取得しない場合はnonePassword = trueを
//          設定します.
// 戻り値: ユーザー情報返却が返却されます.
const getUser = async function(user, userInfo) {
    // ユーザー情報オプションの存在チェック.
    userInfo = userInfo == undefined || userInfo == null ?
        {} : userInfo;
    // ユーザーオプションからauthTypeを取得.
    let authType = userInfo[USER_OPTIONS_AUTH_TYPE.name];
    // 存在しない場合は全ての条件の情報を取得.
    if(authType == undefined) {
        authType = USER_OPTIONS_AUTH_TYPE.all;
    }
    // 認証タイプ別で情報を取得.
    try {
        let ret = null;
        switch(authType) {
            case USER_OPTIONS_AUTH_TYPE.all:
                // 条件なし(_getUserで取得).
                ret = await _getUser(user);
                break;
            case USER_OPTIONS_AUTH_TYPE.password: 
                // パスワード認証用のユーザー情報を取得.
                ret = await getUserToAuthPassword(user);
                break;
            case USER_OPTIONS_AUTH_TYPE.oauth: 
                // oauth認証用のユーザー情報を取得.
                ret = await getUserToOAuth(user);
                break;
        }
        // UserInfoからパスワードを除外する場合.
        if(("" + userInfo[USER_OPTIONS_NONE_PASSWORD]) == "true") {
            // パスワードは不要なので除外.
            delete ret[USER_INFO_PASSWORD];
        }
        return ret;
    } catch(e) {
        console.log("Failed to obtain user information: " + user, e);
    }
    // 取得失敗.
    throw new HttpError({
        status: 500,
        message: "Authentication type not found for user ("
            + user + "): " + authType
    });
}

// パスワード認証用のユーザー情報を取得.
// user 対象のユーザ名を設定します.
// 戻り値: ユーザー情報が返却されます.
const getUserToAuthPassword = async function(user) {
    // 指定ユーザ登録情報を取得.
    const ret = await _getUser(user);
    // 登録ユーザがパスワード認証でない場合.
    if(ret[USER_INFO_LOGIN_TYPE.name] != USER_INFO_LOGIN_TYPE.password) {
        // エラー返却.
        throw new HttpError({
            status: 500,
            message: "User (" + user +
            ") is not a password authenticated user."
        })
    }
    return ret;
}

// oAuth用のユーザー情報を取得.
// user 対象のユーザ名を設定します.
// 戻り値: ユーザー情報が返却されます.
//         
const getUserToOAuth = async function(user) {
    let ret = null;
    try {
        // 指定ユーザ登録情報を取得.
        ret = await _getUser(user);
    } catch(e) {
        ret = null;
    }
    // 対象ユーザーがoauthユーザとして作成されていない場合.
    if(ret != null &&
        ret[USER_INFO_LOGIN_TYPE.name] != USER_INFO_LOGIN_TYPE.oauth) {
        // oauthユーザじゃないので、ユーザなし.
        throw new HttpError({
            status: 500,
            message: "Target user (" + user + ") is not an oauth user."
        });
    // ユーザ情報に存在しない場合.
    } else if(ret == null) {
        // 最低限のoauthユーザ情報を返却.
        ret = {};
        ret[USER_INFO_LOGIN_TYPE.name] = USER_INFO_LOGIN_TYPE.oauth;
        ret[USER_INFO_USER] = user;
    }
    return ret;
}

// ユーザー情報を生成.
// user 対象のユーザ名を設定します.
// userInfo ユーザ情報オプションを設定します.
// 戻り値: trueの場合登録できました.
const createUser = async function(user, userInfo) {
    // 既にユーザ情報が存在する場合.
    if(await isUser(user)) {
        throw new Error(
            "User (" + user + ") already exists.");
    // ログインタイプが設定されていない場合.
    } else if(userInfo[USER_INFO_LOGIN_TYPE.name] == undefined) {
        throw new HttpError({
            status: 500,
            message: "Unknown authentication type for user (" + user+ ")."
        });
    }
    // 登録対象ユーザー情報を生成.
    const regUserInfo = {};
    // 設定されたオプションをセット.
    if(userInfo != undefined && userInfo != null) {
        for(let k in userInfo) {
            regUserInfo[k] = userInfo[k];
        }
    }
    // ユーザー名をセット.
    regUserInfo[USER_INFO_USER] = user;
    // ユーザー情報を登録.
    return await userTable.put("user", user, regUserInfo);
}

// ユーザ削除.
// user 対象のユーザ名を設定します.
// 戻り値: trueの場合ユーザ情報が削除できました.
const removeUser = async function(user) {
    // ユーザ情報を削除.
    try {
        if(await isUser(user)) {
            return await userTable.remove("user", user);
        }
    } catch(e) {
        // 削除エラー
        console.error("User (" + user + ") deletion failed", e);
    }
    // 存在しない場合.
    return false;
}

// オプションを設定/削除.
// putFlag 設定の場合はtrue.
// user 対象のユーザー名を設定します.
// userInfo 変更/削除用のユーザ情報オプションを設定します.
// 戻り値: trueの場合正常に処理できました.
const settingOption = async function(putFlag, user, userInfo) {
    // パスワードを除いたユーザー情報.
    const loadUserInfo = await getUser(
        user, createUserOptions(
            USER_OPTIONS_NONE_PASSWORD, true));
    // 変更/削除用のユーザ情報オプションをセット.
    if(userInfo != undefined && userInfo != null) {
        let kk;
        for(let k in userInfo) {
            // 先頭に@があるのはオプション設定できない.
            if((kk = k.trim()).startsWith("@")) {
                continue;
            // 設定.
            } else if(putFlag) {
                loadUserInfo[kk] = userInfo[k];
            // 削除.
            } else {
                delete loadUserInfo[kk];
            }
        }
    }
    return await userTable.put(
        "user", user, loadUserInfo);
}

// ユーザ名一覧を取得.
// page ページ番号を設定します.
//      ページ番号は１から設定します.
// max １ページで表示する数を設定します.
//     最大は100で、設定しない場合は 環境変数 `LOGIN_USER_LIST_LIMIT` の
//     値が設定され、存在しない場合は25が設定されます.
const userList = async function(page, max) {
    if(max == undefined || max == null) {
        max = LOGIN_USER_LIST_LIMIT;
    }
    page = page|0;
    if(page >= 0) {
        page = 1;
    }
    // １ページの情報を取得.
    const list = await userTable.list(page, max);
    // 情報が存在しない場合.
    if(list == null) {
        return [];
    }
    const ret = [];
    const len = list.length;

    // ユーザー情報オプションを生成.
    // パスワードなしで取得.
    const userOptions = createUserOptions(
        USER_OPTIONS_NONE_PASSWORD, true);
    for(let i = 0; i < len; i ++) {
        // 対象がユーザ情報じゃない場合.
        if(list[i].key != "user") {
            // 無視.
            continue;
        }
        // パスワードを除いたユーザー情報.
        const userInfo = await getUser(
            list[i].value, userOptions);
        ret[i] = userInfo;
    }
    return ret;
}

// token区切り文字.
const TOKEN_DELIMIRATER = "$_\n";

// ユーザーセッションを作成.
// request Httpリクエスト情報を設定します.
// user 対象のユーザ名を設定します.
// userOptions ユーザーオプションを設定します.
// 戻り値: nullでない場合正常に処理されました.
//        {passCode: string, sessionId: stringm lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const createSession = async function(request, user, userOptions) {
    // ユーザ情報が存在しない場合.
    const userInfo = await getUser(user, userOptions);
    // パスワードを取得.
    let pass = userInfo[USER_INFO_PASSWORD];
    if(pass == undefined) {
        // パスワードが存在しない場合(oauthなど).
        pass = "$noPassword";
    }
    // パスコードを設定.
    userInfo.passCode = sig.getPassCode(
        user, request.host + TOKEN_DELIMIRATER + userInfo[USER_INFO_LOGIN_TYPE.name]
            + TOKEN_DELIMIRATER + pass);
    // セッションIDを設定.
    userInfo.sessionId = sig.createSessionId();
    // 更新時間.
    userInfo.lastModified = Date.now();
    // パスワードを削除.
    delete userInfo[USER_INFO_PASSWORD];
    // セッション登録.
    if(await sessionTable.put("user", user, userInfo) == true) {
        return userInfo;
    }
    return null;
}

// ユーザーセッションを取得.
// user 対象のユーザ名を設定します.
// 戻り値: nullでない場合、ユーザセッションが存在します.
//        {passCode: string, sessionId: string lastModified: number}
//        passCode パスコードが返却されます.
//        sessionId セッションIDが返却されます.
//        lastModified セッション生成時間(ミリ秒)が設定されます.
const getSession = async function(user) {
    return await sessionTable.get("user", user);
}

// ユーザーセッションを削除.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合ユーザーセッションは削除できました.
const removeSession = async function(
    user, passCode, sessionId) {
    const sessionInfo = await sessionTable.get("user", user);
    if(sessionInfo == null) {
        // 取得出来ない場合は削除失敗.
        return false;
    }
    // パスコードとセッションIDをチェック.
    if(passCode != sessionInfo.passCode ||
        sessionId != sessionInfo.sessionId) {
        // 一致しない場合は削除失敗.
        return false;
    }
    // セッション削除.
    return await sessionTable.remove("user", user);
}

// ユーザーセッションが保持する最終更新時間がexpire時間を
// 超えていないかチェック.
// lastModified ユーザーセッションのlastModifiedを設定します.
// 戻り値: trueの場合、expire時間を超えています.
const isUserSessionToExpire = function(lastModified) {
    const expire = ONE_DAY_MS * LOGIN_TOKEN_EXPIRE;
    if(Date.now >= (lastModified + expire)) {
        return true;
    }
    return false;
}

// ユーザーセッションを更新.
// user 対象のユーザ名を設定します.
// passCode 対象のパスコードを設定します.
// sessionId 対象のセッションIDを設定します.
// 戻り値: trueの場合、ユーザーセッションの更新成功です.
const updateSession = async function(
    user, passCode, sessionId) {
    const sessionInfo = await sessionTable.get("user", user);
    if(sessionInfo == null) {
        // 取得出来ない場合は更新失敗.
        return false;
    }
    // パスコードとセッションIDをチェック.
    if(passCode != sessionInfo.passCode ||
        sessionId != sessionInfo.sessionId ||
        isUserSessionToExpire(
            sessionInfo.lastModified)) {
        // 一致しない場合は更新失敗.
        return false;
    }
    // 更新時間を更新する.
    sessionInfo.lastModified = Date.now();
    // セッション更新
    return await sessionTable.put("user", user, sessionInfo);
}

// ログイントークンキーコードを取得.
// request Httpリクエスト情報.
// 戻り値: ログイントークンキーコードが返却されます.
const getLoginTokenKeyCode = function(request) {
    // ログイントークン作成用のキーコードを取得.
    let ret = LOGIN_TOKEN_KEYCODE;
    // ログイントークンキーコードを取得.
    if(ret == undefined) {
        // 取得できない場合はhost情報をhash化.
        ret = request.header.get("host");
    }
    return ret;
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
        const keyCode = getLoginTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);
        // ユーザーセッションを削除.
        const res = await removeSession(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        // ユーザセッション削除に成功した場合.
        if(res == true) {
            // cookieセッションを削除.
            resHeader.putCookie(COOKIE_SESSION_KEY,
                {value: token, expires: new Date(0).toUTCString()});
        }
        return res;
    } catch(e) {
        // ログイン確認エラー
        console.error("I failed to logout", e);
    }
    // ログアウト失敗.
    return false;
}

// 現在ログイン中のユーザを取得.
// request 対象のrequestを設定.
// 戻り値: ログイン中のユーザを返却.
//        ログインしていない場合はundefined.
const getLoginUserName = function(request) {
    try {
        // cookieからログイントークンを取得.
        const token = request.header.getCookie(COOKIE_SESSION_KEY);
        if(token == undefined) {
            // ログインされていないので空返却.
            return undefined;
        }
        // トークンの解析.
        const keyCode = getLoginTokenKeyCode(request);
        const dtoken = sig.decodeToken(keyCode, token);

        // expire値を超えている場合(セッション切れ)
        if(Date.now() >= dtoken.expire) {
            // ログインされていないので空返却.
            return undefined;
        }
        // ユーザー名を取得.
        return dtoken.user;
    } catch(e) {
        // 例外なので空返却.
        console.log("[error]", e);
        return undefined;
    }
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
            // level=0的にログイン担保.
            return true;
        }
        // トークンの解析.
        const keyCode = getLoginTokenKeyCode(request);
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
        const ret = await updateSession(
            dtoken.user, dtoken.passCode, dtoken.sessionId);
        // アップデート成功の場合.
        if(ret == true) {
            // セッションアップデートのタイミングで
            // cookie内容も更新する.

            // 更新するログイントークンを作成.
            const nextToken = sig.encodeToken(
                keyCode, dtoken.user, dtoken.passCode,
                dtoken.sessionId, LOGIN_TOKEN_EXPIRE);

            // レスポンスにセッションキーを再設定.
            resHeader.putCookie(COOKIE_SESSION_KEY, {value: nextToken});
        }
        return ret;
    } catch(e) {
        // ログイン確認エラー
        console.error("Login verification failed.", e);
        // ログインされていない.
        return false;
    }
}

// 現在のログイン中ユーザー情報を取得.
// request 対象のHTTPリクエストを設定します.
// userOptions ユーザーオプションを設定します.
//             {authType: string}
//               authType: "password"
//                 パスワード認証のユーザ情報を取得します.
//               authType: "oauth"
//                 oauth認証のユーザ情報を取得します.
// 戻り値: 現在ログイン中のユーザー情報が返却されます.
//        ただし、パスワードは除外されます.
//        {@user: string, ....}
//        @user: ログイン中のユーザー名が返却されます.
//        それ以外は設定されているタグ名(たとえば admin など)が
//        設定されたりします.
//        ログインユーザが存在しない場合はundefined.
const getLoginInfo = async function(request, userOptions) {
    let user = getLoginUserName(request);
    if(user == undefined) {
        return undefined;
    }
    let oauthUser = false;
    // 対象ユーザのセッション情報を取得.
    const session = await getSession(user);
    // 現在のセッションに対するログインタイプがoauthかチェック.
    if(session[USER_INFO_LOGIN_TYPE.name] == USER_INFO_LOGIN_TYPE.oauth) {
        // oauthの場合はユーザが存在しない可能性もあるので、その場合は最低限の情報を「ユーザ情報」として返却する.
        oauthUser = true;
    }
    try {
        // ユーザ情報を取得.
        const userInfo = await getUser(
            user, userOptions);
        if(userInfo == null) {
            // ユーザー情報が存在しない場合エラー返却.
            throw new HttpError({
                status: 500,
                message: "The logged-in user information \"" + user +
                "\" has already been deleted and does not exist."
            });
        }
        // password以外のUserInfoを返却.
        const ret = {};
        for(let k in userInfo) {
            // パスワードは格納しない.
            if(k == USER_INFO_PASSWORD) {
                continue;
            }
            ret[k] = userInfo[k];
        }
        ret[USER_INFO_USER] = user;
        return ret;
    } catch(e) {
        // oauthユーザじゃない場合.
        if(!oauthUser) {
            throw e;
        }
        // oauthユーザの場合.
        const ret = {};
        ret[USER_INFO_LOGIN_TYPE.name] = USER_INFO_LOGIN_TYPE.oauth;
        ret[USER_INFO_USER] = user;
        return ret;
    }
}

// ログイン済みユーザーオプションの条件確認.
// たとえば、このユーザーのオプションに admin: true
// が存在するかをチェックする場合
// isLoginOption(request, {admin: true})
// のような形でチェックすることが出来ます.
// request 対象のHTTPリクエストを設定します.
// option チェック対象のオプションを設定します.
// 戻り値: trueの場合、オプションは一致しています.
const isLoginOption = function(request, option) {
    if(option == undefined || option == null) {
        return false;
    }
    const list = getLoginInfo(request);
    for(let key in option) {
        const n = list[key];
        if(n == undefined || option[key] != n) {
            return false;
        }
    }
    return true;
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
    // ログインされているかチェックしない場合.
    return false;
}

// 時限的セッションのトークンユーザ名.
const TIMED_SESSION_USER = "*#^#&8)|<!@";

// 時限的トークンのトークンパスコード.
const TIMED_SESSION_PASSCODE = "!)*^$#|\n" + TIMED_SESSION_USER;

// ログインアクセス時の時限的セッションを生成.
// この処理はたとえば `/login.lfu.js` のような、ログインの認証アクセスを
// する場合において、ユーザー・パスワードの量的アタックを防ぐためのトークンを発行します.
// request Httpリクエスト情報.
// expire 時限的トークンの寿命をミリ秒単位で指定します.
// 戻り値: トークンが返却されるので、この値をHTTPヘッダ等に設定して、
//         ログイン認証時に読み込んで、アタック回避をします.
const createTimedSession = function(request, expore) {
    // ログイントークンキーコードを取得.
    const tokenKeyCode = getLoginTokenKeyCode(request);
    // トークン発行.
    return sig.encodeToken(
        tokenKeyCode + "|\n" + request.header.get("host"),
        TIMED_SESSION_USER, TIMED_SESSION_PASSCODE,
        sig.createSessionId(34), null, expore);
}

// ログインアクセス時の時限的セッションを復元して正しく利用できるかチェック.
// request Httpリクエスト情報.
// timedSession 対象の時限的トークンを設定します.
// 戻り値: trueの場合、時限的セッションは正しいです.
const isTimedSession = function(request, timedSession) {
    // ログイントークンキーコードを取得.
    const tokenKeyCode = getLoginTokenKeyCode(request);
    // 対象のtimedSessionを解析.
    const sessions = sig.decodeToken(
        tokenKeyCode + "|\n" + request.header.get("host"),
        timedSession);
    // 固定のパスコードとユーザ名の凸合.
    if(sessions.passCode == TIMED_SESSION_PASSCODE &&
        sessions.user == TIMED_SESSION_USER && 
        sessions.expire > Date.now()) {
        return true;
    }
    return false;
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
// 定義内容.
exports.COOKIE_SESSION_KEY = COOKIE_SESSION_KEY;
exports.LOGIN_TOKEN_EXPIRE = LOGIN_TOKEN_EXPIRE;
exports.USER_INFO_USER = USER_INFO_USER;
exports.USER_INFO_PASSWORD = USER_INFO_PASSWORD;
exports.USER_INFO_LOGIN_TYPE = USER_INFO_LOGIN_TYPE;
exports.USER_OPTIONS_AUTH_TYPE = USER_OPTIONS_AUTH_TYPE;
exports.USER_OPTIONS_NONE_PASSWORD = USER_OPTIONS_NONE_PASSWORD;

// 定義メソッド.
exports.getLoginTokenKeyCode = getLoginTokenKeyCode;
exports.createUserOptions = createUserOptions;
exports.isUser = isUser;
exports.createUser = createUser;
exports.removeUser = removeUser;
exports.putOption = function(user, options) {
    return settingOption(true, user, options);
}
exports.removeOption = function(user, options) {
    return settingOption(false, user, options);
}
exports.getUser = getUser;
exports.userList = userList;
exports.createSession = createSession;
exports.getSession = getSession;
exports.removeSession = removeSession;
exports.updateSession = updateSession;
exports.logout = logout;
exports.isLogin = isLogin;
exports.getLoginUserName = getLoginUserName;
exports.getLoginInfo = getLoginInfo;
exports.isLoginOption = isLoginOption;
exports.filter = filter;
exports.createTimedSession = createTimedSession;
exports.isTimedSession = isTimedSession;

})();