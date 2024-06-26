//////////////////////////////////////////////
// gas(GoogleAppsScript)に認証アクセスして処理.
//  - GASのユーザ(googleメアド)認証+取得(OAuth).
//  - 営業日を取得.
// を実現するためのモジュール.
//////////////////////////////////////////////

//
// ※gasのdoGetに対して、gasのアカウントデータアクセス許可が必要な場合、
// これに対して `XMLHttpRequest` でのアクセスはすべて「エラー」になる.
// https://qiita.com/faunsu/items/722ab6d7f6178508851c
// 結局 lambda -> gas(doGet or doPost) のアクセスが可能なのは
// `jsonp` だけとなるので注意(非常に不便).
// 
// あとlambda -> gas のアクセスは「ブラウザに紐づいてる」ので、lambdaから
// httpClient等でアクセスしても「gasにアクセス」できないので注意.
//

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

// authログイン.
const authLogin = frequire("./lib/auth/authLogin.js");

// authユーザ.
const authUser = frequire("./lib/auth/authUser.js");

// login用signature.
const sig = frequire("./lib/auth/signature.js");

// authUtil.
const authUtil = frequire("./lib/auth/util.js");

// xor128.
const xor128 = frequire("./lib/util/xor128.js");

// [ENV]問い合わせ先のGAS認証URL.
const ENV_GAS_AUTH_URL = "GAS_AUTH_URL";

// [ENV]GasOAuth用KeyCode定義.
const ENV_GAS_ALLOW_AUTH_KEY_CODE = "ALLOW_GAS_AUTH_KEY_CODE";

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
// ※ ここでは対象ユーザの登録だけが行われるので、戻り値のUserInfoに対して、新たな条件設定をした場合は
//   UserInfo.save()で保存してください.
// user 対象のユーザ名を設定します.
// 戻り値: UserInfoが返却されます.
const createUser = async function(user) {
    return await authUser.create(user, authUser.USER_TYPE_OAUTH);
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
    // tokenにはbase64(
    // - randomToken(任意の長さ).base64
    // - =
    // - expire(UnixTimeミリ秒).16進数
    // )で生成する.
    // 日付を入れる理由は、このトークンが時限である事を示す.
    return sig.cutEndBase64Eq(
        Buffer.from(
            (
                xor128.random.getBytes(len).toString("base64") +
                "_" +
                (expire.toString(16))
            )
        ).toString("base64")
    );
}

// token区切り文字.
const TOKEN_DELIMIRATER = "$_$/\n";

// gasAuthにアクセスするためのToken作成.
// target GASの引数`target`を設定します.
// sortKeys addParamsに対する昇順sortKey(Array)を設定します.
// addParams 追加パラメータを設定します.
// 戻り値: {request-token, request-token-key}
//         request-token: tokenを設定します.
//         request-token-key tokenKeyを設定します.
const createSendToken = function(target, sortKeys, addParams) {
    /**
     * authKeyCode + TOKEN_DELIMIRATER +
     * target + TOKEN_DELIMIRATER +
     * tokenKeyCode +
     * TOKEN_DELIMIRATER + params.key(昇順sort)
     * TOKEN_DELIMIRATER + params.value
     */
    // 新しいtokenKeyを生成.
    const tokenKeyCode = createTokenKey();
    // allowAuthKeyCodeを環境変数から取得.
    const authKeyCode = process.env[ENV_GAS_ALLOW_AUTH_KEY_CODE];
    // シグニチャーを生成.
    let signature =
        authKeyCode + TOKEN_DELIMIRATER +
        target + TOKEN_DELIMIRATER +
        tokenKeyCode;
    // ソートされたパラメータを追加.
    const len = sortKeys.length;
    for(let i = 0; i < len; i ++) {
        signature += TOKEN_DELIMIRATER + sortKeys[i] +
            TOKEN_DELIMIRATER + addParams[sortKeys[i]];
    }
    const ret = {};
    // [token生成]hmacSHA256計算で16進数で返却.
    ret[PARAMS_SEND_TOKEN] = authUtil.hmacSHA256(
        signature, tokenKeyCode);
    // createTokenKeyをセット.
    ret[PARAMS_SEND_TOKEN_KEY] = tokenKeyCode;
    return ret;
}

// パラメータのKeyをソートする.
const sortParamsKey = function(params) {
    const ret = [];
    for(let k in params) {
        ret[ret.length] = k;
    }
    return ret.sort();
}

