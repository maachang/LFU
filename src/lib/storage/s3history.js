///////////////////////////////////////////////////////////////////////
// s3に対して履歴情報を出力します.
// prefixの構成としては
// + {category}
//    |
//    +- {yyyyMMdd}
//         |
//         +- {yyyyMMddHHmmssSSS}_{NanoTime}_[{title}].{extension}
// 
// このような形式でS3に出力されます.
// 中身については、特に暗号化とかされないので、センシティブな情報の出力は
// 控えてください.
///////////////////////////////////////////////////////////////////////
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

// s3client.
const s3 = frequire("./lib/s3client.js");

// utcDate.
const utcDate = frequire("./lib/utcDate.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]メインS3Kvs-Prefix.
const ENV_MAIN_S3_HISTORY_PREFIX = "MAIN_S3_HISTORY_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "s3History";

// list取得での１度での最大リスト数.
const MAX_LIST = 100;

// nanoTimeを取得.
const getNanoTime = function() {
    const ret = process.hrtime()
    return parseInt((ret[0] * 10000000000) + ret[1]);
}

// /xxx/ みたいな定義を xxx に変換する.
const cutStartEndSlash = function(name) {
    if(name.startsWith("/")) {
        name = name.substring(1).trim();
    }
    if(name.startsWith("/")) {
        name = name.substring(
            0, name.length - 1).trim();
    }
    return name;
}

// history用のprefix + category + key名を生成.
const createHistoryPrefixKey = function(
    prefix, category, title, extension) {
    const date = utcDate.create();
    category = cutStartEndSlash(category);
    let ret = prefix + "/" + category + "/" +
        date.toString("month", true) + "/" +
        date.toString("date", true) + "/" +
        date.toString(null, true) + "_" +
        getNanoTime() + "_[" + title + "]";
    if(typeof(extension) == "string" && extension.length > 0) {
        ret += "." + extension;
    }
    return ret;
}

// history用のprefix + category + keyを取得.
const getHistoryPrefixKey = function(prefix, category, key) {
    const date = new Date();
    category = cutStartEndSlash(category);
    if(key.startsWith("/")) {
        key = key.substring(1);
    }
    return prefix + "/" + category + "/" + key;
}

// オブジェクト生成処理.
// options {bucket: string, prefix: string, region: string}
//   - bucket 対象のS3バケット名を設定します.
//     未設定(undefined)の場合、環境変数 "MAIN_S3_BUCKET" 
//     で設定されてるバケット名が設定されます.
//   - prefix 対象のプレフィックス名を設定します.
//     未設定(undefined)の場合、prefixは""(空)となります.
//   - region 対象のリージョンを設定します.
//     未設定(undefined)の場合東京リージョン(ap-northeast-1)
//     が設定されます.
//   - credential AWSクレデンシャルを設定します.
//     {accessKey: string, secretAccessKey: string,
//       sessionToken: string}
//      - accessKey アクセスキーが返却されます.
//      - secretAccessKey シークレットアクセスキーが返却されます.
//      - sessionToken セッショントークンが返却されます.
//                  状況によっては空の場合があります.
//   - extension ファイル拡張子を設定します.
//      設定しない場合は "json" が割り当てられます.
const create = function(options) {
    // 基本バケット名.
    let bucketName = null;

    // 基本プレフィックス名.
    let prefixName = null;

    // リージョン名.
    let regionName = null;

    // クレデンシャル.
    let credential = null;

    // 拡張子.
    let extension = null;

    // optionsが設定されていない場合.
    if(options == undefined || options == null) {
        options = {};
    }

    // bucket名が設定されていない.
    if(typeof(options.bucket) != "string") {
        // バケットから空セット.
        // 環境変数から取得.
        options.bucket = process.env[ENV_MAIN_S3_BUCKET];
        if(options.bucket == null || options.bucket == undefined ||
            options.bucket.length == 0) {
            throw new Error("[ENV: " +
                ENV_MAIN_S3_BUCKET + "]Bucket name is empty.");
        }
    } else {
        // bucket名の整形.
        let flg = false;
        options.bucket = options.bucket.trim();
        // s3:// などの条件が先頭に存在する場合.
        let p = options.bucket.indexOf("://");
        if(p != -1) {
            // 除外.
            options.bucket = bucket.substring(p + 3);
            flg = true;
        }
        // 終端の / が存在する場合.
        if(options.bucket.endsWith("/")) {
            // 除外.
            options.bucket = options.bucket.substring(0, bucket.length - 1);
            flg = true;
        }
        // 除外があった場合trimをかける.
        if(flg) {
            options.bucket = bucket.trim();
        }
    }

    // prefixの整形.
    if(typeof(options.prefix) != "string") {
        // 環境変数から取得.
        options.prefix = process.env[ENV_MAIN_S3_HISTORY_PREFIX];
        if(options.prefix == null || options.prefix == undefined ||
            options.prefix.length == 0) {
            // 設定されていない場合.
            options.prefix = undefined;
        }
    }
    // prefixが存在する場合.
    if(typeof(options.prefix) == "string") {
        options.prefix = options.prefix.trim();
        if(options.prefix.startsWith("/")) {
            if(options.prefix.endsWith("/")) {
                options.prefix = options.prefix.substring(
                    1, options.prefix.length - 1).trim();
            } else {
                options.prefix = options.prefix.substring(1).trim();
            }
        } else if(options.prefix.endsWith("/")) {
            options.prefix = options.prefix.substring(
                0, options.prefix.length - 1).trim();
        }
    }

    // extensionが存在しない場合.
    if(typeof(options.extension) != "string") {
        options.extension = "json";
    } else if(options.extension.length == 0) {
        options.extension = "json";
    }

    // メンバー変数条件セット.
    bucketName = options.bucket;
    prefixName = options.prefix == undefined ?
        DEFAULT_PREFIX : options.prefix;
    regionName = options.region;
    credential = options.credential;
    extension = options.extension;
    options = undefined;

    // put処理.
    // category 対象のカテゴリ名を設定します.
    // title 履歴情報が分かるタイトルを設定します.
    // value 履歴に残す情報を設定します.
    // 戻り値: trueの場合は書き込み成功です.
    const put = async function(category, title, value) {
        if(value == undefined || value == null) {
            throw new Error("value argument not set.");
        }
        const response = {};
        await s3.putObject(
            response, regionName, bucketName, 
            createHistoryPrefixKey(
                prefixName, category, title, extension),
            value, credential);
        return response.status <= 299;
    }

    // get処理.
    // category 対象のカテゴリ名を設定します.
    // key {yyyMMdd}/{yyyyMMddHHmmssSSS}_{NanoTime}_[{title}].{extension}
    //     を設定します.
    // 戻り値: 正常に取得出来た場合文字列が返却されます.
    //        取得失敗の場合 null が返却されます.
    const get = async function(category, key) {
        if(key == undefined || key == null) {
            throw new Error("key argument not set.");
        }
        const response = {};
        const bin = await s3.getObject(
            response, regionName, pm.Bucket,
            getHistoryPrefixKey(prefixName, category, key),
            credential);
        return response.status >= 400 ?
            null: bin.toString();
    }

    // 指定テーブルのリスト一覧を取得.
    // category 対象のカテゴリ名を設定します.
    // options 以下の内容が設定されます.
    //   month 対象月を設定します.
    //   date 対象日を設定します.
    //   max １ページの最大表示数を設定.
    //       100件を超える設定はできません.
    //   marker 読み取り開始位置のマーカーを設定します.
    // 戻り値: {marker, list}
    //         marker: 次のページに遷移するMarkerが設定されます.
    //                 nullの場合、次のページは存在しません.
    //         list: [string, string, ... ]
    //              パス情報が返却されます.
    const list = async function(category, options) {
        let max = options.max|0;
        if(max <= 10) {
            max = 10;
        } else if(max > MAX_LIST) {
            max = MAX_LIST;
        }
        const marker = typeof(options.marker) == "string" ?
            options.marker : undefined;
        let month = options.month == undefined || options.month == null ?
            undefined : options.month;
        let date = options.date == undefined || options.date == null ?
            undefined : options.date;
        // prefix.
        let prefix = prefixName + "/" + cutStartEndSlash(category);
        // monthが存在する場合.
        if(month != undefined) {
            // monthのprefixをセット.
            const monthDate = utcDate.create(month).clear("date");
            prefix += "/" + monthDate.toString("month", true);
        } else if(date != undefined) {
            // month, dateのprefixをセット.
            const dateDate = utcDate.create(date);
            prefix += "/" + dateDate.toString("month", true) +
                "/" + dateDate.toString("date", true);
        }
        // response.
        const response = {};
        let nextMarker = null;
        // 対象のリストを取得.
        ret = await s3.listObject(
            response, regionName, prefixName, prefix,
            {maxKeys: max, keyOnly: true, marker: marker},
            credential);
        // NextMarkerが存在しない場合.
        if(response.header[s3.NEXT_MARKER_NAME] != "true") {
            nextMarker = null;
        // 次のNextMarkerが存在する場合.
        } else {
            nextMarker = ret[ret.length - 1];
        }
        return {
            nextMarker: nextMarker,
            list: ret
        };
    }

    // category名を設定してs3historyを扱う.
    const currentCategory = function(category) {
        category = cutStartEndSlash(category);
        return {
            put: function(title, value) {
                return put(category, title, value);
            },
            get: function(key) {
                return get(category, key);
            },
            list: function(options) {
                return list(category, options);
            }
        };
    }

    // 利用可能メソッドをセット.
    return {
        put: put,
        get: get,
        list: list,
        currentCategory: currentCategory
    }
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
