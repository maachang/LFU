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
const executeGAS = function(params) {

    // (user-setting)[Token生成用]Auth用KeyCode定義.
    // 許可されたリクエストのみ利用が可能にするためのToken作成を行う
    // KeyCodeを設定します.
    // この内容はセンシティブな情報なので、GITにPushはNGです.
    const ALLOW_AUTH_KEY_CODE =
        "Note: Do not upload to git";
    
    // (user-setting)[allow mail Domain]許可するメールアドレスのドメイン名群.
    const ALLOW_MAIL_DOMAINS = [
        // ここにドメイン名(@除く文字列)を設定します.
    
    ];
    
    // (user-setting)tokenタイムアウト値(秒)
    const TOKEN_TIMEOUT_SECOND = -1;
    
    // (user-setting)[favicon.ico]googleDrive上のfavicon.ico(png形式のみ).
    // ここではファイルIDを設定します.
    const GDRV_FAVICON_ICO_ID = "";
    
    // [default]tokenタイムアウト値(秒)
    const DEF_TOKEN_TIMEOUT_SECOND = 60;
    
    // [default]営業日.
    const DEF_BUSINESS_DAY = 5;
    
    // [実行パラメータ]処理タイプ.
    const PARAMS_EXECUTE_TARGET = "target";
    
    // [認証パラメータ]requestTokenKey.
    // request元がtokenを作成するに対して利用したrequestTokenKeyが
    // 格納されます.
    const PARAMS_REQUEST_TOKEN_KEY = "request-token-key";
    
    // [認証パラメータ]requestToken.
    // request側で作成したToken.
    const PARAMS_REQUEST_TOKEN = "request-token";
    
    // 文字列変換.
    const convString = function(v) {
        if(v == undefined || v == null) {
            return "";
        }
        return ("" + v).trim();
    }
    
    // Googleログイン中のGoogleメールアドレスを取得.
    const getMailAddress = function() {
        return convString(Session.getActiveUser()
            .getUserLoginId());
    }
    
    // URLパラメータを取得.
    const getParams = function() {
        return params.parameter;
    }
    
    // 1byte内容をHex変換.
    const conv1byteToHex = function(n) {
        let ret = (n & 0x0ff).toString(16);
        if(ret.length == 1) {
            ret += '0';
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
        let hex, ret = "";
        const len = rowHash.length;
        for (let i = 0; i < len; i ++) {
            ret += conv1byteToHex(rowHash[i]);
        }
        return ret;
    };
    
    // tokenKeyCodeのタイムアウト値チェック.
    // tokenKeyCode: tokenKeyCodeを設定します.
    // 戻り値: タイムアウトの場合 true返却.
    const isTokenTimeout = function(tokenKeyCode) {
        // tokenKeyCodeから生成時間を取得.
        const p = tokenKeyCode.lastIndexOf("_");
        if(p == -1) {
            // 取得できない場合タイムアウト扱い.
            return true;
        }
        // 生成時間を取得.
        const createTime = parseInt(
            tokenKeyCode.substring(p + 1), 16);
        if(isNaN(createTime)) {
            // 取得できない場合タイムアウト扱い.
            return true;
        }
        // タイムアウト値を取得.
        let timeout = TOKEN_TIMEOUT_SECOND |0;
        if(timeout <= 0) {
            timeout = DEF_TOKEN_TIMEOUT_SECOND;
        }
        // 現在時刻がToken発行＋タイムアウト値を超えてる場合.
        return Date.now() > createTime + (timeout * 1000);
    }
    
    // token区切り文字.
    const TOKEN_DELIMIRATER = "$_\n";
    
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
        if(typeof(target) != "string") {
            return false;
        }
        target = target.trim();
    
        // PARAMS_REQUEST_TOKEN_KEYが存在するかチェック.
        const tokenKeyCode = params[PARAMS_REQUEST_TOKEN_KEY];
        if(typeof(tokenKeyCode) != "string") {
            return false;
        }
    
        // tokenKeyCodeタイムアウトチェック.
        if(isTokenTimeout(tokenKeyCode)) {
            return false;
        }
    
        // PARAMS_REQUEST_TOKENが存在するかチェック.
        const requestToken = params[PARAMS_REQUEST_TOKEN];
        if(typeof(requestToken) != "string") {
            return false;
        }
    
        // シグニチャを作成.
        let signature = allowAuthKeyCode +
            TOKEN_DELIMIRATER + target +
            TOKEN_DELIMIRATER + tokenKeyCode;
        // targetが"oauth"の場合.
        if(target == PARAMS_TYPE_OAUTH) {
            // 対象のパラメータをセット.
            signature += TOKEN_DELIMIRATER +
                convString(params[PARAMS_REDIRECT_URL]) +
                TOKEN_DELIMIRATER +
                convString(params[PARAMS_SOURCE_ACCESS_URL]);
        // targetが"bisunessdate"の場合.
        } else if(target == PARAMS_TYPE_BUSINESS_DAY) {
            // 対象のパラメータをセット.
            signature += TOKEN_DELIMIRATER +
                convString(params[PARAMS_START_DATE]) +
                TOKEN_DELIMIRATER +
                convString(params[PARAMS_BUSINESS_DAY]);
        }
    
        // signatureとrequestのtokenKeyCodeから
        // checkTokenを作成する.
        const checkToken = convertToHMmacSHA256(
            signature, tokenKeyCode
        );
        
        // 作成したcheckTokenとrequestTokenを比較する.
        return checkToken.toLowerCase() == requestToken.toLowerCase();
    }
    
    // URLの妥当性チェックを行います.
    const isURL = function(url) {
        return url.startsWith("http://") ||
            url.startsWith("https://");
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
            // 許可されたメールアドレスのドメイン名であり
            // tokenが正しい事場合、メールアドレスを返却.
            if(isAllowMail(mail) &&
                isAuthRequestAccessToken()) {
                return mail;
            }
        } catch(e) {
        }
        // 失敗の場合は空を返却.
        return ""
    }
    
    // googleDrive上のfavicon.icoのURLを取得.
    const getGDrvFaviconIcoURL = function() {
        if(GDRV_FAVICON_ICO_ID.length == 0) {
            return "";
        }
        return "https://drive.google.com/uc?id=" +
            GDRV_FAVICON_ICO_ID + "&.png";
    }
    
    // [gasHTML用パラメータ]タイトル.
    const PARAMS_HTML_TITLE = "html-title";
    
    // [gasHTML用パラメータ]favicon.ico
    const PARAMS_HTML_FAVICON_ICO_URL = "html-favicon-ico-url";
    
    // htmlをevaluateして返却.
    // template.evaluate() を実行する場合は、こちらを呼び出します.
    const evaluateHTML = function(template) {
        let ret = template.evaluate();
        // タイトルを取得.
        const title = getParams()[PARAMS_HTML_TITLE];
        // favicon.icoのURLが有効な場合.
        if(typeof(title) == "string") {
            return ret.setTitle(title);
        }
        // favicon.icoのURLを取得.
        let url = getParams()[PARAMS_HTML_FAVICON_ICO_URL];
        // favicon.icoのURLが有効な場合.
        if(typeof(url) == "string" && isURL(url)) {
            return ret.setFaviconUrl(url);
        // googleDrive上のfavicon.icoが存在する場合.
        } else {
            url = getGDrvFaviconIcoURL();
            if(isURL(url)) {
                return ret.setFaviconUrl(url);
            }
        }
        // favicon.icoのURLが無効な場合.
        return ret;
    }
    
    // [実行パラメータ]oAuth認証確認.
    const PARAMS_TYPE_OAUTH = "oAuth";
    
    // [oAuth用パラメータ]リダイレクトURL.
    // ログイン成功時のリダイレクトURLを設定します.
    const PARAMS_REDIRECT_URL = "redirect-url";
    
    // [oAuth用パラメータ]元のアクセスURL.
    // 本来アクセスしたいURLが設定されます.
    const PARAMS_SOURCE_ACCESS_URL = "src-access-url";
    
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
     */
    const executeOAuth = function() {
        try {
            // 許可されたメールアドレスのドメインで
            // tokenも正しい場合はメールアドレスが付与されるか確認.
            const mail = getMailAndAuthMailAndAuthToken();
            const params = getParams();
            const redirectURL = convString(
                params[PARAMS_REDIRECT_URL]);
            const srcAccessURL = convString(
                params[PARAMS_SOURCE_ACCESS_URL]);
            // メールアドレスが取得できている.
            // redirect先URLが存在する.
            // 元のアクセスURLが存在する.
            if(
                mail != "" &&
                isURL(redirectURL) &&
                isURL(srcAccessURL)
            ) {
                // index.htmlのテンプレートを読み込む.
                const template =
                    HtmlService.createTemplateFromFile(
                        "oAuthSuccess.html");
                // パラメータをセット.
                template.params = {
                    // リダイレクトする時のURLを返却.
                    redirectUrl: redirectURL,
                    // アクセス元のURL.
                    srcAccessUrl: srcAccessURL,
                    // googleWorkspaceにログインしているメールアドレス.
                    mail: mail,
                }
                // テンプレートの実行結果を返却.
                return evaluateHTML(template);
            }
        } catch(e) {
            // 例外もoAuth失敗扱い.
        }
        // oauth失敗.
        return evaluateHTML(
            HtmlService.createTemplateFromFile(
                "oAuthError.html"));
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
            const startDate = getParams()[PARAMS_START_DATE];
            const businessDay = getParams()[PARAMS_BUSINESS_DAY];
            // 営業日を計算.
            const result = getBusinessDay(
                typeof(startDate) == "string" ?
                    new Date(startDate) : undefined,
                businessDay);
            // [success]JSON返却.
            const output = ContentService.createTextOutput();
            output.setMimeType(ContentService.MimeType.JSON);
            output.setContent(JSON.stringify({
                status: 200,
                value: result
            }));
        } catch(e) {
            // [error]JSON返却.
            const output = ContentService.createTextOutput();
            output.setMimeType(ContentService.MimeType.JSON);
            output.setContent(JSON.stringify({
                status: 500,
                value: "" + e
            }));
        }
    }
    
    // ゼロ返却のresult返却.
    const zeroResult = function() {
        // 空のplain/textの条件を返信.
        const ret = ContentService.createTextOutput();
        ret.setMimeType(ContentService.MimeType.TEXT);
        ret.setContent("not execute gas.");
        return ret;
    }
    
    // 実行ターゲットパラメータを取得.
    return (function() {
        // 実行ターゲットを取得.
        let target = getParams()["target"];
        // パラメータが設定されている場合.
        if(typeof(target) == "string") {
            // それぞれの実行条件を選別.
            switch(target.trim()) {
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
    
    
    
    
    
    
    