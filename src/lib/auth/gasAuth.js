//////////////////////////////////////////////
// gas(GoogleAppsScript)に認証アクセスして処理.
//  - GASのユーザ(googleメアド)認証+取得(OAuth).
//  - 営業日を取得.
// を実現するためのモジュール.
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

// HttpErrorを利用可能に設定.
frequire("./httpError.js");

// 乱数.
const xor128 = frequire("./lib/util/xor128.js");

// ログインマネージャー.
const loginMan = frequire("./lib/auth/manager.js");

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// authUtil.
const authUtil = frequire("./lib/auth/util.js");

// [ENV]問い合わせ先のGAS認証URL.
const ENV_GAS_AUTH_URL = "GAS_AUTH_URL";

// [ENV]GasOAuth用KeyCode定義.
const ENV_GAS_ALLOW_AUTH_KEY_CODE = "ALLOW_GAS_AUTH_KEY_CODE";

// [ENV]OAuth認証成功後のリダイレクト先URLのパス.
//   ${(httpHeader)host}${REDIRECT_OAUTH_PATH}
// のリダイレクト先条件を設定します.
const ENV_REDIRECT_OAUTH_PATH = "REDIRECT_OAUTH_PATH";

// [ENV]tokenKey長.
const ENV_GAS_OAUTH_TOKEN_KEY_LENGTH = "GAS_OAUTH_TOKEN_KEY_LENGTH";

// [ENV]tokenKeyのexpire値(分).
const ENV_GAS_OAUTH_TOKEN_KEY_EXPIRE = "GAS_OAUTH_TOKEN_KEY_EXPIRE";

// [DEFAULT]tokenKey長.
const DEF_GAS_OAUTH_TOKEN_KEY_LENGTH = 19;

// [DEFAULT]tokenKeyのexpire値(分).
const DEF_GAS_OAUTH_TOKEN_KEY_EXPIRE = 30;

// [実行パラメータ]処理タイプ.
const PARAMS_EXECUTE_TARGET = "target";

// [認証パラメータ]requestTokenKey.
// request元がtokenを作成するに対して利用したrequestTokenKeyが
// 格納されます.
const PARAMS_SEND_TOKEN_KEY = "request-token-key";

// [認証パラメータ]requestToken.
// request側で作成したToken.
const PARAMS_SEND_TOKEN = "request-token";

// [パラメータ]ログインされていない時のURL指定
const PARAMS_SRC_URL = "srcURL";

// envが定義されていない場合.
const isEmptyEnv = function(name) {
    const value = process.env[name];
    return value == undefined ||
        value == null || ("" + value) == "";
}

// oAuth認証用のユーザ登録.
// user 対象のユーザ名を設定します.
// userInfo ユーザ情報オプションを設定します.
// 戻り値: trueの場合登録できました.
const createUser = async function(user, userInfo) {
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
    // oauth認証として登録.
    regUserInfo[USER_INFO_LOGIN_TYPE] =
        USER_INFO_LOGIN_TYPE.OAUTH;
    // 登録.
    return await loginMan.createUser(user, regUserInfo);
}

// tokenKeyを生成.
const createTokenKey = function() {
    // tokeyKey長を取得.
    let len = DEF_GAS_OAUTH_TOKEN_KEY_LENGTH;
    const eLen = parseInt(process.env[ENV_GAS_OAUTH_TOKEN_KEY_LENGTH]);
    if(!isNaN(eLen)) {
        // 数字の場合はその値をセット.
        len = eLen;
        // 最小値以下(8文字以下).
        if(len < 8) {
            len = 8;
        // 最大値を超える場合(128文字以上).
        } else if(len > 128) {
            len = 128;
        }
    }
    // tokeyExpire値(秒)を取得.
    let expire = DEF_GAS_OAUTH_TOKEN_KEY_EXPIRE;
    const eExpire = parseInt(process.env[ENV_GAS_OAUTH_TOKEN_KEY_EXPIRE]);
    if(!isNaN(eExpire)) {
        expire = eExpire;
        // 最小値以下(1分未満).
        if(expire < 1) {
            expire = 1
        // 最大値を超える場合(１日以上).
    } else if(expire > 86400) {
            expire = 86400;
        }
    }
    // tokeyExpire値(秒)をミリ秒に変換.
    expire = Date.now() + (expire * 60000)
    // tokenには
    // - randomToken(任意の長さ).base64
    // - /
    // - expire(UnixTimeミリ秒).16進数
    // で生成する.
    // 日付を入れる理由は、このトークンが時限である事を示す.
    return sig.cutEndBase64Eq(xor128.create(xor128.getNanoTime())
        .getBytes(len).toString("base64")) + "_" +
            (expire.toString(16));
}

