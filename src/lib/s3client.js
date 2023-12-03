///////////////////////////////////////////////
// S3 client ユーティリティ.
///////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// s3restApi.
const s3 = frequire("./lib/s3restApi.js");

// [ENV]メインS3Bucket名.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// バケット名が指定されない場合は、環境変数で定義された
// バケット情報を利用する.
// bucket 設定バケット名を設定します.
// 戻り値: バケット名が返却されます.
const getBucketName = function(bucket) {
    // 空セットの場合.
    if(bucket == null || bucket == undefined ||
        bucket.length == 0) {
        // 環境変数から取得.
        bucket = process.env[ENV_MAIN_S3_BUCKET];
        if(bucket == null || bucket == undefined ||
            bucket.length == 0) {
            throw new Error("Bucket name is empty.");
        }
    }
    return bucket;
}

// S3Clientを取得.
// region 対象のリージョンを設定します.
// credential AWSクレデンシャルを設定します.
//   {accessKey: string, secretAccessKey: string,
//     sessionToken: string}
//   - accessKey アクセスキーが返却されます.
//   - secretAccessKey シークレットアクセスキーが返却されます.
//   - sessionToken セッショントークンが返却されます.
//                  状況によっては空の場合があります.
// 戻り値: S3Clientが返却されます.
const create = function(region, credential) {

    /////////////////////////////////////////////////////
    // オブジェクト群.
    /////////////////////////////////////////////////////
    const ret = {};

    // 条件を指定してS3Bucket+Prefixのリスト情報を取得.
    // params {Bucket: string, Prefix: string}
    //         - [必須]Bucket 対象のbucket名を設定します.
    //         - [必須]Prefix 対象のprefix名を設定します.
    //         - [任意]MaxKeys 最大取得数を設定します(1 - 1000).
    //         - [任意]Delimiter 取得階層の範囲を設定します.
    //                          "/" を設定した場合は指定prefixが"/"の階層の範囲を
    //                         リスト取得します.
    //         - [任意]Marker 前のlistObject処理で response.header["x-next-marker"]
    //                  情報が"true"の場合、一番最後の取得したKey名を設定します.
    //         - [任意]KeyOnly trueの場合Key名だけ取得します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: リスト情報が返却されます.
    //         [{key: string, lastModified: string, size: number} ... ]
    //         - key: オブジェクト名.
    //         - lastModified: 最終更新時間(yyyy/MM/ddTHH:mm:ssZ).
    //         - size: ファイルサイズ.
    ret.listObjects = async function(params) {
        // バケット名を取得.
        const bucket = getBucketName(params.Bucket);
        const options = {
            maxKeys: params.MaxKeys,
            delimiter: params.Delimiter,
            marker: params.Marker,
            keyOnly: params.KeyOnly
        };
        // リスト取得.
        const response = {};
        params.response = response;
        const ret = await s3.listObject(
            response, region, bucket, params.Prefix,
            options, credential);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            throw new Error("[ERROR: " + response.status +
                "]getList bucket: " + bucket +
                " prefix: " + params.Prefix);
        }
        return ret;
    }


    // 条件を指定してS3Bucket+Keyのメタ情報を取得.
    // params {Bucket: string, Key: string}
    //         - [必須]Bucket 対象のbucket名を設定します.
    //         - [必須]Key 対象のkey名を設定します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: {lastModified: string, size: number}
    //         - lastModified: 最終更新時間(yyyy/MM/ddTHH:mm:ssZ).
    //         - size: ファイルサイズ.
    ret.headObject = async function(params) {
        // バケット名を取得.
        const bucket = getBucketName(params.Bucket);
        // オブジェクト取得.
        const response = {};
        params.response = response;
        const ret = await s3.headObject(
            response, region, bucket, params.Key, credential);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            throw new Error("[ERROR: " + response.status +
                "]headObject bucket: " + bucket + " key: " +
                params.Key);
        }
        return ret;
    };

    // 条件を指定してS3Bucket+Key情報を取得.
    // params {Bucket: string, Key: string}
    //         - [必須]Bucket 対象のbucket名を設定します.
    //         - [必須]Key 対象のkey名を設定します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: 処理結果のBufferが返却されます.
    ret.getObject = async function(params) {
        // バケット名を取得.
        const bucket = getBucketName(params.Bucket);
        // オブジェクト取得.
        const response = {};
        params.response = response;
        const ret = await s3.getObject(
            response, region, bucket, params.Key, credential);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            throw new Error("[ERROR: " + response.status +
                "]getObject bucket: " + bucket + " key: " +
                params.Key);
        }
        return ret;
    };

    // 条件を指定してS3Bucket+Key情報を文字列で取得.
    // params {Bucket: string, Key: string}
    //         - [必須]Bucket 対象のbucket名を設定します.
    //         - [必須]Key 対象のkey名を設定します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: 処理結果が文字列で返却されます.
    ret.getString = async function(params) {
        return (await ret.getObject(params))
            .toString();
    }

    // 条件を指定してS3Bucket+Key情報にBodyをセット.
    // params {Bucket: string, Key: string, Body: string or Buffer}
    //         - [必須]Bucket 対象のbucket名を設定します.
    //         - [必須]Key 対象のkey名を設定します.
    //         - [必須]Body 対象のbody情報を設定します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: trueの場合、正常に設定されました.
    ret.putObject = async function(params) {
        // バケット名を取得.
        const bucket = getBucketName(params.Bucket);
        // bodyをput.
        const response = {};
        params.response = response;
        await s3.putObject(
            response, region, bucket, params.Key,
            params.Body, credential);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            throw new Error("[ERROR: " + response.status +
                "]putObject bucket: " + bucket + " key: " +
                params.Key);
        }
        return response.status <= 299;
    }

    // 条件を指定してS3Bucket+Key情報を削除.
    // params {Bucket: string, Key: string}
    //         - Bucket 対象のbucket名を設定します.
    //         - Key 対象のkey名を設定します.
    //        またparams.responseが設定されます.
    //        {status: number, header: object}
    // 戻り値: trueの場合、正常に設定されました.
    ret.deleteObject = async function(params) {
        // バケット名を取得.
        const bucket = getBucketName(params.Bucket);
        // オブジェクト取得.
        const response = {};
        params.response = response;
        const result = await s3.deleteObject(
            response, region, bucket, params.Key, credential);
        // レスポンスステータスが400以上の場合エラー.
        if(response.status >= 400) {
            throw new Error("[ERROR: " + response.status +
                "]deleteObject bucket: " + bucket + " key: " +
                params.Key + " message: " + Buffer.from(result).toString());
        }
        return response.status <= 299;
    }
    
    // 署名付きダウンロードURLを取得.
    // params {Bucket: string, Key: string, Expire}
    //         - [必須]Bucket ダウンロード対象のS3bucket名を設定します.
    //         - [必須]Key ダウンロード対象のS3のkey名を設定します.
    //         - [任意]Expire 署名URLの寿命を秒単位で設定します.
    //                 設定しない場合は任意の値(60秒)が設定されます.
    // 戻り値：署名付きダウンロードURLが返却されます.
    ret.getPreSignedUrl = function(params) {
        // 署名付きダウンロードURLを返却.
        return s3.preSignedUrl(
            region, "GET", getBucketName(params.Bucket), params.Key,
            params.Expire, null, credential);
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.create = create;

})();