// secretsManager(クライアント利用).
//
(function() {
'use strict';

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// 暗号用.
const cip = frequire("./lib/util/fcipher.js");

// s3Client.
const s3cl = frequire("./lib/s3client.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]S3scm-Prefix.
const ENV_S3_SCM_PREFIX = "S3_SCM_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "secretsManager";

// descriptionHEAD.
const DESCRIPTION_HEAD = "q$0I_";

// S3Prefix.
let _PREFIX = undefined;
const getPrefix = function() {
    if(_PREFIX == undefined) {
        const env = process.env[ENV_S3_SCM_PREFIX];
        if(env == undefined) {
            _PREFIX = DEFAULT_PREFIX;
        } else {
            _PREFIX = env;
        }
    }
    return _PREFIX;
}

// s3Bucket.
let _S3_BUCKET = undefined;
const getS3Bucket = function() {
    if(_S3_BUCKET == undefined) {
        const env = process.env[ENV_MAIN_S3_BUCKET];
        if(env == undefined) {
            throw new Error(
                "Environment variable `" +
                    ENV_MAIN_S3_BUCKET + "` is not set");
        } else {
            _S3_BUCKET = env;
        }
    }
    return _S3_BUCKET;
}

// 対象secretBodyからvalue情報を取得.
const getValue = function(key, json) {
    const value = json.value;
    const description = json.description;
    // 復号化.
    const ret = cip.dec(value,
        cip.key(
            cip.fhash(key, true),
            cip.fhash(DESCRIPTION_HEAD + description, true)
        )
    );
    return ret;
}

// s3Clientオブジェクトキャッシュ.
let s3objCache = undefined;

// S3Clientオブジェクトを取得.
const getS3Client = function() {
    if(s3objCache == undefined) {
        s3objCache = s3cl.create();
    }
    return s3objCache;
}


// 登録されている1つのsecret情報を取得.
// key 対象のkeyを設定します.
// 戻り値: secretValueが返却されます.
const get = async function(key) {
    try {
        // jsonを取得.
        const json = await getS3Client().getString({
            Bucket: getS3Bucket(),
            Key: getPrefix() + "/" + Buffer.from(key).toString("base64")
        });
        // valueを復号化.
        return getValue(key, JSON.parse(json));
    } catch(e) {
        // エラー出力.
        console.warn("[WARN]secret key: " + key, e);
        // 存在しない場合は空返却.
        return undefined;
    }
}
exports.get = get;

// 埋め込みコード用のdescription.
const DESCRIPTION_EMBED_CODE = "#015_$00000032_%";

// 埋め込みコードのSecret内容を取得.
// ※埋め込みコードはS3ではなく、環境変数に埋め込まれたコードに対して
//   Secretと同様の処理でvalueを取得するものです.
// key 対象のkeyを設定します.
// embedCode 対象の埋め込みコードを設定します.
const getEmbed = function(key, embedCode) {
    // 埋め込みコード用のdescriptionを生成.
    const description = DESCRIPTION_EMBED_CODE + key;
    // １回目の復号化.
    let result = cip.dec(embedCode,
        cip.key(cip.fhash(key, true), description)
    );
    // ２回目の復元.
    return getValue(key, JSON.parse(result));
}
exports.getEmbed = getEmbed;

})();