// token区切り文字.
const TOKEN_DELIMIRATER = "$_$/\n";

// gasAuthにアクセスするためのToken作成.
// target GASの引数`target`を設定します.
// paramsArray [key, value, key, value, ...]
//             対象のパラメータを設定します.
//             ここでは順番を気にするので、注意が必要です.
// 戻り値: tokenとtokenKeyが返却されます.
//         request-token: tokenを設定します.
//         request-token-key tokenKeyを設定します.
const createSendToken = function(target, paramsArray) {
    // 新しいtokenKeyを生成.
    tokenKeyCode = createTokenKey();
    // allowAuthKeyCodeを環境変数から取得.
    const authKeyCode = process.env[ENV_GAS_ALLOW_AUTH_KEY_CODE];
    // シグニチャーを生成.
    let signature = authKeyCode + TOKEN_DELIMIRATER + target +
        TOKEN_DELIMIRATER + tokenKeyCode;
    // 指定された変数(Array順番を気にする)を元にシグニチャーを更新.
    const len = paramsArray.length;
    for(let i = 0; i < len; i += 2) {
        signature += TOKEN_DELIMIRATER + paramsArray[i] +
            TOKEN_DELIMIRATER + paramsArray[i + 1];
    }
    const ret = {};
    // [token生成]hmacSHA256計算で16進数で返却.
    ret[PARAMS_SEND_TOKEN] = authUtil.hmacSHA256(
        signature, tokenKeyCode);
    // createTokenKeyをセット.
    ret[PARAMS_SEND_TOKEN_KEY] = tokenKeyCode;
    return ret;
}

// Gasアクセス用のURLを生成.
// target 対象の処理タイプを設定します.
//        "oAuth" oAuth認証の処理要求をします.
//        "businessDay" 対象GASで定義されている営業日での計算を行います.
// paramsArray Arrayで追加するGETパラメータを設定します.
//             この内容は設定順番を気にするのでArray定義です.
//             [key, value, key, value, ・・・・] と設定します.
// 戻り値: GASに問い合わせるURL, Paramsを返却します.
//         {url, params}
const getGasAccessURLEncodeGetParams = function(
    target, paramsArray) {
    if(typeof(target) != "string") {
        throw new Error("Specified target not set: " + target);
    }
    // [ENV]問い合わせ先のGAS-URL.
    if(isEmptyEnv(ENV_GAS_AUTH_URL)) {
        throw new Error(
            "[ENV]The URL destination GoogleAppsScript is not set.");
    }
    const url = process.env[ENV_GAS_AUTH_URL];

    // 指定TypeのTokenを生成.
    const oAuthParams = createSendToken(target, paramsArray);
    
    // targetをセット.
    let getParams = encodeURIComponent(PARAMS_EXECUTE_TARGET) + "="
        + encodeURIComponent(target);
    
    // paramsをGETパラメータ変換.
    const len = paramsArray.length;
    for(let i = 0; i < len; i += 2) {
        getParams += "&" + encodeURIComponent(paramsArray[i]) + "="
            + encodeURIComponent(paramsArray[i + 1]);
    }
    // oAuthParamsをGETパラメータ変換.
    for(let k in oAuthParams) {
        getParams += "&" + encodeURIComponent(k) + "="
            + encodeURIComponent(oAuthParams[k]);
    }
    // URL, getParams.
    return {url: url,
        params: getParams};
}

