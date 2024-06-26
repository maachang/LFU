///////////////////////////////////////////////////////////////////////
// S3のKeyValueStorage構造を利用したKeyValue情報管理を行います.
// AWSのS3は、基本的にKeyValue形式です.
// 
// AWSのS3の容量単価は、1TByteで月25$(東京リージョン)と非常に安い.
// ただS3の1blockが128kbyte単位なので、1byteであっても最低128kbyteとなる.
// しかし1TByteで月25$なので、128kbyteの1オブジェクトは 月$0.0000025 と
// 非常に安価だ(たとえば10万データ=$0.25=1USD:140円で月額約35円)
// s3のI/O料金はGET=($0.0037/10,000req) それ以外=($0.0047/1,000req)
//
// 一方でRDSを使った場合最低(mysql, t3-micro, 20Gbyteの１台で月額約3000円
// ちょい)とバージョンアップ等のメンテナンス費用やレプリケーション等、
// 非常に高くついてしまう.
//
// ある程度使いやすいS3を使ったKeyValue形式のものを作成する事で、非常に
// 安価なデータ管理が行える仕組みが作れる可能性がある.
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

// s3client.
const s3 = frequire("./lib/s3client.js");

// convb.
const convb = frequire("./lib/storage/convb.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]メインS3Kvs-Prefix.
const ENV_MAIN_S3_KVS_PREFIX = "MAIN_S3_KVS_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "s3kvs";

// list取得での１度での最大リスト数.
const MAX_LIST = 100;

// key, valueインデックスに対するvalue文字列最大値.
const MAX_INDEX_VALUE_LENGTH = 64;

// S3KVS拡張子.
const S3KVS_EXTENSION = ".s3kvs";

// S3KVS拡張子長.
const S3KVS_EXTENSION_LENGTH = S3KVS_EXTENSION.length;

// jsonbエンコード.
const jsonbEncode = function(value) {
    const bin = [];
    convb.encodeValue(bin, value);
    return Buffer.from(bin);
}

// jsonbデコード.
const jsonbDecode = function(bin) {
    const pos = [0];
    return convb.decodeValue(pos, bin);
}

// base64の最後の=を削除.
const cutBase64ToLastEq = function(value) {
    value = Buffer.from(value).toString('base64');
    const len = value.length;
    // base64の最後の`=`を除外.
    for(var i = len - 1; i >= 0; i --) {
        if(value[i] != "=") {
            value = value.substring(0, i + 1);
            break;
        }
    }
    return value;
}

// インデックスである `~base64(Key)~base64(value)` の条件を取得.
// key 対象のkeyを設定.
// value value条件を設定します.
// 戻り値: `~base64(Key)~_[N]base64(value)`が返却されます.
const encodeKeyValue = function(key, value) {
    // valueが存在しない場合.
    if(value == null || value == undefined) {
        value = "";
    // value情報が存在する場合.
    } else {
        const t = typeof(value);
        // boolean型.
        if(t == "boolean") {
            value = "_b" +
                (value == true ? "T" : "f");
        } else if(t == "number") {
            const b = [];
            if(convb.isFloat(value)) {
                // 浮動小数点変換.
                convb.encodeFloat(b, value);
                value = "_f";
            } else {
                // 整数変換.
                convb.encodeLong(b, value);
                value = "_n";
            }
            // binaryをbase64変換.
            value += cutBase64ToLastEq(b);
        // 日付型の場合.
        } else if(value instanceof Date) {
            const b = [];
            // 整数変換.
            convb.encodeLong(b, value.getTime());
            // binaryをbase64変換.
            value = "_d" + cutBase64ToLastEq(b);
        // その他.
        } else {
            // 文字列として扱う.
            value = "" + value;
            if(value.length >= MAX_INDEX_VALUE_LENGTH) {
                throw new Error(
                    "The string length of index value" +
                    " exceeds the maximum value (" +
                    MAX_INDEX_VALUE_LENGTH + ").")
            }
            // 文字列の場合_[N]はセットしない.
            value = cutBase64ToLastEq(value);
        }
    }
    // ~base64(Key)~base64(value)
    return "~" +
        cutBase64ToLastEq("" + key) +
        "~" +
        value;
}

// "~base64(Key)~base64(value)" を {key: value}変換する.
// keyValue 対象のkeyValue(string)を設定します.
// 戻り値: {key: value}が返却されます.
const decodeKeyValue = function(keyValue) {
    // s3kvs拡張子が設定されている場合.
    if(keyValue.endsWith(S3KVS_EXTENSION)) {
        keyValue = keyValue.substring(
            0, keyValue.length -
                S3KVS_EXTENSION_LENGTH);
    }
    // 単一のKeyを取得.
    keyValue = keyValue.split("~");

    // valueを解析.
    let value = keyValue[2];
    if(value.length > 0) {
        // 型定義が存在する場合.
        if(value.startsWith("_")) {
            const type = value.substring(0, 2);
            value = value.substring(2);
            if(type == "_b") {
                // boolean T=true, f=false.
                value = value == "T";
            } else {
                // ポジション.
                const p = [0];
                // base64を解析.
                value = Buffer.from(value ,'base64');
                if(type == "_f") {
                    // 浮動小数点.
                    value = convb.decodeFloat(p, value);
                } else if(type == "_n") {
                    // 整数.
                    value = convb.decodeLong(p, value);
                } else if(type == "_d") {
                    // Dateオブジェクト.
                    value = new Date(
                        convb.decodeLong(p, value));
                } else {
                    throw new Error(
                        "Unknown type condition: " + type);
                }
            }
        } else {
            // 文字列の場合.
            value = Buffer.from(value ,'base64')
                .toString()
        }
    }
    return {
        key: Buffer.from(keyValue[1], 'base64')
            .toString(),
        value: value
    }
}

// decodeKeyValue でリスト変換.
// list s3client.listObjectsでの取得結果をセット.
// 戻り値: [{key: value} ... ] が返却される.
const decodeKeyValueList = function(list) {
    let p;
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        p = list[i].lastIndexOf("/");
        if(p == -1) {
            throw new Error(
                "Invalid path condition: " +
                list[i]);
        }
        list[i] = decodeKeyValue(
            list[i].substring(p + 1));
    }
    return list;
}

