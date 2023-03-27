//////////////////////////////////////////////
// gas(GoogleAppsScript)に認証アクセスして処理.
//  - GASのユーザ確認(OAuth).
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

// [ENV]問い合わせ先のGAS認証URL.
const ENV_GAS_AUTH_URL = "GAS_AUTH_URL";

// [ENV]GASOAuth用KeyCode定義.
const ENV_GAS_ALLOW_AUTH_KEY_CODE = "ALLOW_GAS_AUTH_KEY_CODE";

// [ENV]OAuth認証成功後のリダイレクト先URLのパス.
//   ${host名}${REDIRECT_OAUTH_PATH}
// のリダイレクト先条件を設定します.
const ENV_REDIRECT_OAUTH_PATH = "REDIRECT_OAUTH_PATH";

// [ENV]tokenKey作成長.
const ENV_GAS_OAUTH_TOKEN_KEY_LENGTH = "GAS_OAUTH_TOKEN_KEY_LENGTH";

// [DEFAULT]tokenKey作成長.
const DEF_CREATE_TOKEN_KEY_LENGTH = 18;

// [実行パラメータ]処理タイプ.
const PARAMS_EXECUTE_TARGET = "target";

// [認証パラメータ]requestTokenKey.
// request元がtokenを作成するに対して利用したrequestTokenKeyが
// 格納されます.
const PARAMS_SEND_TOKEN_KEY = "request-token-key";

// [認証パラメータ]requestToken.
// request側で作成したToken.
const PARAMS_SEND_TOKEN = "request-token";

// 数字変換が可能かチェック.
const isNumeric = function(o) {
    return !isNaN(parseFloat(o));
}

// crypto.
const crypto = frequire('crypto');

// [hex]hmacSHA256で変換.
// signature signatureを設定します.
// tokenKey tokenKeyを設定します.
// 戻り値 変換結果が返却されます.
const hmacSHA256 = function(signature, tokenKey) {
    return crypto.createHmac("sha256", signature)
        .update(tokenKey).digest("hex");
}

// tokenKeyを生成.
const createTokenKey = function() {
    let len = DEF_CREATE_TOKEN_KEY_LENGTH;
    let eLen = parseInt(process.env[ENV_GAS_OAUTH_TOKEN_KEY_LENGTH]);
    if(!isNaN(eLen)) {
        len = eLen;
    }
    // tokenには
    // - randomToken(任意の長さ).base64
    // - _
    // - Date.now().16進数
    // で生成する.
    // 日付を入れる理由は、このトークンが時限である事を示す.
    return (xor128.create(xor128.getNanoTime())
        .getBytes(len).toString("base64")) + "_" +
            (Date.now().toString(16));
}

// token区切り文字.
const TOKEN_DELIMIRATER = "$_\n";

// gasAuthにアクセスするためのToken作成.
// target GASの引数`target`を設定します.
// paramsArray [key, value, key, value, ...]
//             対象のパラメータを設定します.
//             ここでは順番を気にするので、注意が必要です.
// 戻り値: tokenとtokenKeyが返却されます.
//         request-token: tokenを設定します.
//         request-token-key tokenKeyを設定します.
const createSendToken = function(target, paramsArray) {
    // tokenKeyを生成.
    const tokenKeyCode = createTokenKey();
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
    // [token生成]hmacSHA256計算でhex返却.
    ret[PARAMS_SEND_TOKEN] = hmacSHA256(signature, tokenKeyCode)
        .toString("hex");
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
    const url = process.env[ENV_GAS_AUTH_URL];
    if(url == undefined) {
        throw new Error(
            "[ENV]The URL destination GoogleAppsScript is not set.");
    }

    // 指定TypeのTokenを生成.
    const oAuthParams = createSendToken(target, paramsArray);
    
    // targetをセット.
    let getParams = encodeURIComponent(PARAMS_EXECUTE_TARGET) + "="
        + encodeURIComponent(target);
    
    // paramsをGETパラメータ変換.
    const len = paramsArray.length;
    for(let i = 0; i < len; i += 2) {
        getParams += "&" +encodeURIComponent(paramsArray[i]) + "="
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
    if(process.env[ENV_GAS_ALLOW_AUTH_KEY_CODE] == undefined) {
        throw new Error(
            "[ENV]The KeyCode definition for OAuth has not been set.");
    }
    // [ENV]GASOAuthの正常結果のリダイレクト先Path定義.
    else if(process.env[ENV_REDIRECT_OAUTH_PATH] == undefined) {
        throw new Error(
            "[ENV]The redirect destination Path for normal results for OAuth "
            + "has not been set.");
    }
}

// gasのOAuth用URLを生成.
// この処理で返却したURLをリダイレクトする事でgasに対してoAuthされます.
// request 対象のrequest情報を設定します.
// 戻り値: GASに問い合わせるURLが返却されます.
const createOAuthURL = function(request) {
    // oAuth成功後のリダイレクト先URLを生成.
    const successRedirectURL = "https://"
        + request.header.get("host") + 
            (process.env[ENV_REDIRECT_OAUTH_PATH].startsWith("/") ?
                process.env[ENV_REDIRECT_OAUTH_PATH] :
                "/" + process.env[ENV_REDIRECT_OAUTH_PATH]);
    
    // ログイン後の元のURLを取得.
    // 現在アクセス中のURL＋パラメータをセット.
    const sourceAccessUrl = "https://"
        + request.header.get("host")  + request.path
            + ((typeof(request.rawQueryString) == "string" &&
                request.rawQueryString.length > 0) ?
                "?" + request.rawQueryString : "");
    
    // パラメータ用のリストを作成.
    const params = [
        PARAMS_REDIRECT_URL, successRedirectURL,
        PARAMS_SOURCE_ACCESS_URL, sourceAccessUrl,
    ];

    // Gasアクセス用のURL + URLEncodeのGetパラメータを生成.
    const urlAndParams = getGasAccessURLEncodeGetParams(
        PARAMS_TYPE_OAUTH, params);
    
    // OAuth用のURLを返却.
    return urlAndParams.url + "?" + urlAndParams.params;
}

// GasでのOAuthを実施します.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request 対象のrequest情報を設定します.
// 戻り値: trueの場合、OAuthの認証が必要となります.
const getOAuth = async function(resState, resHeader, request) {
    // 必須パラメータチェック.
    checEnvOAuth();

    // ログイン済みでない事を確認.
    if(!(await loginMan.isLogin(2, resHeader, request))) {
        // リレイレクト返却.
        resState.setStatus(301);
        resHeader["location"] = createOAuthURL(request);
        return true;
    }
    // oauthは不要.
    return false;
}

// getOAuth処理(gasOAuth)処理結果に対するログインセッションを作成します.
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
    if(!isNumeric(businessDay)) {
        businessDay = 0;
    }

    // 営業日計算の開始日が数字指定の場合
    // Dateオブジェクトとして再作成.
    if(isNumeric(startDate)) {
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
    return await httpsClient.request(
        hostPath.host, hostPath.url,
            {urlParams: urlParams.params,
            port: hostPath.port});
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.getOAuth = getOAuth;
exports.redirectOAuth = redirectOAuth;
exports.getBusinessDay = getBusinessDay;

})();