// [実行パラメータ]oAuth認証確認.
const PARAMS_TYPE_OAUTH = "oAuth";

// [oAuth用パラメータ]リダイレクトURL.
// ログイン成功時のリダイレクトURLを設定します.
const PARAMS_REDIRECT_URL = "redirect-url";

// [oAuth用パラメータ]元のアクセスURL.
// 本来アクセスしたいURLが設定されます.
const PARAMS_SOURCE_ACCESS_URL = "src-access-url";

// [oAuth]必須環境変数チェック.
const checEnvOAuth = function() {
    // [ENV]GASOAuth用KeyCode定義.
    if(isEmptyEnv(ENV_GAS_ALLOW_AUTH_KEY_CODE)) {
        throw new Error(
            "[ENV]The KeyCode definition for OAuth has not been set.");
    }
    // [ENV]GASOAuthの正常結果のリダイレクト先Path定義.
    else if(isEmptyEnv(ENV_REDIRECT_OAUTH_PATH)) {
        throw new Error(
            "[ENV]The redirect destination Path for normal results for OAuth "
            + "has not been set.");
    }
}

// host名に対するprotocolを取得.
// host 対象のホスト名を設定します.
// 戻り値: protocolが返却されます.
const getHttpProtocol = function(host) {
    host = host.trim().toLowerCase();
    if(!(host == "localhost" || host.startsWith("localhost:"))) {
        let c;
        const len = host.length;
        for(let i = 0; i < len; i ++) {
            c = host.charAt(i);
            // ipアドレス以外.
            if(!(
                (c >= '0' && c <= '9') || c == '.' || c == ':'
            )) {
                // lambda関数URLのURLなのでhttps.
                return "https://";
            }
        }
    }
    // localhostやip固定の場合はhttp.
    return "http://";
}

// gasのOAuth用URLを生成.
// この処理で返却したURLをリダイレクトする事でgasに対してoAuthされます.
// request 対象のrequest情報を設定します.
// 戻り値: GASに問い合わせるURLが返却されます.
const createOAuthURL = function(request) {
    const params = [];
    const host = request.header.get("host");
    // oAuth成功後のリダイレクト先URLを生成.
    {
        const redirectPath = process.env[ENV_REDIRECT_OAUTH_PATH];
        const protocol = getHttpProtocol(host)
        const successRedirectURL = protocol + host + 
            (redirectPath.startsWith("/") ?
                redirectPath : "/" + redirectPath);
        params[params.length] = PARAMS_REDIRECT_URL;
        params[params.length] = successRedirectURL;        
    }

    // ログイン後の元のURLを取得.
    // 現在アクセス中のURL＋パラメータをセット.
    const srcUrl = request.queryParams[PARAMS_SRC_URL];
    if(typeof(srcUrl) == "string") {
        sourceAccessUrl = protocol + host +
            (srcUrl.startsWith("/") ?
                srcUrl : "/" + srcUrl);
        params[params.length] = PARAMS_SOURCE_ACCESS_URL;
        params[params.length] = sourceAccessUrl;        
    }
    
    // Gasアクセス用のURL + URLEncodeのGetパラメータを生成.
    const urlAndParams = getGasAccessURLEncodeGetParams(
        PARAMS_TYPE_OAUTH, params);
    
    // OAuth用のURLを返却.
    return urlAndParams.url + "?" + urlAndParams.params;
}

// redierctTokenごまかし的難読化テーブル.
const REDIRECT_TOKEN_DF = {
    "0": "_Q", "1": "O", "2": "p8", "3": "~c", "4": "jE", "5z": "8_9", "6": "u", "7": "3G",
    "8": "n", "9": "E", "a": "~K", "b": "i", "c": "W6", "d": "d", "e": "=d", "f": "3E"   
};