// S3パラメータを作成.
// bucketName s3バケット名を設定します.
// prefixName s3プレフィックス名を設定します.
// tableName 対象のテーブル名を設定します.
// index 対象のindex群 {key: value .... } を設定します.
//        この条件はキーソートされてprefix and keyの文字列化
//        されます.
// 戻り値: S3パラメータが返却されます.
const getS3Params = function(
    bucketName, prefixName, tableName, index) {
    // パスを取得.
    // 基本prefixが存在しない.
    let keyIndex = null;
    if(prefixName == undefined || prefixName == null) {
        keyIndex = tableName;
    // 基本prefixが存在する.
    } else {
        keyIndex = prefixName + "/" + tableName;
    }
    // index条件を文字列化.
    if(index != undefined && index != null) {
        let count = 0;
        let list = [];
        for(let k in index) {
            list[count ++] = encodeKeyValue(
                k, index[k]);
        }
        // index = zeroの場合はエラー.
        if(count == 0) {
            throw new Error("No index key is set");
        }
        // インデックスソートしてパスに追加.
        list.sort();
        let len = list.length;
        for(let i = 0; i < len; i ++) {
            keyIndex += "/" + list[i];
        }
        list = null;
    }
    // BucketとKeyを登録.
    return {Bucket: bucketName, Key: keyIndex};
}

