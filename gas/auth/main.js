/**
 * LFUとGASの連携処理.
 * この機能はGAS上で作成して.gsファイルとして展開する必要が
 * あります.
 * 
 * 内容としては以下を提供します.
 *  - GASを使ったoAuth機能を提供します.
 *  - 組織のカレンダー情報から営業日換算を行います.
 */
// [START]=============================.
const executeGAS = function(e) {
const _PARAMS = e.parameter;
// ====================================.

// [default]デフォルトの営業日.
const DEF_BUSINESS_DAY = 5;

// [実行パラメータ]処理タイプ.
const PARAMS_EXECUTE_TARGET = "target";

// [認証パラメータ]requestTokenKey.
// request元がtokenを作成するに対して利用したrequestTokenKeyが
// 格納されます.
const PARAMS_REQUEST_TOKEN_KEY = "request-token-key";

// [認証パラメータ]requestSuccessToken.
// request側で作成した正解データ的なToken.
const PARAMS_REQUEST_SUCCESS_TOKEN = "request-token";

// [返却パラメータ]jsonpCallメソッドKey.
const PARAMS_JSONP_CALL = "jsonpCall";

// Print stack trace.
const printStackTrace = function(e) {
    console.error('# trace: ' + e.message + '\n' + e.stack);
}

// 文字列変換.
const convString = function(v) {
    if(v == undefined || v == null) {
        return "";
    }
    return ("" + v).trim();
}

// JSON返却.
const resultJSON = function(json) {
    const res = ContentService.createTextOutput();
    res.setMimeType(ContentService.MimeType.JSON);
    res.setContent(JSON.stringify(json));
    return res;
}

// jsonp返却.
const resultJSONP = function(json, callbackName) {
    const res = ContentService.createTextOutput();
    res.setMimeType(ContentService.MimeType.JAVASCRIPT);
    res.setContent(callbackName + "(" + JSON.stringify(json) + ");");
    return res;
}

// jsonを送信.
const sendJSON = function(json) {
    const params = getParams();
    // jsonp返却の場合.
    if(params[PARAMS_JSONP_CALL] != undefined) {
        // jsonp返却.
        return resultJSONP(json, params[PARAMS_JSONP_CALL]);
    } else {
        // json返却.
        return resultJSON(json);
    }
}

// Googleログイン中のGoogleメールアドレスを取得.
const getMailAddress = function() {
    return convString(Session.getActiveUser()
        .getEmail());
}

// URLパラメータを取得.
const getParams = function() {
    return _PARAMS;
}

// 1byte内容をHex変換.
const conv1byteToHex = function(n) {
    let ret = (n & 0x0ff).toString(16);
    if(ret.length == 1) {
        ret = '0' + ret;
    }
    return ret;
}

// [hex]HMAC SHA 256ハッシュ化.
// signature signatureを設定します.
// tokenKey tokenKeyを設定します.
// 戻り値 ハッシュ化された内容が返却されます.
const convertToHMmacSHA256 = function(signature, tokenKey) {
    const rowHash = Utilities.computeHmacSignature
        (Utilities.MacAlgorithm.HMAC_SHA_256, tokenKey, signature);
    let ret = "";
    const len = rowHash.length;
    for (let i = 0; i < len; i ++) {
        ret += conv1byteToHex(rowHash[i]);
    }
    return ret;
};

// tokenKeyCodeのタイムアウト値チェック.
// tokenKeyCode: tokenKeyCodeを設定します.
// 戻り値: タイムアウトの場合 true返却.
const isTokenKeyCodeToTimeout = function(tokenKeyCode) {
    // tokenKeyCodeから生成時間を取得.
    const p = tokenKeyCode.lastIndexOf("_");
    if(p == -1) {
        // 取得できない場合タイムアウト扱い.
        return true;
    }
    // TokenKeyCodeのexpire値を取得.
    const expireTokenKeyCode = parseInt(
        tokenKeyCode.substring(p + 1), 16);
    if(isNaN(expireTokenKeyCode)) {
        // 取得できない場合タイムアウト扱い.
        return true;
    }
    // 渡されたTokenKeyCodeがexpire値を超えてる場合.
    return Date.now() > expireTokenKeyCode;
}

// token区切り文字.
const TOKEN_DELIMIRATER = "$_$/\n";

// 接続元からのアクセスが正しいかチェック.
// 戻り値: falseの場合、アクセスは正しくないです.
const isAuthRequestAccessToken = function() {
    // ALLOW_AUTH_KEY_CODEが未設定の場合.
    const allowAuthKeyCode = convString(ALLOW_AUTH_KEY_CODE);
    if(allowAuthKeyCode.length == 0 ||
        allowAuthKeyCode.indexOf("Do not upload to git") != -1) {
        // エラー返却.
        throw new Error(
            "Cannot process because the \"\"ALLOW_AUTH_KEY_CODE\"\" " +
            "environment variable is not set.");
    }

    // パラメータを取得.
    const params = getParams();

    // targetを取得して定義されているかチェック.
    let target = params[PARAMS_EXECUTE_TARGET];
    if(typeof(target) != "string" || target == "") {
        console.warn(PARAMS_EXECUTE_TARGET + " does not exist.");
        return false;
    }
    target = target.trim();

    // PARAMS_REQUEST_TOKEN_KEYが存在するかチェック.
    const tokenKeyCode = params[PARAMS_REQUEST_TOKEN_KEY];
    if(typeof(tokenKeyCode) != "string" || tokenKeyCode == "") {
        console.warn(PARAMS_REQUEST_TOKEN_KEY + " does not exist.");
        return false;
    }

    // PARAMS_REQUEST_TOKEN_KEYタイムアウトチェック.
    if(isTokenKeyCodeToTimeout(tokenKeyCode)) {
        // タイムアウト.
        console.warn(PARAMS_REQUEST_TOKEN_KEY + " is timed out.");
        return false;
    }

    // request側の正解データであるPARAMS_REQUEST_TOKENが
    // 存在するかチェック.
    const requestSuccessToken =
        params[PARAMS_REQUEST_SUCCESS_TOKEN];
    if(typeof(requestSuccessToken) != "string") {
        console.warn(PARAMS_REQUEST_SUCCESS_TOKEN + " does not exist.");
        return false;
    }

    // シグニチャを作成.
    let signature = allowAuthKeyCode +
        TOKEN_DELIMIRATER + target +
        TOKEN_DELIMIRATER + tokenKeyCode;
    // targetが"oauth"の場合.
    if(target == PARAMS_TYPE_OAUTH) {
        // 認証後にリダイレクトされるURL.
        if(convString(params[PARAMS_SOURCE_ACCESS_URL]) != "") {
            // 存在する場合のみ.
            signature +=
                TOKEN_DELIMIRATER +
                PARAMS_SOURCE_ACCESS_URL +
                TOKEN_DELIMIRATER +
                convString(params[PARAMS_SOURCE_ACCESS_URL]);
        }
    // targetが"bisunessdate"の場合.
    } else if(target == PARAMS_TYPE_BUSINESS_DAY) {
        // 対象のパラメータをセット.
        signature += TOKEN_DELIMIRATER +
            // 開始日付.
            convString(params[PARAMS_START_DATE]) +
            TOKEN_DELIMIRATER +
            // 営業日をセット.
            convString(params[PARAMS_BUSINESS_DAY]);
    }

    // signatureとrequestのtokenKeyCodeから
    // calcEqTokenを作成する.
    const calcEqToken = convertToHMmacSHA256(
        signature, tokenKeyCode,
    );

    // 内容確認.
    console.log("# calcEqToken        : " + calcEqToken)
    console.log("# requestSuccessToken: " + requestSuccessToken)
    
    // 作成したcalcEqTokenとrequestSuccessTokenを比較する.
    // trueの場合、リクエストのアクセストークンは正しい事を示す.
    if(calcEqToken == requestSuccessToken) {
        return true;
    }
    // 一致しない場合はsignature内容を出力.
    console.log("signature: " + signature);
    return false;

}

// メールアドレス許可されたかドメインのものかチェック.
const isAllowMail = function(mail) {
    // メールアドレスではない.
    if(mail.indexOf("@") == -1) {
        return false;
    }
    const len = ALLOW_MAIL_DOMAINS.length;
    // ドメインチェックが指定されていない場合.
    if(len == 0) {
        return true;
    }
    // メールアドレス許可されたかドメインのものかチェック
    for(let i = 0; i < len; i ++) {
        if(mail.endsWith("@" + ALLOW_MAIL_DOMAINS[i])) {
            // 一致した場合.
            return true;
        }
    }
    // 全てが不一致の場合.
    return false;
}

// mailアドレスのチェックとTokenチェックを行い
// 正しい場合、メールアドレスを返却.
const getMailAndAuthMailAndAuthToken = function() {
    try {
        // メールアドレスを取得.
        const mail = getMailAddress();
        console.log("# mail: " + mail);
        const isMail = isAllowMail(mail);
        console.log("# isAllowMail: " + isMail);
        const isAuth = isAuthRequestAccessToken();
        console.log("# isAuthRequestAccessToken: " + isAuth);
        // 許可されたメールアドレスのドメイン名であり
        // tokenが正しい事場合、メールアドレスを返却.
        if(isMail && isAuth) {
            return mail;
        }
    } catch(e) {
        console.log("[ERROR]getMailAndAuthMailAndAuthToken: ");
        printStackTrace(e);
    }
    // 失敗の場合は空を返却.
    return ""
}

// [実行パラメータ]アカウントデータの使用を許可.
const PARAMS_TYPE_ALLOW_ACCOUNT_DATA = "allowAccountData";

// [実行パラメータ]oAuth認証確認.
const PARAMS_TYPE_OAUTH = "oAuth";

// [oAuth用パラメータ]元のアクセスURL.
// 本来アクセスしたいURLが設定されます.
const PARAMS_SOURCE_ACCESS_URL = "srcURL";

// redierctTokenごまかし的難読化テーブル.
const REDIRECT_TOKEN_DF = {
    "0": "_Q", "1": "O", "2": "p8", "3": "~c", "4": "jE", "5z": "8_9", "6": "u", "7": "3G",
    "8": "n", "9": "E", "a": "~K", "b": "i", "c": "W6", "d": "d", "e": "=d", "f": "3E"   
};

// リダイレクト用Tokenを生成.
const createRedirectToken = function(type) {
    const requestTokenKey = getParams()[
        PARAMS_REQUEST_TOKEN_KEY];
    // 指定requestTokenKeyとtypeを融合する.
    let len = requestTokenKey.length;
    const signature =
        "~=$_" +
        requestTokenKey.substring(len >> 1)
        TOKEN_DELIMIRATER +
        type + "=_~!~" +
        requestTokenKey.substring(0, len >> 1);
    // tokenを生成.
    const token = convertToHMmacSHA256(
        ALLOW_AUTH_KEY_CODE, signature);
    // 対象Tokenに対して、ごまかし的難読化する.
    len = token.length;
    let ret = "";
    for(let i = 0; i < len; i ++) {
        ret += REDIRECT_TOKEN_DF[token[i]];
    }
    return ret;
}

/**
 * [HTML返却]GoogleAppScript(以降GAS)を会社で契約している場合に使える便利機能処理.
 * 
 * この内容をGASに登録した後にそこで払い出されたURLを元にこの機能を使って
 * 擬似的なoAuthを実現します.
 * 
 * GASが会社で契約されている場合、GoogleWorkspace内の利用は契約した
 * GoogleWorkspace内でのアクセスが許可され、その時のログイン中のメアドが
 * 取得できるので、利用者の情報を取得する事ができます.
 * 
 * この機能を使って、このプログラムを使って他のアクセスに対して簡易的な
 * OAuth的なことをできるようにします.
 * 
 * 今回はLFUが実行形態であるLambdaFunctionURLとの連携のような、ドメインが無いと
 * OAuthできないそのような環境において、GASを挟んでこのGASでログイン中の
 * メールアドレスを取得してユーザー情報を取得する形とします.
 * 
 * あと、元のrequestTokenとredirectTokenを元にredirectが正しく行われた事を
 * 保証する条件を返却して、oauthの認可が正しいものかを設定します.
 */
const executeOAuth = function() {
    const params = getParams();
    try {
        // 許可されたメールアドレスのドメインで
        // tokenも正しい場合はメールアドレスが付与されるか確認.
        const mail = getMailAndAuthMailAndAuthToken();
        if(mail == "") {
            // 認証が失敗の場合.
            throw new Error("gas login failed.");
        }
        const srcURL = convString(params[PARAMS_SOURCE_ACCESS_URL]);

        // メールアドレスが取得できている.
        // redirect先URLが存在する.
        if(mail != "") {
            return sendJSON({
                status: 200,
                // タイプ,
                type: PARAMS_TYPE_OAUTH,
                // アクセス元のURL.
                srcURL: srcURL,
                // requestTokenKey.
                tokenKey: params[PARAMS_REQUEST_TOKEN_KEY],
                // redirectToken.
                redirectToken: createRedirectToken(PARAMS_TYPE_OAUTH),
                // googleWorkspaceにログインしているメールアドレス.
                mail: mail,
                // メッセージ.
                message: "success"
            });
        }
    } catch(e) {
        // 例外もoAuth失敗扱い.
        console.error("[ERROR]executeOAuth: ");
        printStackTrace(e);
    }
    // oauth失敗.
    return sendJSON({
        status: 500,
        // タイプ,
        type: PARAMS_TYPE_OAUTH,
        // アクセス元のURL.
        srcURL: convString(params[PARAMS_SOURCE_ACCESS_URL]),
        // googleWorkspaceにログインしているメールアドレス.
        mail: "",
        // message.
        message: "oAuth authentication process failed"
    });
}

// CalenderApp.
const CALENDER_ID =
    "ja.japanese#holiday@group.v.calendar.google.com";
let CALENDER_APP_OBJECT = null;

// CalenderAppを取得.
const getCalenderApp = function() {
    if(CALENDER_APP_OBJECT == null) {
        CALENDER_APP_OBJECT = CalendarApp
            .getCalendarById(CALENDER_ID);
    }
    return CALENDER_APP_OBJECT;
}

// 対象Dateが休日か祝日の場合.
const isHoliday = function(date) {
    // 土日.
    if(date.getDay() == 0 || date.getDay() == 6) {
        return true;
    }
    // Googleカレンダーから祝日を取得.
    const calendar = getCalenderApp();
    // 対象日にイベントが有る場合はtrueを返す
    if(calendar.getEventsForDay(date).length > 0){
        return true;
    }
    return false;    
}

// Dateオブジェクトをyyyy-mm-ddに変換.
function getStringDate(date) {
    if(date == undefined) {
        date = new Date();
    }
    const y = "" + date.getFullYear(); 
    const m = "" + (date.getMonth() + 1);
    const d = "" + date.getDate();
    return "0000".substring(y.length) + y + "-" +
        "00".substring(m.length) + m + "-" +
        "00".substring(d.length) + d;
}

// 対応期限が設定されていない場合の対応期限を生成返却.
// 祝日とか無視しています.
const getBusinessDay = function(date, businessDay) {
    const oneDay = 86400000;
    let count = 0;
    let holiday = 0;
    let target = (date instanceof Date) ? date.getTime() : Date.now()
    date = new Date(target);
    // 営業日が設定されていない場合.
    businessDay = businessDay|0;
    if(businessDay == 0) {
        // デフォルトの営業日を取得.
        businessDay = DEF_BUSINESS_DAY;
    }
    // 営業日を計算.
    while(count <= businessDay) {
        date = new Date(target + (oneDay * (count + holiday)));
        // Googleカレンダーから祝日対応で対応.
        if(isHoliday(date)) {
            holiday ++;
            continue;
        }
        count ++;
    }
    return getStringDate(date);
}

// [実行パラメータ]営業日を取得.
const PARAMS_TYPE_BUSINESS_DAY = "businessDay";

// [bisinessパラメータ]営業日計算の開始日.
const PARAMS_START_DATE = "start_date";

// [bisinessパラメータ]計算したい営業日.
const PARAMS_BUSINESS_DAY = "business_day";

/**
 * [json返却]指定パラメータの営業日を取得.
 * パラメータを指定して、対象GASユーザに登録されている祝日や会社の休日を
 * 含んだ形で、営業日を取得する.
 */
const executeBusinessDay = function() {
    try {
        // 許可されたメールアドレスのドメインで
        // tokenも正しい場合はメールアドレスが付与されるか確認.
        const mail = getMailAndAuthMailAndAuthToken();
        if(mail == "") {
            // 認証が失敗の場合.
            throw new Error("gas login failed.");
        }
        // パラメータを取得.
        const params = getParams();
        const startDate = params[PARAMS_START_DATE];
        const businessDay = params[PARAMS_BUSINESS_DAY];
        // 営業日を計算.
        const result = getBusinessDay(
            typeof(startDate) == "string" ?
                new Date(startDate) : undefined,
            businessDay);
        // [success]JSON返却.
        return sendJSON({
            // 正常終了.
            status: 200,
            // タイプ.
            type: PARAMS_TYPE_BUSINESS_DAY,
            // メールアドレス.
            mail: mail,
            // 計算された営業日返却.
            value: result,
            // requestTokenKey.
            tokenKey: params[PARAMS_REQUEST_TOKEN_KEY],
            // redirectToken.
            redirectToken: createRedirectToken(PARAMS_TYPE_BUSINESS_DAY),
            // メッセージ.
            message: "success"
        });
    } catch(e) {
        console.error("[ERROR]executeBusinessDay: ");
        printStackTrace(e);
        // [error]JSON返却.
        return sendJSON({
            // 異常終了.
            status: 500,
            // タイプ.
            type: PARAMS_TYPE_BUSINESS_DAY,
            // メールアドレス.
            mail: "",
            // 計算された営業日返却.
            value: "-1",
            // メッセージ.
            message: "Failed to obtain business day."
        });
    }
}

// ゼロ返却のresult返却.
const zeroResult = function() {
    // 空のplain/textの条件を返信.
    const ret = ContentService.createTextOutput();
    ret.setMimeType(ContentService.MimeType.TEXT);
    ret.setContent(" ");
    return ret;
}

// 実行ターゲットパラメータを取得.
return (function() {
    // 実行ターゲットを取得.
    let target = getParams()[PARAMS_EXECUTE_TARGET];
    // パラメータが設定されている場合.
    if(typeof(target) == "string") {
        // それぞれの実行条件を選別.
        switch(target.trim()) {
            // アカウントデータの利用許可用.
            case PARAMS_TYPE_ALLOW_ACCOUNT_DATA:
                // アクセスがあったらsuccess返却するだけ.
                const res = ContentService.createTextOutput();
                res.setMimeType(ContentService.MimeType.TEXT);
                res.setContent("success");
                return res;            
            // oauth実行.
            case PARAMS_TYPE_OAUTH:
                return executeOAuth();
            // 営業日取得.
            case PARAMS_TYPE_BUSINESS_DAY:
                return executeBusinessDay();
        }
    }    
    // 条件内容が存在しない場合の返却.
    return zeroResult();
})();

// [EOF]===============================.
};
// ====================================.

// --------------
// getMethod処理.
// --------------
function doGet(e) {
    return executeGAS(e);
}













