///////////////////////////////////////////////////////////
// HTTPエラー処理.
///////////////////////////////////////////////////////////
(function(_g) {
'use strict'

// 1度httpError.jsをrequireされている場合.
if(_g.HttpError != undefined) {
    // 再読み込みしない.
    return;
}

// 基本HTTPステータス情報.
const HTTP_STATUS_TO_MESSAGE = {
    100: "Continue",
    101: "Switching Protocols",
    200: "Ok",
    201: "Created",
    202: "Accepted",
    203: "Non-Authoritative Information",
    204: "No Content",
    205: "Reset Content",
    206: "Partial Content",
    300: "Multiple Choices",
    301: "Moved Permanently",
    302: "Moved Temporarily",
    303: "See Other",
    304: "Not Modified",
    305: "Use Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Authorization Required",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Time-out",
    409: "Conflict",
    410: "Gone",
    411: "Length Required",
    412: "Precondition Failed",
    413: "Request Entity Too Large",
    414: "Request-URI Too Large",
    415: "Unsupported Media Type",
    416: "Requested range not satisfiable",
    417: "Expectation Faile",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Time-out",
    505: "HTTP Version not supported"
};

// null or undefinedかチェック.
const isNull = function(v) {
    return v == undefined || v == null;
}

// 数字かチェック.
const isNumeric = function(value) {
    return !isNaN(parseInt(value));
}

// ステータス変換.
const convStatus = function(value) {
    if(isNumeric(value)) {
        value = value|0;
        if(value <= 399) {
            return 500
        }
        return value;
    }
    return 500;
}

// ステータスからメッセージを取得.
const convMessage = function(status) {
    const message = HTTP_STATUS_TO_MESSAGE[status|0];
    if(isNull(message)) {
        return "error " + status;
    }
    return message;
}

// HTTPエラー発生時のテンプレート格納の環境変数名.
const ENV_ERROR_HTTP_TEMPLATE_PATH = "LFU_ERROR_HTML_TEMPLATE_PATH";

// HTTPエラー発生時のテンプレートパスの取得.
const getErrorHttpTemplatePath = function() {
    return process.env[ENV_ERROR_HTTP_TEMPLATE_PATH];
}

// 返却条件を取得.
// 戻り値: 以下の文字列が返却されます.
//   "js" の場合は、JSON返却でHTTPエラー返却を行います.
//   "jhtml" の場合、HTML返却でHTTPエラー返却を行います.
const getResponseModel = function() {
    const ret = _g['_$js_$model'];
    if(isNull(ret)) {
        return "js";
    }
    return ret;
}

// httpコンストラクタを取得.
const httpErrorConstructor = function(args) {
    // パラメータが設定されていない場合.
    if(isNull(args)) {
        args = {};
    }
    // 全条件を取得.
    let status = args.status;
    let message = args.message;
    let error = args.error;
    let templatePath = args.templatePath;
    let params = args.params;
    let model = getResponseModel();
    // ステータスを取得.
    status = convStatus(status);
    // メッセージが設定されていない場合.
    message = (typeof(message) == "string") ?
        message : convMessage(status);
    // errorオブジェクトをチェック.
    error = isNull(error) ? undefined : error;
    // templateが設定されていない場合.
    templatePath = (typeof(templatePath) == "string") ?
        templatePath : undefined;
    // templateが設定されていない場合.
    if(isNull(templatePath)) {
        // modelがjhtmlの場合のみ、デフォルト条件を利用する.
        if(model == "jhtml") {
            const envPath = getErrorHttpTemplatePath();
            // デフォルトテンプレートが指定されてる場合は、
            // そちらの条件をセット.
            templatePath = (typeof(envPath) == "string") ?
                envPath : undefined;
        }
    }
    // paramsオブジェクトをチェック.
    params = isNull(params) ? {} : params;
    return {
        status: status,
        message: message,
        error: error,
        templatePath: templatePath,
        params: params,
        model: model
    };
}

// HTTPエラーレスポンス情報を返却.
const httpErrorResponse = async function(
    httpStatus, httpHeader, status, message, model,
    templatePath, params) {
    // httpStatusをセット.
    httpStatus.setStatus(status);

    ////////////////////////////////////
    // modelで処理区分(js呼び出しの場合)
    ////////////////////////////////////
    if(model == "js") {
        // templatePathが設定されていない場合.
        // これが設定されている場合はHTML返却する.
        if(isNull(templatePath)) {
            // JSON形式でエラー返却.
            return httpErrorResponseToJSON(
                httpHeader, status, message, params);
        }
    }

    ///////////////////////////////////////
    // modelで処理区分(jhtml呼び出しの場合)
    ///////////////////////////////////////

    // templatePathが存在しない場合.
    if(isNull(templatePath)) {
        // デフォルトのHTTPエラーを返却.
        return httpErrorResponseToDefaultHTML(
            httpHeader, status, message
        );
    }
    // htmlのエラーテンプレートを返却.
    return await httpErrorResponseToHTML(
        httpStatus, httpHeader, status, message,
        templatePath, params
    )
}

// JSONでエラー結果を返却する.
const httpErrorResponseToJSON = function(
    httpHeader, status, message, params
) {
    // レスポンスヘッダをセット.
    httpHeader.put("content-type", "application/json");
    // json戻り値を設定.
    const ret = {};
    // パラメータ内容を付与.
    if(typeof(params) == "object") {
        for(let k in params) {
            ret[k] = params[k];
        }
    }
    // ステータスとメッセージをセット.
    ret.status = status;
    ret.message = message;
    // json返却.
    return JSON.stringify(ret);
}

// excontentsが利用できるかチェック.
// 戻り値: trueの場合利用できます.
const isExContains = function() {
    return typeof(_g["excontents"]) == "function";
}

// 指定パスから文字列コンテンツを取得.
// path 対象のパス名を設定します.
//      ここでのパスの解釈はexcontentで処理されます.
// charset 文字コードを設定します.
// 戻り値: 文字列が返却されます.
const getStringContents = async function(path, charset) {
    // 設定された環境からコンテンツを取得.
    let ret = await excontents(path);
    // charsetが設定されている場合.
    if(typeof(charset) == "string") {
        // binaryから文字列変換(charsetで変換).
        ret = ret.toString(charset);
    } else {
        // binaryから文字列変換(charset=utf8で変換).
        ret = ret.toString();
    }
    return ret;
}

// errorHTML返却時にエラーが発生した場合の返却処理.
const errorHtmlError = function(httpStatus, httpHeader, path, error) {
    // エラー内容を出力.
    console.log("errorHttp.Error: " + path, error);
    // エラーの場合デフォルトテンプレート返却.
    return httpErrorResponseToDefaultHTML(httpHeader, 500, convMessage(500));
}


// ${ ... } の内容をパラメータ内容に変換する.
// string 変換対象のstring内容を設定します.
// status 対象のステータスを設定します.
// message 対象のメッセージを設定します.
// params 対象のパラメータを設定します.
// 戻り値: 変換された内容が返却されます.
const change$ = function(string, status, message, params) {
    let ret = "";
    let c, qt, by, $pos, braces;
    by = false;
    $pos = -1;
    braces = 0;
    const len = string.length;
    for(let i = 0; i < len; i ++) {
        c = string[i];

        // ${ 検出中
        if($pos != -1) {
            // クォーテーション内.
            if(qt != undefined) {
                // 今回の文字列が対象クォーテーション終端.
                if(!by && qt == c) {
                    qt = undefined;
                }
            // クォーテーション開始.
            } else if(c == "\"" || c == "\'") {
                qt = c;
            // 波括弧開始.
            } else if(c == "{") {
                braces ++;
            // 波括弧終了.
            } else if(c == "}") {
                braces --;
                // 波括弧が終わった場合.
                if(braces == 0) {
                    // keyを取得.
                    const key = string.substring($pos + 2, i).trim();
                    // 条件で置き換える.
                    if(key == "status") {
                        // エラーステータスを置き換える.
                        ret += status;
                    } else if(key == "message") {
                        // エラーメッセージを置き換える.
                        ret += message;
                    } else if(!isNull(params[key])) {
                        // パラメータ内容を置き換える.
                        ret += params[key];
                    } else {
                        // 存在しない場合はスペースに置き換える.
                        ret += " ";
                    }
                    $pos = -1;
                }
            }
        // ${ ... }の開始位置を検出.
        } else if(c == "$" && i + 1 < len && string[i + 1] == "{") {
            $pos = i;
        // それ以外.
        } else {
            ret += c;
        }
        // 円マークの場合.
        by = (c == "\\");
    }
    return ret;
}

// HTML指定無しの返却条件.
// 超シンプルなerror statusとmessageをHTML表示する.
const DEFAULT_HTTP_TEMPLATE_VALUE =
    '<!DOCTYPE HTML SYSTEM "about:legacy-compat">' +
    '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ja">' +
    '<head><meta name="robots" content="noindex"><meta name="robots"' +
    ' content="noindex"></head><body>' +
    'error ${status}&nbsp;${message}' +
    '</body></hrml>'
;

// デフォルトのHTTPエラー返却.
const httpErrorResponseToDefaultHTML = function(
    httpHeader, status, message
) {
    // レスポンスヘッダをセット.
    httpHeader.put("content-type", "text/html");

    // デフォルトテンプレートをパラメータ変換処理で返却.
    return change$(
        DEFAULT_HTTP_TEMPLATE_VALUE,
        status, message, {});
}

// htmlテンプレートのHTTPエラー返却.
const httpErrorResponseToHTML = async function(
    httpStatus, httpHeader, status, message,
    templatePath, params
) {
    // コンテンツを取得.
    try {
        // excontantsメソッドが利用出来ない場合.
        if(!isExContains()) {
            // デフォルトのHTTPエラー返却.
            return httpErrorResponseToDefaultHTML(
                httpHeader, status, message
            );
        }
        // 指定テンプレートを取得.
        const ret = await getStringContents(templatePath);

        // レスポンスヘッダをセット.
        httpHeader.put("content-type", "text/html");

        // 指定テンプレートをパラメータ変換処理で返却.
        return change$(
            ret, status, message, params);

    } catch(e) {
        // 内部エラーの場合の返却内容.
        return errorHtmlError(httpStatus, httpHeader, templatePath, e);
    }
}


// HTTPエラー例外.
// args 連想配列で設定します.
//  status: エラー返却用HTTPステータスを設定します.
//  message: エラー返却用HTTPメッセージを設定します.
//  error: 親Errorオブジェクトを設定します.
//  templatePath: HTMLテンプレートを設定する場合Pathを設定します.
//                この値はexcontents()先のパスを設定します.
//                (また拡張子が.jhtmlの場合、jhtml形式で返却されます)
//                呼び出し元がjhtmlの場合のみ、この条件が有効となります.
//  params: パラメータを設定します.
//          呼び出し元がjs実行の場合 この値がJSON返却値となります.
//          (status, message以外)
//          呼び出し元がjs形式の場合JSON 返却、templatePathがjhtmlの場合は
//          その時のパラメータとして返却されます.
class HttpError extends Error {
    #status;
    #message;
    #model;
    #error;
    #templatePath;
    #params;
    // コンストラクタ.
    constructor(args) {
        // コンストラクタパラメータ妥当性チェック.
        args = httpErrorConstructor(args);
        // errorオブジェクトが設定されている場合.
        if(!isNull(args.error)) {
            // エラーを継承、メッセージを設定.
            super(args.message, args.error);
        } else {
            // メッセージを設定.
            super(args.message);
            args.error = null;
        }

        // メンバー変数をセット.
        this.#status = args.status;
        this.#message = args.message;
        this.#model = args.model;
        this.#error = args.error;
        this.#templatePath = isNull(args.templatePath) ?
            null : args.templatePath;
        this.#params = typeof(args.params) == "object" ?
            args.params : {};

        // Errorオブジェクト設定.
        Object.defineProperty(this, 'name', {
            configurable: true,
            enumerable: false,
            value: this.constructor.name,
            writable: true,
        });
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HttpError);
        }
    }
    // ステータスを取得.
    // 戻り値: httpステータスが返却されます.
    getStatus() {
        return this.#status;
    }
    // メッセージを取得.
    // 戻り値: メッセージが返却されます.
    getMessage() {
        return this.#message;
    }
    // 親エラーオブジェクトを取得.
    // 戻り値: 親エラーオブジェクトが返却されます.
    getError() {
        return this.#error;
    }
    // このエラーのレスポンス状況を取得.
    // httpStatus HttpStatus.jsオブジェクトを設定します.
    // httpHeader response用のhttpHeader.jsオブジェクトを設定します.
    // 戻り値: responseBody(文字列)が返却されます.
    async toResponse(httpStatus, httpHeader) {
        return await httpErrorResponse(
            httpStatus, httpHeader,
            this.#status, this.#message, this.#model,
            this.#templatePath, this.#params);
    }
}

// 外部からデフォルトのJSONエラー内容を返却する.
// httpStatus 対象のHTTPステータスを設定します.
// httpHeader 対象のHTTPヘッダを設定します.
// message 対象のHTTPステータスメッセージを設定します.
// 戻り値: JSON結果が文字列で返却されます.
const defaultJsonError = function(
    httpStatus, httpHeader, message) {
    // HTTPステータスを取得.
    let status = convStatus(httpStatus.getStatus());
    // 変更があった場合は再設定.
    httpStatus.setStatus(status);

    // messageが存在しない場合
    if(typeof(message) != "string") {
        message = convMessage(status);
    }

    // JSONでエラー結果を返却する.
    return httpErrorResponseToJSON(
        httpHeader, status, message, undefined);
}

// 外部からデフォルトのHTMLエラー内容を返却する.
// httpStatus 対象のHTTPステータスを設定します.
// httpHeader 対象のHTTPヘッダを設定します.
// message 対象のHTTPステータスメッセージを設定します.
// 戻り値: HTM結果が文字列で返却されます.
const defaultHttpError = function(
    httpStatus, httpHeader, message) {
    // HTTPステータスを取得.
    let status = convStatus(httpStatus.getStatus());
    // 変更があった場合は再設定.
    httpStatus.setStatus(status);

    // messageが存在しない場合
    if(typeof(message) != "string") {
        message = convMessage(status);
    }
    // デフォルトのHTTPエラー返却.
    return httpErrorResponseToDefaultHTML(
        httpHeader, status, message);
}

// 初期設定.
const init = function() {
    // HttpErrorオブジェクト.
    Object.defineProperty(_g, "HttpError",
        {writable: false, value: HttpError});

    // デフォルトのHTTPエラー返却.
    Object.defineProperty(_g, "defaultJsonError",
        {writable: false, value: defaultJsonError});

    // デフォルトのHTTPエラー返却.
    Object.defineProperty(_g, "defaultHttpError",
        {writable: false, value: defaultHttpError});
}

// 初期処理実行.
init();

})(global);