// テーブルアクセスのパラメーターを取得.
// valueCount 0以上の場合、valuesパラメータ群設定されます.
// args パラメータを設定します.
//   args = [tableName, key, value, key, value, ....]
//   条件に従い、テーブルアクセスパラメータを分析して返却します.
// 戻り値: {tableName: string, index: object, value: object}
//   tableName テーブル名が設定されます.
//   index {key, value ... } が設定されます.
//   value [values, values, ... ]が設定されます.
const tableAccessParams = function(valueCount, args) {
    let i, off, end;
    let tableName = null;
    let index = null;
    let value = null;
    end = args.length;

    // 引数が存在しない場合.
    if(end == 0) {
        throw new Error("argument does not exist")
    }

    // value情報.
    valueCount = valueCount|0;

    // テーブル名.
    tableName = args[0];

    // valueCountが存在する場合.
    if(valueCount > 0) {
        end -= valueCount;
        value = [];
        for(i = 0; i < valueCount; i ++) {
            value[i] = args[end + i];
        }
    }

    // indexを設定.
    off = 1;
    if(end - off > 0) {
        const len = end - off;
        // 2の倍数でない場合.
        if((len & 0x01) != 0) {
            throw new Error(
                "{key: value} definition of path is not even set: " + 
                len);
        }
        index = {};
        for(i = 0; i < len; i += 2) {
            index[args[off + i]] = args[off + i + 1];
        }
    }

    // 解析結果を返却.
    return {
        tableName: tableName,
        index: index,
        value: value
    }
}

