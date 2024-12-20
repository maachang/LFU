//////////////////////////////////////////////////////////
// lambda-func-url の環境設定用セットアップ.
//////////////////////////////////////////////////////////
(function() {
'use strict'

// Lambdaに適した最低限のMimeType.
const mime = frequire("./lib/mimeType.js");

// HTTPステータス.
const httpStatus = frequire("./lib/httpStatus.js");

// HTTPヘッダ.
const httpHeader = frequire("./lib/httpHeader.js");

// filterFunction呼び出し処理.
// コンテンツ呼び出しの前処理を行い、コンテンツ利用に対して
// 制御することができます.
//
// この値がundefinedの場合、処理されません.
let _filterFunction = undefined;

// 拡張MimeType判別処理.
// function(extends)が必要で、拡張子の結果に対して
// 戻り値が {type: mimeType, gz: boolean}を返却する
// 必要があります(非対応の場合は undefined).
//
// この値がundefinedの場合、処理されません.
let _originMimeFunction = undefined;

// requestFunction呼び出し処理.
// 環境変数に従って専用のfunction(jsFlag, path)の
// Functionが作成される.
// jsFlag 実行するJavascriptを取得する場合は true.
// path 対象のパスを設定.
// 戻り値: jsFlag = true js情報
//        jsFlag = fale コンテンツ情報
let _requestFunction = undefined;

// requestHead呼び出し処理.
// 環境変数に従って専用のfunction(path)のFunctionが
// 作成される.
// path 対象のパスを設定.
// 戻り値: response情報.
//let _requestHeadFunc = undefined;

// エラー例外処理.
// message エラーメッセージを設定します.
const error = function(message) {
    throw new Error("ERROR [LFUSetup] " + message);
}

// カンマ[,]単位で区切ってArray返却.
// value 文字列を設定します.
// 戻り値: カンマで区切られた内容がArrayで返却されます.
const parseComma = function(value) {
    const list = value.split(",");
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        list[i] = list[i].trim();
    }
    return list;
}

// ArrayをMap変換.
// keys MapのKey群を設定します.
// array Arrayを設定します.
// 戻り値: Mapが返却されます.
//        keys = ["a", "b", "c"];
//        array = [1, 2, 3];
//        戻り値: {"a": 1, "b": 2, "c": 3}
const arrayToMap = function(keys, array) {
    const len = keys.length;
    const ret = {};
    for(let i = 0; i < len; i ++) {
        ret[keys[i]] = array.length >= (i + 1) ?
            array[i] : undefined;
    }
    return ret;
}

// LFUのrequire系キャッシュを削除.
const clearRequireCache = function() {
    // git requireキャッシュ削除.
    if(global["grequire"] != undefined) {
        try {
            // エラー無視.
            global["grequire"].clearCache();
        } catch(e) {}
    }
    // s3 requireキャッシュ削除.
    if(global["s3require"] != undefined) {
        try {
            // エラー無視.
            global["s3require"].clearCache();
        } catch(e) {}
    }
    // lambda requireキャッシュ削除.
    if(global["frequire"] != undefined) {
        try {
            global["frequire"].clearCache();
        } catch(e) {}
    }

    // 通常requireキャッシュ削除.
    const cache = require.cache;
    for(let k in cache) {
        delete cache[k];
    }
}

//--------------------------------------------------------
// [環境変数]定義.
//--------------------------------------------------------

// [環境変数]メインで利用するrequireやrequest先.
// この条件は[必須]です.
// "MAIN_EXTERNAL"="s3": S3をメインで利用する場合.
// "MAIN_EXTERNAL"="git": github repogitoryをメインで利用する場合.
const _ENV_MAIN_EXTERNAL = "MAIN_EXTERNAL";

// [環境変数]request時のカレントパス設定.
// この条件は[必須]です
// 設定方法は
//   "REQUEST_PATH"="currentPath"
// と設定します.
const _ENV_REQUEST_PATH = "REQUEST_PATH";

// [環境変数]s3require, s3request時の接続設定.
// "MAIN_EXTERNAL"="s3" の場合は、この条件は[必須]です.
// 設定方法は
//   "S3_CONNECT"="requirePath, region"
// とカンマ[,]単位で区切って設定します.
// 最後の "region" は、省略された場合、東京リージョン
//「ap-northeast-1」になります.
const _ENV_S3_CONNECT = "S3_CONNECT";

// [環境変数]grequire, grequest時の接続設定.
// "MAIN_EXTERNAL"="git" の場合は、この条件は[必須]です.
// 設定方法は
//   "GIT_CONNECT"="organization, repo, branch, requirePath"
// とカンマ[,]単位で区切って設定します.
const _ENV_GIT_CONNECT = "GIT_CONNECT";


// [環境変数]grequire, grequest時のprivateGithubRepogitoryのToken設定.
// これを設定する場合は対象のGithubRepogitoryがPrivateの場合設定必須です.
// この内容はLfuのsecretsManagerで暗号化されている必要があります.
const _ENV_GIT_CONNECT_TOKEN = "GIT_CONNECT_TOKEN";

// [環境変数]lorequire, lorequest時の接続設定.
// この設定は[任意]で設定方法は
//   "LO_CONNECT"="requirePath"
// として、デフォルトのpathを設定します.
// 省略された場合は "public" が設定されます.
const _ENV_LO_CONNECT = "LO_CONNECT";

// [環境変数]grequire, grequestのキャッシュタイムアウト値.
// キャッシュタイムアウト値をミリ秒単位で設定します.
// この値は[任意]で、デフォルト値は30000ミリ秒です.
const _ENV_CACHE_TIMEOUT = "CACHE_TIMEOUT";

// [環境変数]grequire, grequestのキャッシュを行わない場合設定します.
// キャッシュをしない場合は NONE_CACHE=true と設定します.
// この値は[任意]で、デフォルト値はキャッシュONです.
const _ENV_NONE_CACHE = "NONE_CACHE";

// [環境変数]GZIP圧縮を行わない場合設定します.
// GZIP圧縮をしない場合は NONE_GZIP=true と設定します.
// この値は[任意]で、デフォルト値はGZIPはONです.
const _ENV_NONE_GZIP = "NONE_GZIP";

// [環境変数]MAINバケット名.
// メインで利用するS3Bucket名を設定します.
// この値は[任意]ですが、メインS3バケット名を設定しておくと
// ハードコーディングが不要なので設定を推奨します.
const _ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [環境変数]filterFunc読み込み先を指定.
// この条件はexrequire(process.env[_ENV_FILTER_FUNCTION], true, "")で
// 取得されます(カレントパスなし、キャッシュなし).
// また `start` メソッドで渡された場合は、そちらが優先となります.
const _ENV_FILTER_FUNCTION = "FILTER_FUNCTION";

// [環境変数]originMime読み込み先を指定.
// この条件はexrequire(process.env[_ENV_ORIGIN_MIME], true, "")で
// 取得されます(カレントパスなし、キャッシュなし).
// また `start` メソッドで渡された場合は、そちらが優先となります.
const _ENV_ORIGIN_MIME = "ORIGIN_MIME";

// [環境変数] pathの最後が/の時のインデックスパス内容.
// この値が設定されていない場合はインデックスパスは `index.html` が
// 設定されます.
const _ENV_INDEX_PATH = "LFU_INDEX_PATH";

// [mainExternal]localFileの場合.
const _MAIN_LO_EXTERNAL = -1;

// [mainExternal]S3の場合.
const _MAIN_S3_EXTERNAL = 0;

// [mainExternal]Gitの場合.
const _MAIN_GIT_EXTERNAL = 1;

// [ENV]インデックスパス.
let INDEX_PATH = process.env[_ENV_INDEX_PATH];
if(INDEX_PATH == undefined) {
    INDEX_PATH = "index.html";
}

// 有効な環境変数を取得. 
const getLFUEnv = function() {
    // s3 or git メインで利用する外部接続先.
    let mainExternal = process.env[_ENV_MAIN_EXTERNAL];
    // request接続先のカレントパス.
    let requestPath = process.env[_ENV_REQUEST_PATH];
    // 外部接続先's3'の接続基本設定.
    let s3Connect = process.env[_ENV_S3_CONNECT];
    // 外部接続先'githubRepogitory'の接続基本設定.
    let gitConnect = process.env[_ENV_GIT_CONNECT];
    // 対象のgithubRepogitoryがPrivate設定の場合のToken設定.
    let gitConnectToken = process.env[_ENV_GIT_CONNECT_TOKEN];
    // 外部接続先 'localFile'の接続基本設定.
    let loConnect = process.env[_ENV_LO_CONNECT];
    // キャッシュタイムアウト.
    let cacheTimeout = process.env[_ENV_CACHE_TIMEOUT];
    // 基本キャッシュなし条件.
    let noneCache = process.env[_ENV_NONE_CACHE];
    // 基本GZIPなし条件.
    let noneGzip = process.env[_ENV_NONE_GZIP];
    // メインS3Bucket名.
    let mainS3Bucket = process.env[_ENV_MAIN_S3_BUCKET];

    // メインで利用する外部接続先の存在確認.
    if(mainExternal == undefined) {
        error(_ENV_MAIN_EXTERNAL + " is a required setting.");
    }
    // 利用External接続先を判別.
    mainExternal = mainExternal.trim().toLowerCase();
    if(mainExternal == "lo" || mainExternal == "file") {
        // lo.
        mainExternal = _MAIN_LO_EXTERNAL;
    } else if(mainExternal == "s3") {
        // s3.
        mainExternal = _MAIN_S3_EXTERNAL;
    } else if(mainExternal == "git" || mainExternal == "github") {
        // git.
        mainExternal = _MAIN_GIT_EXTERNAL;
    } else {
        error("Setting " + _ENV_MAIN_EXTERNAL +
            ": " + mainExternal + " is out of scope.");
    }

    // requestPath.
    if(requestPath == undefined) {
        error(_ENV_REQUEST_PATH + " is a required setting.");
    }
    requestPath = requestPath.trim();

    /////////////////////////////////////////////////////
    // loConnect.
    // loConnectは、対象パスの「あり・なし」なので、別途
    // mainExternal の有無の設定は関係なし.
    /////////////////////////////////////////////////////
    if(loConnect != undefined) {
        // lorequire利用可能な場合.
        if((process.env["require.loreqreg"] || "") != "false") {
            // loConnectが定義されている場合.
            // 基本パス名が入ってくるので、強制的に文字列変換.
            loConnect = ("" + loConnect).trim();
        // lorequire利用不可能な場合.
        } else {
            loConnect = undefined;
        }
    }

    //////////////
    // s3Connect.
    //////////////
    // s3reqreg利用不可な場合.
    if((process.env["require.s3reqreg"] || "") == "false") {
        s3Connect = undefined;
    }
    // [ENV]s3Connectが設定されてない場合.
    if(s3Connect == undefined) {
        // 環境変数のs3Connect定義が存在しない場合.
        // mainExternal が S3の場合はエラー.
        if(mainExternal == _MAIN_S3_EXTERNAL) {
            error(_ENV_S3_CONNECT + " is a required setting.");
        }
    // [ENV]s3Connectが設定されてる場合.
    } else {
        // s3Connectをカンマ区切りでパースする.
        s3Connect = arrayToMap(
            ["requirePath", "region"],
            parseComma(s3Connect));
        // s3ConnectにrequestPathが存在しない場合.
        if(s3Connect.requirePath == undefined) {
            error(_ENV_S3_CONNECT + ".requirePath is a required setting.");
        }
    }

    //////////////
    // gitConnect.
    //////////////
    // gitreqreg利用不可な場合.
    if((process.env["require.greqreg"] || "") == "false") {
        gitConnect = undefined;
    }
    // [ENV]gitConnectが設定されてない場合.
    if(gitConnect == undefined) {
        // 環境変数のgitConnectが存在しない場合.
        // mainExternal が GITの場合はエラー.
        if(mainExternal == _MAIN_GIT_EXTERNAL) {
            error(_ENV_GIT_CONNECT + " is a required setting.");
        }
    // [ENV]gitConnectが設定されてる場合.
    } else {
        // gitConnectをカンマ区切りでパースする.
        gitConnect = arrayToMap(
            ["organization", "repo", "branch", "requirePath"],
            parseComma(gitConnect));
        if(gitConnect.organization == undefined) {
            error(_ENV_GIT_CONNECT + ".organization is a required setting.");
        } else if(gitConnect.repo == undefined) {
            error(_ENV_GIT_CONNECT + ".repo is a required setting.");
        } else if(gitConnect.branch == undefined) {
            error(_ENV_GIT_CONNECT + ".branch is a required setting.");
        } else if(gitConnect.requirePath == undefined) {
            error(_ENV_GIT_CONNECT + ".requirePath is a required setting.");
        }
    }

    // cacheTimeout.
    if(cacheTimeout != undefined) {
        cacheTimeout = parseInt(cacheTimeout);
        if(isNaN(cacheTimeout)) {
            error(_ENV_CACHE_TIMEOUT + " must be numeric.");
        }
    }

    // noneCache.
    if(noneCache != undefined) {
        noneCache = noneCache == true;
    }

    // noneGzip.
    if(noneGzip != undefined) {
        noneGzip = noneGzip == true;
    }

    // mainS3Bucket.
    if(mainS3Bucket != undefined) {
        // s3:// などの条件を削除.
        let p = mainS3Bucket.indexOf("://");
        if(p != -1) {
            mainS3Bucket = mainS3Bucket.substring(p + 3);
        }
        // 最後の / を削除.
        mainS3Bucket = mainS3Bucket.trim();
        if(mainS3Bucket.endsWith("/")) {
            mainS3Bucket.substring(0, mainS3Bucket.length - 1);
        }
    }

    // 解析結果を返却.
    return {
        mainExternal: mainExternal,
        requestPath: requestPath,
        loConnect: loConnect,
        s3Connect: s3Connect,
        gitConnect: gitConnect,
        gitConnectToken: gitConnectToken,
        cacheTimeout: cacheTimeout,
        noneCache: noneCache,
        noneGzip: noneGzip,
        mainS3Bucket: mainS3Bucket
    };
}

// request呼び出し・require呼び出し処理のFunction登録.
// getLFUEnvでLFUで有効な環境変数を取得します.
// 標準定義されたrequire呼び出し `exrequire` を定義します.
// この条件は _requestFunction と同じく主たる外部環境に対して、
// 外部環境上で利用するrequireに対して、利用する事で環境依存を
// 防ぐことができます.
const regRequestRequireFunc = function(env) {
    // 既に定義済みの場合は処理しない.
    if(global.exrequire != undefined &&
        global.excontents != undefined &&
        _requestFunction != undefined) {
        return;
    }
    let exreq, excon, reqFunc;
    // mainExternal がS3の場合.
    if(env.mainExternal == _MAIN_S3_EXTERNAL) {
        // s3内で利用するrequire処理.
        exreq = async function(
            path, noneCache, currentPath, response) {
            if(currentPath == undefined || currentPath == null) {
                currentPath = "";
            }
            return await global.s3require(path, currentPath,
                noneCache, response);
        }

        // s3内で利用するcontains処理.
        excon = async function(
            path, currentPath, response) {
            if(currentPath == undefined || currentPath == null) {
                currentPath = "";
            }
            return await global.s3contents(path, currentPath,
                response);
        }

        // s3用のhead処理.
        //_requestHeadFunc = function(path) {
        //    return global.s3head(path, env.requestPath);
        //}

        // s3用のrequest処理.
        reqFunc = async function(jsFlag, path, response) {
            let ret = null;
            // javascript実行呼び出し.
            if(jsFlag == true) {
                // キャッシュしないs3require実行.
                ret = await global.s3require(path, env.requestPath, true, response);
            } else {
                // s3contentsを実行してコンテンツを取得.
                ret = await global.s3contents(path, env.requestPath, response);
            }
            // レスポンスが設定されている場合.
            if(response != undefined && response != null) {
                // レスポンスヘッダを変換.
                response.header = httpHeader.create(response.header, null)
            }
            return ret;
        };
    
    // mainExternal がGithubRepogitoryの場合.
    } else {
        // github内で利用するrequire処理
        exreq = function(path, noneCache, currentPath, response) {
            if(currentPath == undefined || currentPath == null) {
                currentPath = "";
            }
            return global.grequire(path, currentPath,
                noneCache, response);
        }

        // github内で利用するcontains処理.
        excon = function(path, currentPath, response) {
            if(currentPath == undefined || currentPath == null) {
                currentPath = "";
            }
            return global.gcontents(path, currentPath,
                response);
        }

        // github用のhead処理.
        //_requestHeadFunc = function(path) {
        //    return global.ghead(path, env.requestPath);
        //}
        
        // github用のrequest処理.
        reqFunc = async function(jsFlag, path, response) {
            let ret = null;
            // javascript実行呼び出し.
            if(jsFlag == true) {
                // キャッシュしないgrequire実行.
                ret = await global.grequire(path, env.requestPath, true, response);
            } else {
                // gcontentsを実行してコンテンツを取得.
                ret = await global.gcontents(path, env.requestPath, response);
            }
            // レスポンスが設定されている場合.
            if(response != undefined && response != null) {
                // レスポンスヘッダを変換.
                response.header = httpHeader.create(response.header, null)
            }
            return ret;
        };
    }

    // 生成結果をセット.
    global.exrequire = exreq;
    global.excontents = excon;
    _requestFunction = reqFunc;
}

// filterFunctionを設定.
const setFilterFunction = function(res) {
    // filter functionの関数名で実行処理を取得.
    if(typeof(res["filter"]) == "function") {
        _filterFunction = res["filter"];
    } else if(typeof(res["handler"]) == "function") {
        _filterFunction = res["handler"];
    } else {
        // 対象関数名が存在しない場合.
        throw new Error(
            "Not a valid filter function caller");
    }    
}

// originalMimeFunctionを設定.
const setOriginMimeFunction = function(res) {
    if(typeof(res["mime"]) == "function") {
        _originMimeFunction = res["mime"];
    } else if(typeof(res["handler"]) == "function") {
        _originMimeFunction = res["handler"];
    } else {
        // 対象関数名が存在しない場合.
        throw new Error(
            "Not a valid original mime function caller");
    }
}

// mimeType情報を取得.
// AWS Lambdaで最低限のMimeTypeと、ユーザ指定の
// MimeType定義の評価結果が返却されます.
// extenion 拡張子を設定します.
// 戻り値: 一致した条件が存在する場合
//        {type: string, gz: boolean}
//        が返却されます.
const getMimeType = function(extention) {
    // originMimeFuncが存在しない場合.
    if(_originMimeFunction == undefined) {
        // 環境変数に定義されてる場合それを利用.
        const path = process.env[_ENV_ORIGIN_MIME];
        if(path != undefined) {
            const res = exrequire(path, true, "");
            setOriginMimeFunction(res);
        }
    }
    let ret = undefined;
    // originMimeFuncが存在する場合.
    if(_originMimeFunction != undefined) {
        // その条件で返却.
        ret = _originMimeFunction(extention);
        // 条件が見合わない場合.
        if(typeof(ret) != "object" ||
            ret.type == undefined ||
            ret.gz == undefined) {
            // 空設定.
            ret = undefined;
        }
    }
    // 存在しない場合.
    if(ret == undefined) {
        // Lambdaに最適なMimeTypeを取得.
        ret = mime.get(extention);
    }
    // 最終的にundefinedの場合は、octet_streamをセット.
    return ret == undefined ?
        {type: mime.OCTET_STREAM, gz: false} : ret;
}

// requestQuery(URL: xxx?a=1&b=2...).
// event aws Lambda[index.js]exports.handler(event)条件が設定されます.
// 戻り値: {key: value .... } のパラメータ条件が返却されます.
//        存在しない場合は {}が返却されます.
const getQueryParams = function(event) {
    const ret = event.queryStringParameters;
    if(ret == undefined || ret == null) {
        return {};
    }
    return ret;
}

// パスの拡張子を取得.
// path 対象のパスを設定します.
// 戻り値: 拡張子が無い場合は undefined.
//        拡張子が存在する場合は拡張子返却(toLowerCase対応)
const getPathToExtends = function(path) {
    // 最後が / の場合は拡張子なし.
    if((path = path.trim()).endsWith("/")) {
        return undefined;
    }
    // 最後にある / の位置を取得.
    let p = path.lastIndexOf("/");
    let obj = path.substring(p);
    p = obj.lastIndexOf(".");
    if(p == -1) {
        return undefined;
    }
    return obj.substring(p + 1).trim().toLowerCase();
}

// 現状の拡張子に対するResourceModelを設定.
// extension 拡張子を設定します.
// 戻り値: modelが返却されます.
const responseModel = function(extension) {
    let ret;
    if(extension == undefined) {
        ret = "js";
    } else {
        ret = "jhtml";
    }
    // 呼び出しモデル(js or jhtml)をセット.
    global['_$js_$model'] = ret;
    return ret;
}

// パス情報の変換処理.
// 戻り値: ディレクトリ指定の場合は 環境変数で設定された
//        IndexPathを追加します.
const convertHttpPath = function(path) {
    if((path = path.trim()).endsWith("/")) {
        return path += INDEX_PATH;
    }
    return path;
}

// HTTP-NoCacheヘッダをセット.
// headerObject 対象のHTTPヘッダ(Object型)を設定します.
// 戻り値: Objectが返却されます.
const setNoneCacheHeader = function(headerObject) {
    // キャッシュ条件が設定されている場合.
    if(headerObject["last-modified"] != undefined ||
        headerObject["etag"] != undefined) {
        return headerObject;
    }
    // HTTPレスポンスキャッシュ系のコントロールが設定されていない
    // 場合にキャッシュなしを設定する.
    if(headerObject["cache-control"] == undefined) {
        headerObject["cache-control"] = "no-cache";
    }
    if(headerObject["pragma"] == undefined) {
        headerObject["pragma"] = "no-cache";
    }
    if(headerObject["expires"] == undefined) {
        headerObject["expires"] = "-1";
    }
    return headerObject;
}

// レスポンス返却用情報を作成.
// status レスポンスステータスコードを設定します.
// headerObject レスポンスヘッダ(Object型)を設定します.
// cookies Cookie情報群を設定します.
// body レスポンスBodyを設定します.
// noBody bodyチェックが不要な場合は true.
// 戻り値: objectが返却されます.
const returnResponse = function(
    status, headerObject, cookies, body, noBody) {
    let isBase64Encoded = false;
    // bodyチェックが不要な場合は true.
    if(noBody != true) {
        // レスポンスBodyが存在する場合セット.
        if(body != undefined && body != null) {
            const tof = typeof(body);
            // 文字列返却.
            if(tof == "string") {
                // コンテンツタイプが設定されていない場合.
                if(headerObject["content-type"] == undefined) {
                    headerObject["content-type"] = getMimeType("text").type;
                }
            // バイナリ返却(Buffer).
            } else if(body instanceof Buffer) {
                body = body.toString("base64");
                isBase64Encoded = true;
                // コンテンツタイプが設定されていない場合.
                if(headerObject["content-type"] == undefined) {
                    headerObject["content-type"] = mime.OCTET_STREAM;
                }
            // バイナリ返却(typedArray or ArrayBuffer).
            } else if(ArrayBuffer.isView(body) || body instanceof ArrayBuffer) {
                body = Buffer.from(body).toString('base64')
                isBase64Encoded = true;
                // コンテンツタイプが設定されていない場合.
                if(headerObject["content-type"] == undefined) {
                    headerObject["content-type"] = mime.OCTET_STREAM;
                }
            // json返却.
            } else if(tof == "object") {
                body = JSON.stringify(body);
                // コンテンツタイプが設定されていない場合.
                if(headerObject["content-type"] == undefined) {
                    headerObject["content-type"] = mime.JSON;
                }
            // それ以外の場合.
            } else {
                // 空文字をセット.
                body = "";
            }
        } else {
            // bodyが物理的に存在しない.
            body = "";
        }
    // bodyが空定義.
    } else {
        body = "";
    }
    // Lambdaの関数URL戻り値を設定.
    return {
        statusCode: status|0
        ,statusMessage: httpStatus.toMessage(status|0)
        ,headers: setNoneCacheHeader(headerObject)
        ,cookies: cookies
        ,isBase64Encoded: isBase64Encoded
        ,body: body
    };
}

// [js実行]実行結果の戻り値を出力.
// resState 対象のhttpStatus.jsオブジェクトを設定します.
// resHeader 対象のhttpHeader.jsオブジェクトを設定します.
// resBody 対象のBody情報を設定します.
// 戻り値: returnResponse条件が返却されます
const resultJsOut = function(resState, resHeader, resBody) {
    // 実行結果リダイレクト条件が設定されている場合.
    if(resState.isRedirect()) {
        let header, cookies;
        const url = resState.getRedirectURL();
        // URL別のリダイレクトの場合.
        if(url.startsWith("http://") || url.startsWith("http://")) {
            // headerやcookieは引き継がない.
            header = {};
            cookies = [];
        // lfu内のリダイレクトの場合.
        } else {
            // headerやcookieは引き継ぐ.
            header = resHeader.toHeaders();
            cookies = resHeader.toCookies()
        }
        // リダイレクトURLをセット.
        header["location"] = url;
        // リダイレクト返信.
        return returnResponse(
            resState.getStatus(),
            header,
            cookies,
            null, true);
    // レスポンスBodyが存在しない場合.
    } else if(resBody == undefined || resBody == null) {
        // 0文字でレスポンス返却.
        return returnResponse(
            resState.getStatus(),
            resHeader.toHeaders(),
            resHeader.toCookies(),
            null, true);
    }
    // contet-typeが設定されてなくて、返却結果が文字列の場合.
    if(resHeader.get("content-type") == undefined && typeof(body) == "string") {
        // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
        resHeader.put("content-type", getMimeType("html").type);
    }

    // レスポンス返却.
    return returnResponse(
        resState.getStatus(),
        resHeader.toHeaders(),
        resHeader.toCookies(),
        resBody);
}

// リクエスト情報を生成.
// event 対象のイベントを設定します.
// 戻り値: リクエスト情報(object)が返却されます.
const createRequest = function(event) {
    // pathを取得.
    const path = convertHttpPath(event.rawPath);
    // 拡張子を取得.
    const extension = getPathToExtends(path);

    // 拡張子に対するResourceModelを設定.
    responseModel(extension);

    // リクエスト情報.
    return {
        // httpメソッド.
        method: event.requestContext.http.method.toUpperCase()
        /// httpプロトコル(HTTP/1.1).
        ,protocol: event.requestContext.http.protocol
        // EndPoint(string)パス.
        ,path: path
        // リクエストヘッダ(httpHeaderオブジェクト(put, get, getKeys, toHeaders)).
        ,header: httpHeader.create(event.headers, event.cookies)
        // urlパラメータ(Object).
        ,queryParams: getQueryParams(event)
        // rawUrlパラメータ(string).
        ,rawQueryString: event.rawQueryString
        // EndPoint(string)パスに対するファイルの拡張子.
        // undefinedの場合、js実行結果を返却させる.
        ,extension: extension
        // 拡張子mimeType変換用.
        ,mimeType: getMimeType
        // 元のeventをセット.
        ,srcEvent: event
    };
}

// [Form]パラメータ解析.
// n フォームパラメータを設定します.
// 戻り値: フォームパラメータ解析結果が返却されます.
const analysisFormParams = function(n) {
    const list = n.split("&");
    const len = list.length;
    const ret = {};
    for (var i = 0; i < len; i++) {
        n = list[i].split("=");
        n[0] = decodeURIComponent(n[0]);
        if (n.length == 1) {
            ret[n[0]] = "";
        } else {
            ret[n[0]] = decodeURIComponent(n[1]);
        }
    }
    return ret;
}

// リクエストパラメータを設定.
// event 対象のeventを設定します.
// request 対象のリクエスト情報を設定します.
var setRequestParameter = function(event, request) {
    //////////////////////////////////////////////////////////
    // 基本 postの場合、関数URLだと base64のバイナリで受信される.
    //////////////////////////////////////////////////////////

    // request.methodが `GET` の場合.
    if(request.method == "GET") {
        // 空をセット.
        request.body = undefined;
        request.isBinary = false;
        // パラメータにurlパラメータをセット.
        request.params = request.queryParams;
    // bodyが存在する場合(POST).
    } else {
        let body, isBinary;
        // Base64で設定されている場合.
        if(event.isBase64Encoded == true) {
            // Base64からバイナリ変換してバイナリとしてセット.
            body = Buffer.from(event.body, 'base64');
            isBinary = true;
        } else {
            // 文字列としてセット.
            body = event.body;
            isBinary = false;
        }
        // リクエストのコンテンツタイプを取得.
        const contentType = request.header.get(
            "content-type");
        // フォーム形式の場合.
        if(contentType == mime.FORM_DATA) {
            if(isBinary) {
                body = body.toString();
            }
            // フォームパラメータ解析.
            request.params = analysisFormParams(body);
            request.body = undefined;
            request.isBinary = false;
        // JSON形式の場合.
        } else if(contentType == mime.JSON) {
            if(isBinary) {
                body = body.toString();
            }
            // JSON解析.
            request.params = JSON.parse(body);
            request.body = undefined;
            request.isBinary = false;
        // 文字設定の場合.
        } else if(!isBinary) {
            // フォームパラメータ解析.
            request.params = analysisFormParams(body);
            request.body = undefined;
            request.isBinary = false;
        // それ以外の場合.
        } else {
            // そのまま設定.
            request.params = {};
            request.body = body;
            request.isBinary = isBinary;
        }
    }
    // event.bodyを削除.
    event.body = undefined;
    event.isBase64Encoded = false;
}

// 不正な拡張子一覧.
const BAD_EXTENSION = [
    ".js.html"
    ,".lfu.js"
];

// LFU側のpublic定義の場合.
const LFU_PUBLIC = "/@public/" 

// [Main]ハンドラー実行.
// lambda-func-url に対する実行処理(HTTP or HTTPS)が行われるので、
// ここでハンドラー実行処理を行う必要がある.
// event aws lambda `index.js` のmainメソッド
//       exports.handler(event)の条件が設定されます.
const main_handler = async function(event) {
    // レスポンスステータス.
    const resState = httpStatus.create();
    
    // レスポンスヘッダ.
    let resHeader = httpHeader.create();

    // リクエストオブジェクト.
    let request = null;

    try {
        // リクエストを生成.
        request = createRequest(event);

        // globalにgetRequestを登録.
        global.getRequest = function() {
            // リクエストを返却.
            return request;
        }

        // リクエストパラメータを設定.
        setRequestParameter(event, request);

        // filterFunctionが未設定の場合.
        if(_filterFunction == undefined) {
            // 環境変数で定義されている場合はそれをロード.
            const path = process.env[_ENV_FILTER_FUNCTION];
            if(typeof(path) == "string") {
                // データーロード.
                const res = await exrequire(path, true, "");
                setFilterFunction(res);
            }
        }

        //////////////////////////////////////////
        // filterFunctionが設定されてる場合呼び出す.
        //////////////////////////////////////////
        if(_filterFunction != undefined) {
            // filterFunc.
            // function(out, resState, resHeader, request);
            //  out [0]にレスポンスBodyが設定されます.
            //  resState: レスポンスステータス(httpStatus.js).
            //  resHeader レスポンスヘッダ(httpHeader.js)
            //  request Httpリクエスト情報.
            //  戻り値: true / false.
            //         trueの場合filter処理で処理終了となります.
            const outResBody = [undefined];
            const result = await _filterFunction(
                outResBody, resState, resHeader, request);

            // 戻り値が trueの場合、フィルター実行で完了.
            if(result == true) {
                // レスポンス出力.
                return resultJsOut(resState, resHeader, outResBody[0]);
            }
        }

        /////////////////////////////////////////////////
        // 呼び出し対象がコンテンツ実行(拡張子が存在)の場合.
        // 逆に言えばjs実行ではない場合.
        /////////////////////////////////////////////////
        if(request.extension != undefined) {
            // 不正な拡張子をチェック.
            {
                const path = request.path.toLowerCase();
                const len = BAD_EXTENSION.length;
                for(let i = 0; i < len; i ++) {
                    if(path.endsWith(BAD_EXTENSION[i])) {
                        // エラー404.
                        throw httpStatus.httpError(
                            404, "The specified path cannot be read.")
                    }
                }
            }
            // 配置されているコンテンツのバイナリを返却する.
            let resBody = undefined;

            // path の先頭パスが /@public の場合. 
            if(request.path.startsWith(LFU_PUBLIC)) {
                // LFU内の /@public 以下のリソースを返却する.
                resBody = fcontents("./" + request.path.substring(1).trim());

                // mimeTypeを取得.
                const resMimeType = getMimeType(request.extension);

                // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
                resHeader.put("content-type", resMimeType.type);

                // 圧縮対象の場合.
                // または環境変数で、圧縮なし指定でない場合.
                if(resMimeType.gz == true && global.ENV.noneGzip != true) {
                    // 圧縮処理を行う.
                    resBody = await mime.compressToContents(
                        request.header, resHeader, resBody);
                }

                // レスポンス返却.
                return returnResponse(
                    200,
                    resHeader.toHeaders(),
                    resHeader.toCookies(),
                    resBody);
            }

            ///////////////////////////////
            // jhtmlのテンプレート実行を行う.
            ///////////////////////////////
            if(request.extension == "jhtml") {
                // jhtmlの実際のコンテンツ名を作成.
                // 拡張子は `.js.html`
                // .jhtml から .js.html に置き換えてアクセス.
                const name = request.path.substring(
                    0, request.path.length - 6) + ".js.html";
                
                // jhtml内容を取得.
                resBody = await _requestFunction(false, name);
                // 取得内容(binary)を文字変換.
                resBody = Buffer.from(resBody).toString();

                // jhtmlライブラリを取得.
                const jhtml = frequire("./jhtml.js");

                // jhtmlをjs変換.
                resBody = jhtml.convertJhtmlToJs(resBody);
                // jhtmlを実行.
                resBody = await jhtml.executeJhtml(
                    name, resBody, request, resState, resHeader);

                // 環境変数で、圧縮なし指定でない場合.
                if(global.ENV.noneGzip != true) {
                    // 圧縮処理を行う.
                    resBody = await mime.compressToContents(
                        request.header, resHeader, resBody);
                }

                // レスポンス出力.
                return resultJsOut(resState, resHeader, resBody);
            }

            //////////////////////////
            // コンテンツファイルを取得.
            //////////////////////////

            // 対象パスのコンテンツ情報を取得.
            let response = {};
            resBody = await _requestFunction(false, request.path, response);

            // mimeTypeを取得.
            const resMimeType = getMimeType(request.extension);

            // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
            resHeader.put("content-type", resMimeType.type);

            // レスポンスヘッダからetagを取得.
            const etag = response.header.get("etag");
            if(typeof(etag) == "string") {
                // etagをセット.
                resHeader.put("etag", etag);
                resHeader.put("expires", "-1");
                // キャッシュされているかチェック.
                if(request.header.get("if-none-match") == etag) {
                    // レスポンス返却.
                    return returnResponse(
                        304,
                        resHeader.toHeaders(),
                        resHeader.toCookies(),
                        null, true);
                }
            }

            // 圧縮対象の場合.
            // または環境変数で、圧縮なし指定でない場合.
            if(resMimeType.gz == true && global.ENV.noneGzip != true) {
                // 圧縮処理を行う.
                resBody = await mime.compressToContents(
                    request.header, resHeader, resBody);
            }

            // レスポンス返却.
            return returnResponse(
                200,
                resHeader.toHeaders(),
                resHeader.toCookies(),
                resBody);
        }

        ////////////////////////////
        // externalなfunctionを実行.
        ////////////////////////////
        {
            // 対象Javascriptを取得.
            // 拡張子は `.lfu.js`
            let func = await _requestFunction(
                true, request.path + ".lfu.js");
            // 実行メソッド(handler)を取得.
            if(typeof(func["handler"]) == "function") {
                func = func["handler"];
            // handler実行メソッドが存在しない場合別の実行メソッド名(execute)で取得.
            } else if(typeof(func["execute"]) == "function") {
                func = func["execute"];
            // それ以外の場合エラー.
            } else {
                throw new Error(
                    "The execution method does not exist in the specified path: \"" +
                    request.path + ".lfu.js\" condition.")
            }

            // js実行.
            let resBody = await func(resState, resHeader, request);

            // レスポンス出力.
            return resultJsOut(resState, resHeader, resBody);
        }

    } catch(err) {
        let status, message, resBody;
        // 返却Body初期化.
        resBody = null;
        // resHeaderを初期化.
        resHeader = httpHeader.create();
        // httpErrorの場合.
        if(err instanceof HttpError) {
            // ステータスとメッセージを取得.
            status = err.getStatus();
            message = err.getMessage();
        // 通常エラーの場合.
        } else {
            // エラーオブジェクトにHTTPステータスが付与されているかチェック.
            status = err.status;
            message = err.message;
            if(status == undefined) {
                // 設定されていない場合はエラー500.
                status = 500;
            }
            // エラーメッセージが設定されていない場合.
            if(message == undefined) {
                message = "" + err;
            }
        }

        // favicon.ico直下の場合はエラー表示させない.
        if(request.path != "/favicon.ico") {
            // エラーログ出力.
            console.error("## error(" + status + "): " + message);
            // error500以上の場合は詳細出力.
            if(status >= 500) {
                console.error(err);
            }
        }

        // httpErrorの場合.
        if(err instanceof HttpError) {
            // statusをセット
            resState.setStatus(status);
            // httpErrorレスポンスBodyを取得.
            resBody = await err.toResponse(
                resState,
                resHeader
            );

        // httpError以外のエラーの場合.
        // request情報が存在する場合.
        } else if(request != undefined && request != null) {
            // 拡張子からResourceModelを取得.
            const model = responseModel(request.extension);
            // statusをセット
            resState.setStatus(status);
            // modelがjsの場合.
            if(model == "js") {
                resBody = defaultJsonError(
                    resState,
                    resHeader,
                    message
                );
            // modelがjhtmlの場合.
            } else if(model == "jhtml") {
                resBody = defaultHttpError(
                    resState,
                    resHeader,
                    message
                );
            }
        }

        // modelが不明な場合.
        if(resBody == null) {
            // text形式で最小エラー情報返却用Bodyを作成.
            resBody = "error " + status + ": " + httpStatus.toMessage(status);
            // レスポンス返却のHTTPヘッダに対象拡張子MimeTypeをセット.
            resHeader.put("content-type", getMimeType("text").type);
        }
        // レスポンス返却.
        return returnResponse(
            status,
            resHeader.toHeaders(),
            [], // エラーなのでcookie返却なし
            resBody);
    }
}

// lambda-func-url初期処理.
// event index.jsで渡されるeventを設定します.
const start = function(event) {
    const rawPath = event.rawPath;
    // lfu専用コマンドパス定義の場合.
    if(rawPath.startsWith("/~")) {
        // 応答確認及びrequire関連のキャッシュクリア.
        if(rawPath == "/~ping" ||
            rawPath == "/~clearRequireCache") {
            // キャッシュクリア.
            if(rawPath == "/~clearRequireCache") {
                clearRequireCache();
            }
            // ping用function返却.
            return async function() {
                // レスポンス出力.
                return returnResponse(
                    200, // status.
                    {}, // headers.
                    [], // cookies.
                    // body.
                    {result: "ok"}
                );
            }
        }
    }

    //////////////////////////////////////////
    // 環境変数を取得して、それぞれを初期化する.
    //////////////////////////////////////////

    // 環境変数を取得.
    // すでに存在する場合は、その内容を取得する.
    let env = global.ENV;
    if(env == undefined) {
        // 読み込まれてない場合は取得.
        env = getLFUEnv();
        global.ENV = env;
    }

    // loConnectが存在する.
    // loConnectの規定パスが設定されている.
    if(env.loConnect != undefined) {
        const loreqreg = require("./loreqreg.js");
        loreqreg.setCurrentPath(env.loConnect);
    }

    // s3接続定義が存在する場合.
    // s3Connectが存在しない場合は `s3require` は使えない.
    if(env.s3Connect != undefined) {
        // s3reqreg.
        const s3reqreg = require("./s3reqreg.js");

        // 基本設定.
        if(!s3reqreg.isOptions()) {
            s3reqreg.setOption({
                currentPath: env.s3Connect.requirePath,
                region: env.s3Connect.region,
                timeout: env.cacheTimeout,
                nonCache: env.noneCache
            });
        }
    }

    // git接続定義が存在する場合.
    // gitConnectが存在しない場合は `grequire` は使えない.
    if(env.gitConnect != undefined) {
        // greqreg.
        const greqreg = require("./greqreg.js");

        // 標準接続先のgithub repogitory設定.
        if(!greqreg.isDefault()) {
            greqreg.setDefault(
                env.gitConnect.organization,
                env.gitConnect.repo,
                env.gitConnect.branch
            );
        }
        // オプション設定.
        if(!greqreg.isOptions()) {
            greqreg.setOptions({
                currentPath: env.gitConnect.requirePath,
                timeout: env.cacheTimeout,
                nonCache: env.noneCache
            });
        }
        
        // 対象gitHubのprivateアクセス用トークン(埋め込み暗号化)が存在する場合.
        // 既に登録済みの場合は処理しない.
        if(env.gitConnectToken != undefined &&
            !greqreg.isOrganizationToken()) {
            // secretManagerを取得.
            const scm = require("./lib/secretsManager.js");
            // /{organization}/{repo}/{branch}/{requirePath}
            // この条件を設定して埋め込みコードを解析する.
            const token = scm.getEmbed(
                "/" + env.gitConnect.organization +
                "/" + env.gitConnect.repo +
                "/" + env.gitConnect.branch +
                "/" + env.gitConnect.requirePath,
                env.gitConnectToken
            );
            // tokenの登録.
            greqreg.setOrganizationToken(
                env.gitConnect.organization,
                token
            );
        }
    }

    // favicon.icoが呼び出し対象の場合.
    if(rawPath.endsWith("/favicon.ico")) {
        // defaultのfavicon.icoが設定されている場合.  
        if(rawPath == "/favicon.ico" ||
            rawPath == "/default/favicon.ico") {
            // defaultのfavicon.icoを取得.
            return async function() {
                try {
                    // lambda設定直下のfavicon.icoを取得.
                    const res = fcontents("./favicon.ico");
                    // レスポンスヘッダ.
                    const resHeader = httpHeader.create();
                    resHeader.put("content-type", getMimeType("ico").type);
                    // レスポンス出力.
                    return returnResponse(
                        200, // status.
                        resHeader.toHeaders(), // headers.
                        [], // cookies.
                        // body.
                        res
                    );
                } catch(e) {
                    console.log(e)
                    // 404レスポンス出力.
                    return returnResponse(
                        404, /// status.
                        {}, // headers.
                        [], // cookies.
                        // body.
                        null
                    );
                }
            }
        }
        // ユーザが登録しているfavicon.ico を返却.
        return async function() {
            try {
                // requestFunction呼び出し処理のFunction登録.
                regRequestRequireFunc(env);
                // 指定パスのfavicon.icoを取得.
                const res = await excontents(rawPath, env.requestPath);
                // レスポンスヘッダ.
                const resHeader = httpHeader.create();
                resHeader.put("content-type", getMimeType("ico").type);
                // レスポンス出力.
                return returnResponse(
                    200, // status.
                    resHeader.toHeaders(), // headers.
                    [], // cookies.
                    // body.
                    res
                );
            } catch(e) {
                console.log(e)
                // 404レスポンス出力.
                return returnResponse(
                    404, /// status.
                    {}, // headers.
                    [], // cookies.
                    // body.
                    null
                );
            }
        }
    }

    // requestFunction呼び出し処理のFunction登録.
    regRequestRequireFunc(env);

    // main_handlerを返却.
    return main_handler;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.start = start;

})();