// リダイレクト用Tokenが正しいかチェックする.
// redirectToken redirectされた時に渡されたパラメータ"redirectToken"を設定します.
// type 実行パラメータを設定します.
// requestTokenKey redirectされた時に渡されたパラメータ"tokenKey"を設定します.
// 戻り値 trueの場合正しいです.
const isRedirectToken = function(redirectToken, type, requestTokenKey) {
    // 指定requestTokenKeyとtypeを融合する.
    let len = requestTokenKey.length;
    requestTokenKey =
        "~=$_" +
        requestTokenKey.substring(len >> 1)
        TOKEN_DELIMIRATER +
        type + "=_~!~" +
        requestTokenKey.substring(0, len >> 1);
    // tokenを生成.
    const token = authUtil.hmacSHA256(
        process.env[ENV_GAS_ALLOW_AUTH_KEY_CODE], requestTokenKey);
    // 対象Tokenに対して、ごまかし的難読化する.
    len = token.length;
    let chkToken = "";
    for(let i = 0; i < len; i ++) {
        chkToken += REDIRECT_TOKEN_DF[token[i]];
    }
    // 内容が一致するかチェック.
    return redirectToken == chkToken;
}

// GasでのOAuthを実施します.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request 対象のrequest情報を設定します.
// 戻り値: trueの場合、gasOAuthの認証が必要となります.
const executeOAuth = async function(resState, resHeader, request) {
    // 必須パラメータチェック.
    checEnvOAuth();

    // ログインしていない事を確認.
    if(!(await loginMan.isLogin(2, resHeader, request))) {
        // createOAuthURLにリダイレクト処理.
        resState.setStatus(301);
        resHeader["location"] = createOAuthURL(request);
        return true;
    }
    // oauthは不要.
    return false;
}

// executeOAuth処理(gasOAuth)処理結果に対するログインセッションを作成します.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request 対象のrequest情報を設定します.
const redirectOAuth = async function(resState, resHeader, request) {
    // [oauth]gas認証のメールアドレスを取得.
    const aOuthMail = request.queryParams["mail"];
    if(typeof(aOuthMail) != "string") {
        // gasOauthメールアドレスが取得できない場合.
        throw new HttpError({
            status: 401,
            message: "gas oauth authentication failed."
        });
    }
    // redirectTokenのチェック.
    if(!isRedirectToken(
        request.queryParams["redirectToken"],
        request.queryParams["type"],
        request.queryParams["tokenKey"])) {
        // redirectTokenチェック失敗.
        throw new HttpError({
            status: 403,
            message: "Failed to get response information: not equals response token."
        });
    }
    // [oauth]ログインセッションを生成.
    const sessions = await loginMan.createSession(request, aOuthMail,
        loginMan.createUserOptions(loginMan.USER_OPTIONS_AUTH_TYPE,
            loginMan.USER_OPTIONS_AUTH_TYPE.OAUTH));
    if(sessions == null) {
        // 新しいセッション作成に失敗.
        throw new Error("Failed to create a oauth session.");
    }

    // ログイントークン作成用のキーコードを取得.
    const keyCode = getLoginTokenKeyCode(request);

    // ログイントークンを作成.
    const token = sig.encodeToken(
        keyCode, user, sessions.passCode,
        sessions.sessionId, LOGIN_TOKEN_EXPIRE);

    // レスポンスCookieにセッションキーを設定.
    resHeader.putCookie(COOKIE_SESSION_KEY, {value: token});

    // リダイレクト先URLを取得します.
    let redirectURL = request.queryParams["srcAccessUrl"];

    // リレイレクト先のURLを設定.
    resState.setStatus(301);
    resHeader["location"] = redirectURL;
}

// [実行パラメータ]営業日を取得.
const PARAMS_TYPE_BUSINESS_DAY = "businessDay";

// [bisinessパラメータ]営業日計算の開始日.
const PARAMS_START_DATE = "start_date";

// [bisinessパラメータ]計算したい営業日.
const PARAMS_BUSINESS_DAY = "business_day";