// 2つの指定パラメータを１つのパラメータにマージする.
// topParams TOPで指定するパラメータをArrayで設定します.
// params 連結するパラメータをArrayで設定します.
// 戻り値: ２つが連結したArrayが返却されます.
const _appendParams = function(topParams, params) {
    const topLen = topParams.length;
    const ret = [];
    let i, cnt = 0;
    for(i = 0; i < topLen; i ++) {
        ret[cnt ++] = topParams[i];
    }
    const paramsLen = params.length;
    for(i = 0; i < paramsLen; i ++) {
        ret[cnt ++] = params[i];
    }
    return ret;
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
const create = function(options) {
    // 基本バケット名.
    let bucketName = null;

    // 基本プレフィックス名.
    let prefixName = null;

    // リージョン名.
    let regionName = null;

    // クレデンシャル.
    let credential = null;

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
        options.prefix = process.env[ENV_MAIN_S3_KVS_PREFIX];
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

    // メンバー変数条件セット.
    bucketName = options.bucket;
    prefixName = options.prefix == undefined ?
        DEFAULT_PREFIX : options.prefix;
    regionName = options.region;
    credential = options.credential;
    options = undefined;

    // put.
    // tableName 対象のテーブル名を設定します.
    // index key, value ... を設定します. 
    // value valueを設定します.
    // 戻り値: trueの場合設定に成功しました.
    const put = async function() {
        // 0value, keyありで取得.
        let ap = tableAccessParams(1, arguments);
        const pm = getS3Params(
            bucketName, prefixName, ap.tableName, ap.index);
        const value = jsonbEncode(ap.value[0]);
        ap = null;
        const response = {};
        await s3.putObject(
            response, regionName, pm.Bucket, 
            pm.Key + S3KVS_EXTENSION, value,
            credential);
        return response.status <= 299;
    }

    // get.
    // tableName 対象のテーブル名を設定します.
    // index key, value ... を設定します. 
    // 戻り値: 検索結果(json)が返却されます.
    //         情報取得に失敗した場合は null が返却されます.
    const get = async function() {
        // 0value, keyありで取得.
        let ap = tableAccessParams(0, arguments);
        const pm = getS3Params(
            bucketName, prefixName, ap.tableName, ap.index);
        ap = null;
        const response = {};
        const bin = await s3.getObject(
            response, regionName, pm.Bucket,
            pm.Key + S3KVS_EXTENSION,
            credential);
        return response.status >= 400 ?
            null: jsonbDecode(bin);
    }

    // remove.
    // tableName 対象のテーブル名を設定します.
    // index key, value ... を設定します. 
    // 戻り値: trueの場合削除に成功しました.
    const remove = async function() {
        // 0value, keyありで取得.
        let ap = tableAccessParams(0, arguments);
        const pm = getS3Params(
            bucketName, prefixName, ap.tableName, ap.index);
        ap = null;
        const response = {};
        await s3.deleteObject(
            response, regionName, pm.Bucket,
            pm.Key + S3KVS_EXTENSION,
            credential);
        return response.status <= 299;
    }

    // リスト取得に対するPage、Maxのパラメータチェック.
    const _checkListPageMax = function(page, max) {
        page = page|0;
        max = max|0;
        // １度に取得できる最大リスト件数の範囲外の場合.
        if(max <= 0 || max > MAX_LIST) {
            if(max <= 0) {
                throw new Error(
                    "The number of lists is set to zero.");
            }
            throw new Error("The maximum number of lists (" +
                MAX_LIST + ") has been exceeded.");
        // ページ番号が正しくない場合.
        } else if(page < 0) {
            throw new Error(
                "The number of pages is set to zero.");
        }
    }

    // 指定テーブルのリスト一覧を取得.
    // ページ番号とページ表示数を設定して取得.
    // tableName 対象のテーブル名を設定します.
    // page ページ数を設定します.
    //      呼び出しに毎回先頭から取得するので、ページ数が多いと「速度低下」に
    //      繋がるので注意が必要です.
    // max １ページの最大表示数を設定.
    //     100件を超える設定はできません.
    // marker 読み取り開始位置のマーカーを設定します.
    //        これを設定する事で、page読み込みじゃなく、このmarkerからの
    //        読み込みとなります.
    // 戻り値: {page, max, marker, list}
    //         page: 返却対象のページ番号が設定されます.
    //         max: 1ページの最大表示数が設定されます.
    //         nextMarker: 次のページに遷移するMarkerが設定されます.
    //                     nullの場合、次のページは存在しません.
    //         list: [{key: value} ... ]
    //              指定したpath位置以下のobject名のkeyValue群が返却されます.
    const list = async function(tableName, page, max, marker) {
        if(typeof(marker) == "string" && marker.length > 0) {
            return await _nextList(tableName, marker, page, max);
        }
        return await _list(tableName, page, max);
    }

    // 指定テーブルのリスト一覧を取得.
    // ページ番号とページ表示数を設定して取得.
    // tableName 対象のテーブル名を設定します.
    // page ページ数を設定します.
    //      呼び出しに毎回先頭から取得するので、ページ数が多いと「速度低下」に
    //      繋がるので注意が必要です.
    // max １ページの最大表示数を設定.
    //     100件を超える設定はできません.
    // 戻り値: {page, max, marker, list}
    //         page: 返却対象のページ番号が設定されます.
    //         max: 1ページの最大表示数が設定されます.
    //         nextMarker: 次のページに遷移するMarkerが設定されます.
    //                     nullの場合、次のページは存在しません.
    //         list: [{key: value} ... ]
    //              指定したpath位置以下のobject名のkeyValue群が返却されます.
    const _list = async function(tableName, page, max) {
        page = page|0;
        max = max|0;
        _checkListPageMax(page, max);
        // S3パラメータを取得.
        const pm = getS3Params(
            bucketName, prefixName, tableName, undefined);
        // 利用条件をセット.
        const bucket = pm.Bucket;
        const prefix = pm.Key;
        let cnt = 1;
        let response = undefined;
        let ret = undefined;
        let nextMarker = null;
        // １ページの取得条件を設定.
        //  - １回の取得は max.
        //  - 対象のprefixのみ検索.
        //  - Key名のみ取得.
        const opt = {maxKeys: max, keyOnly: true};
        while(true) {
            // response.
            response = {};
            // 対象のリストを取得.
            ret = await s3.listObject(
                response, regionName, bucket, prefix, opt,
                credential);
            // NextMarkerが存在しない場合.
            if(response.header[s3.NEXT_MARKER_NAME] != "true") {
                nextMarker = null;
            // 次のNextMarkerが存在する場合.
            } else {
                nextMarker = ret[ret.length - 1];
            }
            opt.marker = nextMarker;
            cnt ++;
            // 次のnextMarkerがnullの場合.
            // ページ読み込み終了の場合.
            if(nextMarker == null || cnt >= page) {
                // 処理終了.
                break;
            }
        }
        return {
            page: page,
            max: max,
            nextMarker: nextMarker,
            list: decodeKeyValueList(ret)
        }
    }

    // 指定テーブルのリスト一覧を取得.
    // 指定マーカーを設定して、リストを取得.
    // こちらは list と違ってマーカー指定リスト取得なので、
    // 速度は遅くなりません.
    // tableName 対象のテーブル名を設定します.
    // marker 読み取り開始位置のマーカーを設定します.
    // page ページ数を設定します.
    // max １ページの最大表示数を設定.
    //     100件を超える設定はできません.
    // 戻り値: {page, max, marker, list}
    //         page: 返却対象のページ番号が設定されます.
    //         max: 1ページの最大表示数が設定されます.
    //         nextMarker: 次のページに遷移するMarkerが設定されます.
    //                     nullの場合、次のページは存在しません.
    //         list: [{key: value} ... ]
    //              指定したpath位置以下のobject名のkeyValue群が返却されます.
    const _nextList = async function(tableName, marker, page, max) {
        page = page|0;
        max = max|0;
        _checkListPageMax(page, max);
        marker = typeof(marker) == "string" ? marker : undefined;
        // S3パラメータを取得.
        const pm = getS3Params(
            bucketName, prefixName, tableName, undefined);
        // response.
        const response = {};
        let nextMarker = null;
        // 対象のリストを取得.
        ret = await s3.listObject(
            response, regionName, pm.Bucket, pm.Key,
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
            page: page,
            max: max,
            nextMarker: nextMarker,
            list: decodeKeyValueList(ret)
        };
    }

    // 登録されている全ての一覧を取得.
    // tableName 対象のテーブル名を設定します.
    // 戻り値: list: [{key: value} ... ]
    //         指定したpath位置以下のobject名のkeyValue群が返却されます.
    const listAll = async function(tableName) {
        try {
            let i, len, marker, off = 0, max = 50;
            let ret = [];
            while(true) {
                const n = await list(
                    tableName, off, max, marker);
                const lst = n.list;
                len = lst.length;
                for(i = 0; i < len; i ++) {
                    ret[ret.length] = lst[i];
                }
                off += len;
                marker = n.marker;
                if(len == 0 || marker == null) {
                    break;
                }
            }
            return ret;
        } catch(e) {
            throw new Error(
                "Failed to get list.", e);
        }
    }

    // オブジェクト.
    const ret = {};

    // カレントテーブル条件を設定.
    // tableName 対象のテーブル名を設定します.
    // 戻り値: それぞれの処理が返却されます.
    ret.currentTable = function(tableName) {
        return {

            // put.
            // index key, value ... を設定します. 
            // value valueを設定します.
            // 戻り値: trueの場合設定に成功しました.            
            put: function() {
                return put.apply(null,
                    _appendParams([tableName], arguments));
            }

            // get.
            // index key, value ... を設定します. 
            // 戻り値: 検索結果(json)が返却されます.
            //         情報取得に失敗した場合は null が返却されます.
            ,get: function() {
                return get.apply(null,
                    _appendParams([tableName], arguments));
            }

            // remove.
            // index key, value ... を設定します. 
            // 戻り値: trueの場合削除に成功しました.
            ,remove: function() {
                return remove.apply(null,
                    _appendParams([tableName], arguments));
            }

            // 指定テーブルのリスト一覧を取得.
            // ページ番号とページ表示数を設定して取得.
            // page ページ数を設定します.
            //      呼び出しに毎回先頭から取得するので、ページ数が多いと「速度低下」に
            //      繋がるので注意が必要です.
            // max １ページの最大表示数を設定.
            //     100件を超える設定はできません.
            // marker 読み取り開始位置のマーカーを設定します.
            //        これを設定する事で、page読み込みじゃなく、このmarkerからの
            //        読み込みとなります.
            // 戻り値: {page, max, marker, list}
            //         page: 返却対象のページ番号が設定されます.
            //         max: 1ページの最大表示数が設定されます.
            //         nextMarker: 次のページに遷移するMarkerが設定されます.
            //                     nullの場合、次のページは存在しません.
            //         list: [{key: value} ... ]
            //              指定したpath位置以下のobject名のkeyValue群が返却されます.
            ,list: function() {
                return list.apply(null,
                    _appendParams([tableName], arguments));
            }

            // 登録されている全ての一覧を取得.
            // 戻り値: list: [{key: value} ... ]
            //         指定したpath位置以下のobject名のkeyValue群が返却されます.
            ,listAll: function() {
                return listAll.apply(null,
                    _appendParams([tableName], arguments));
            }

            // 現在のカレントテーブル名を取得.
            // 戻り値: 現在設定されているカレントテーブル名が返却されます.
            ,getCurrentTable: function() {
                return tableName;
            }
        };
    }

    // 汎用性テーブル.
    // 単純なkvs形式で利用する場合はこちらを利用します.
    // tableName 対象のテーブル名を設定します.
    // keyName キー名を設定します.
    // 戻り値: それぞれの処理が返却されます.
    ret.versatilityTable = function(tableName, keyName) {
        return {

            // put.
            // key key名を設定します.
            // value valueを設定します.
            // 戻り値: trueの場合設定に成功しました.            
            put: function(key, value) {
                return put(tableName, keyName, key, value)
            }

            // get.
            // key key名を設定します.
            // 戻り値: 検索結果(json)が返却されます.
            //         情報取得に失敗した場合は null が返却されます.
            ,get: function(key) {
                return get(tableName, keyName, key);
            }

            // remove.
            // key key名を設定します.
            // 戻り値: trueの場合削除に成功しました.
            ,remove: function(key) {
                return remove(tableName, keyName, key);
            }

            // 指定テーブルのリスト一覧を取得.
            // ページ番号とページ表示数を設定して取得.
            // page ページ数を設定します.
            //      呼び出しに毎回先頭から取得するので、ページ数が多いと「速度低下」に
            //      繋がるので注意が必要です.
            // max １ページの最大表示数を設定.
            //     100件を超える設定はできません.
            // marker 読み取り開始位置のマーカーを設定します.
            //        これを設定する事で、page読み込みじゃなく、このmarkerからの
            //        読み込みとなります.
            // 戻り値: {page, max, marker, list}
            //         page: 返却対象のページ番号が設定されます.
            //         max: 1ページの最大表示数が設定されます.
            //         nextMarker: 次のページに遷移するMarkerが設定されます.
            //                     nullの場合、次のページは存在しません.
            //         list: [key, key, key ... ]
            //              指定したpath位置以下のobject名のkeyValue群が返却されます.
            ,list: async function(page, max, marker) {
                const result = await list(tableName, page, max, marker);
                const list = result.list;
                const len = list.length;
                const ret = [];
                let em;
                for(let i = 0; i < len; i ++) {
                    em = list[i];
                    if(em.key == keyName) {
                        ret[ret.length] = em.value;
                    }
                }
                result.list = ret;
                return result;
            }

            // 登録されている全ての一覧を取得.
            // detail 
            // 戻り値: detaul == true:
            //        [{key: key, value: get(key)}, ... ]が返却されます.
            //        detaul == false:
            //        [key1, key2, ... ]が返却されます.
            ,listAll: async function(detail) {
                const list = await listAll(tableName);
                const len = list.length;
                const ret = [];
                let em;
                if(detail == true) {
                    for(let i = 0; i < len; i ++) {
                        em = list[i];
                        if(em.key == keyName) {
                            ret[ret.length] = {
                                key: em.value,
                                value: await get(tableName, keyName, em.value)
                            };
                        }
                    }
                } else {
                    for(let i = 0; i < len; i ++) {
                        em = list[i];
                        if(em.key == keyName) {
                            ret[ret.length] = em.value;
                        }
                    }
                }
                return ret;
            }

            // 現在のカレントテーブル名を取得.
            // 戻り値: 現在設定されているカレントテーブル名が返却されます.
            ,getCurrentTable: function() {
                return tableName;
            }

            // 現在のkeyName名を取得.
            // 戻り値: 現在設定されているkeyName名が返却されます.
            ,getkeyName: function() {
                return keyName;
            }
        }
    }
    
    // 固有設定.
    ret.put = put;
    ret.get = get;
    ret.remove = remove;
    ret.list = list;
    ret.listAll = listAll;

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();