// Gasアクセス用のURLを生成.
// target 対象の処理タイプを設定します.
//        "oAuth" oAuth認証の処理要求をします.
//        "businessDay" 対象GASで定義されている営業日での計算を行います.
// addParams 追加パラメータを設定します.
// 戻り値: GASに問い合わせるURL, Paramsを返却します.
//         {url, params}
const getGasAccessURLEncodeGetParams = function(target, addParams) {
    if(!authUtil.useString(target)) {
        throw new Error("Specified target not set: " + target);
    }
    // [ENV]問い合わせ先のGAS-URL.
    if(isEmptyEnv(ENV_GAS_AUTH_URL)) {
        throw new Error(
            "[ENV]The URL destination GoogleAppsScript is not set.");
    }
    // [ENV]gasアクセス先URLを環境変数から取得.
    const url = process.env[ENV_GAS_AUTH_URL];

    // パラメータKeyをソート.
    const sortKeys = sortParamsKey(addParams)

    // 指定TypeのTokenを生成.
    const oAuthParams = createSendToken(target, sortKeys, addParams);

    // oAuthParamのKeyをソート.
    const sortOAuthKeys = sortParamsKey(oAuthParams)
    
    // targetをセット.
    let resParams = encodeURIComponent(PARAMS_EXECUTE_TARGET) + "="
        + encodeURIComponent(target);
    
    // paramsをGETパラメータ変換.
    let k;
    let len = sortKeys.length;
    for(let i = 0; i < len; i ++) {
        k = sortKeys[i];
        resParams += "&" + encodeURIComponent(k) + "="
            + encodeURIComponent(addParams[k]);
    }
    // oAuthParamsをGETパラメータ変換.
    len = sortOAuthKeys.length;
    for(let i = 0; i < len; i ++) {
        k = sortOAuthKeys[i];
        resParams += "&" + encodeURIComponent(k) + "="
            + encodeURIComponent(oAuthParams[k]);
    }
    // 返却: URL, resParams.
    return {url: url, params: resParams};
}

// [実行パラメータ]oAuth認証確認.
const PARAMS_TYPE_OAUTH = "oAuth";

// [oAuth]必須環境変数チェック.
const checEnvOAuth = function() {
    // [ENV]GASOAuth用KeyCode定義.
    if(isEmptyEnv(ENV_GAS_ALLOW_AUTH_KEY_CODE)) {
        throw new Error(
            "[ENV]The KeyCode definition for OAuth has not been set.");
    }
}

// host名に対するprotocolを取得.
// host 対象のホスト名を設定します.
// 戻り値: protocolが返却されます.
const getHttpProtocol = function(host) {
    host = host.trim().toLowerCase();
    // localhost以外.
    if(!(host == "127.0.0.1" || host.startsWith("127.0.0.1:") ||
        host == "localhost" || host.startsWith("localhost:"))) {
        let c;
        const len = host.length;
        for(let i = 0; i < len; i ++) {
            c = host.charAt(i);
            // ipアドレス以外.
            if(!((c >= '0' && c <= '9') || c == '.' || c == ':')) {
                // lambda関数URLのURLなのでhttps.
                return "https://";
            }
        }
    }
    // localhostやip固定の場合はhttp.
    return "http://";
}

// [実行パラメータ]アカウントデータの使用を許可.
const PARAMS_TYPE_ALLOW_ACCOUNT_DATA = "allowAccountData";

// アカウントデータ利用許可用URLを生成.
// 戻り値: GASに対してアカウントデータ利用許可をするためのURLが返却されます.
const allowAccountDataURL = function() {
    let url = process.env[ENV_GAS_AUTH_URL];
    if(url.indexOf("?") != -1) {
        url += "&";
    } else {
        url += "?";
    }
    return url + encodeURIComponent(PARAMS_EXECUTE_TARGET) + "="
        + encodeURIComponent(PARAMS_TYPE_ALLOW_ACCOUNT_DATA);
}

// gasのOAuth用URLを生成.
// この処理で返却したURLをリダイレクトする事でgasに対してoAuthされます.
// request 対象のrequest情報を設定します.
// 戻り値: GASに問い合わせるURLが返却されます.
const createOAuthURL = function(request) {
    const params = {};
    const host = request.header.get("host");

    // ログイン後の元のURLを取得.
    // 現在アクセス中のURL＋パラメータをセット.
    const srcUrl = request.queryParams[PARAMS_SRC_URL];
    if(authUtil.useString(srcUrl)) {
        const protocol = getHttpProtocol(host);
        const sourceAccessUrl = protocol + host +
            (srcUrl.startsWith("/") ?
                srcUrl : "/" + srcUrl);
        params[PARAMS_SRC_URL] = sourceAccessUrl;        
    }
    
    // Gasアクセス用のURL + URLEncodeのGetパラメータを生成.
    const urlAndParams = getGasAccessURLEncodeGetParams(
        PARAMS_TYPE_OAUTH, params);
    
    // OAuth用のURLを返却.
    return urlAndParams.url + "?" + urlAndParams.params;
}