// gasの営業日取得用URLを作成.
// businessDay 計算したい営業日を設定します.
//             省略した場合はデフォルト日が設定されます.
// startDate 営業日計算の開始日を設定します.
//           省略した場合は当日が設定されます.
// 戻り値: GASに問い合わせるURL, Paramsが返却されます.
//         {url, params}
const getBusinessDayToGetParams = function(
    businessDay, startDate) {

    // 計算したい営業日が指定無しの場合.
    if(!authUtil.isNumeric(businessDay)) {
        businessDay = 0;
    }

    // 営業日計算の開始日が数字指定の場合
    // Dateオブジェクトとして再作成.
    if(authUtil.isNumeric(startDate)) {
        startDate = new Date(parseInt(startDate));
    }

    // 営業日計算の開始日が指定無しの場合.
    if(startDate == undefined || startDate == null) {
        startDate = "";
    } else if(startDate instanceof Date) {
        const y = startDate.getFullYear();
        const m = "" + (startDate.getMonth() + 1);
        const d = "" + startDate.getDate();
        startDate = y + "-" +
            "00".substring(m.length()) + m + "-" +
            "00".substring(d.length()) + d;
    } else {
        startDate = "" + startDate;
    }
    
    // パラメータ用のリストを作成.
    const params = [
        PARAMS_START_DATE, startDate,
        PARAMS_BUSINESS_DAY, businessDay,
    ];

    // Gasアクセス用のURLEncodeのGetパラメータを生成.
    return getGasAccessURLEncodeGetParams(
        PARAMS_TYPE_BUSINESS_DAY, params);
}

// 指定URLからHost名とPathに分離.
// url URLを設定します.
// 戻り値: URLとPathに分離された結果が返却されます.
//         {host, path}
const getUrlToHostNameAndPath = function(url) {
    // protocol除外.
    const protocolLen = url.startsWith("https://") ?
        8 : url.startsWith("http://") ? 7 : -1;
    if(protocolLen == -1) {
        throw new Error("Unknown Protocol for URL: " + url);
    }
    let p, host, port, path;
    // パス取得.
    p = url.indexOf("/", protocolLen);
    if(p == -1) {
        // パスが存在しない場合.
        host = url.substring(protocolLen);
        path = "";
    } else {
        // パスが存在する場合.
        host = url.substring(protocolLen, p);
        path = url.substring(p); 
    }
    // hostに存在するport番号取得.
    p = host.indexOf(":", protocolLen);
    if(p != -1) {
        // 指定内容を取得.
        port = parseInt(host.substring(p + 1));
        host = host.substring(0, p);
    } else {
        // デフォルト値.
        port = 443;
    }
    // 返却処理.
    return {
        host: host,
        path: path,
        port: port
    }
}

// GASに対して営業日を取得する.
// businessDay 計算したい営業日を設定します.
//             省略した場合はデフォルト日が設定されます.
// startDate 営業日計算の開始日を設定します.
//           省略した場合は当日が設定されます.
const getBusinessDay = async function(businessDay, startDate) {
    // GAS先のURLとパラメタを取得.
    const urlParams = getBusinessDayToGetParams(
        businessDay, startDate);
    // URLをHostとPath(とport)に分離.
    const hostPath = getUrlToHostNameAndPath(urlParams.url);
    // httpsClient.
    const httpsClient = frequire("./lib/httpsClient.js");
    // httpsClientでアクセスする.
    const json = httpsClient.toJSON(await httpsClient.request(
        hostPath.host, hostPath.url,
            {urlParams: urlParams.params,
            port: hostPath.port}));
    // 返却内容不正の場合.
    if(json == undefined || json == null) {
        throw new HttpError({
            status: 400,
            message: "Failed to get response information: not json."
        });
    // 返却内容がstatusが200(正常以外)の場合はエラー.
    } else if(json.status != "200") {
        return json;
    }
    // redirectTokenのチェック.
    if(!isRedirectToken(json["redirectToken"], json["type"], json["tokenKey"])) {
        // redirectTokenチェック失敗.
        throw new HttpError({
            status: 403,
            message: "Failed to get response information: not equals response token."
        });
    }
    // 正常.
    return json;
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.manager = loginMan;
exports.createUser = createUser;
exports.isRedirectToken = isRedirectToken;
exports.executeOAuth = executeOAuth;
exports.redirectOAuth = redirectOAuth;
exports.getBusinessDay = getBusinessDay;

})();