// GasのOAuthURLを作成します.
// request 対象のrequest情報を設定します.
// 戻り値: GasのOAuthURLが返却されます.
const executeOAuthURL= function(request) {
    // 必須パラメータチェック.
    checEnvOAuth();

    // gasのURLを生成.
    return createOAuthURL(request);
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
    const params = {}
    params[PARAMS_START_DATE] = startDate;
    params[PARAMS_BUSINESS_DAY] = businessDay;

    // Gasアクセス用のURLEncodeのGetパラメータを生成.
    return getGasAccessURLEncodeGetParams(
        PARAMS_TYPE_BUSINESS_DAY, params);
}

// GASに対して営業日を取得するURLを取得..
// businessDay 計算したい営業日を設定します.
//             省略した場合はデフォルト日が設定されます.
// startDate 営業日計算の開始日を設定します.
//           省略した場合は当日が設定されます.
const getBusinessDayURL = async function(businessDay, startDate) {
    // 必須パラメータチェック.
    checEnvOAuth();

    // gasの営業日取得用URLを作成.
    const urlAndParams = getBusinessDayToGetParams(businessDay, startDate);
    // 営業日取得用のURLを返却.
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

// authLogin.loginの call処理.
// params 基本はrequest.queryParamsを設定します.
//        別にdict型なら何でもOK.
// 戻り値: ログイン対象のUserInfoが返却されます.
const _callLogin = async function(params) {
    // [oauth]gas認証のメールアドレスを取得.
    const user = params["mail"];
    if(!authUtil.useString(user)) {
        // gasOauthメールアドレスが取得できない場合.
        throw new HttpError({
            status: 401,
            message: "gas oauth authentication failed."
        });
    }
    // UserInfoを取得
    const ret = await authUser.get(user);
    // redirectTokenのチェック.
    if(!isRedirectToken(
        params["redirectToken"],
        params["type"],
        params["tokenKey"])) {
        // redirectTokenチェック失敗.
        throw new HttpError({
            status: 403,
            message: "Failed to get response information: not equals response token."
        });
    }
    return ret;
}

// urlPathを取得.
const getUrlPath = function(url) {
    let p = url.indexOf("://");
    if(p == -1) {
        return url;
    }
    let pp = url.indexOf("/", p + 3);
    if(pp == -1) {
        return url;
    }
    return url.substring(pp);
}

// リダイレクトURLにパラメータが存在する場合
// URLエンコード変換し直す.
const encodeRedirectUrlParams = function(url) {
    // パラメータが存在する場合.
    const p = url.indexOf("?");
    if(p == -1) {
        return url;
    }
    let kv;
    let ret = getUrlPath(url.substring(0, p)) + "?";
    const paramList = url.substring(p + 1).split("&");
    const len = paramList.length;
    for(let i = 0; i < len; i ++) {
        kv = paramList[i].split("=");
        if(i != 0) {
            ret += "&";
        }
        ret += encodeURIComponent(kv[0])
        if(kv.length > 1) {
            ret += "=" + encodeURIComponent(kv[1])
        }
    }
    return ret;
}

// executeOAuth処理(gasOAuth)処理結果に対するログインセッションを作成します.
// resState: レスポンスステータス(httpStatus.js).
// resHeader レスポンスヘッダ(httpHeader.js).
// request 対象のrequest情報を設定します.
// 戻り値: trueの場合は成功しました.
const redirectOAuth = async function(resState, resHeader, request) {
    // ログイン処理.
    await authLogin.login(
        resHeader, request, request.queryParams, _callLogin);

    // リダイレクト先URLを取得します.
    let redirectURL = request.queryParams[PARAMS_SRC_URL];

    // リダイレクト先のURLが存在しない場合はリダイレクト.
    if(authUtil.useString(redirectURL)) {
        resState.redirect(
            encodeRedirectUrlParams(redirectURL));
        return true;
    }
    return false;
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.createUser = createUser;
exports.allowAccountDataURL = allowAccountDataURL;
exports.executeOAuthURL = executeOAuthURL;
exports.getBusinessDayURL = getBusinessDayURL;
exports.redirectOAuth = redirectOAuth;

})();
