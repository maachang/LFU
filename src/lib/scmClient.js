// secretsManager(クライアント利用).
// awsのsecretManager的なことを、単純にS3で行うためのライブラリ.
//  - scmManager.js LFU用SecretManagerの管理機能.
//    管理機能ではこちらを利用します.
//  - scmClient.js LFU用SecretManagerを利用する場合の機能.
//    プログラムで利用する場合に利用します.
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

// auth/util.
const authUtil = frequire("./lib/auth/util.js");

// 暗号用.
const cip = frequire("./lib/util/fcipher.js");

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// [ENV]S3scm-Prefix.
const ENV_S3_SCM_PREFIX = "S3_SCM_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_S3_SCM_PREFIX = "secretsManager";

// 区切り文字.
const SEPARATOR = "%$%";

// descriptionHEAD.
const DESCRIPTION_HEAD = "q$0I_";

// 埋め込みコード用のdescription.
const DESCRIPTION_EMBED_CODE = "#015_$00000032_%";

// 埋め込みコード用のdescription終端.
const DESCRIPTION_EMBED_ENDPOINT_CODE = "@$||";

// シークレットマネージャ管理用テーブル.
let _userTable = undefined;
const userTable = function() {
	if(_userTable == undefined) {
		_userTable = s3kvs.create().currentTable(
			authUtil.useString(process.env[ENV_S3_SCM_PREFIX]) ?
				process.env[ENV_S3_SCM_PREFIX] :
				DEFAULT_S3_SCM_PREFIX
		);
	}
	return _userTable;
}

// 対象secretBodyから復元value情報を取得.
const _decodeValue = function(key, json) {
    const description = Buffer.from(json.description, "base64").toString();
    const createTime = Buffer.from(json.createTime, "base64").toString();
    const createUser = Buffer.from(json.createUser, "base64").toString();
    // 復号化.
    return cip.dec(json.value,
        cip.key(
            cip.fhash(key + SEPARATOR + createTime, true),
            cip.fhash(DESCRIPTION_HEAD + description + SEPARATOR + createUser, true)
        )
    );
}

// 登録されている1つのsecret情報を取得.
// key 対象のkeyを設定します.
// 戻り値: 文字列が返却されます.
//         存在しない場合はundefined返却されます.
const get = async function(key) {
    // jsonを取得.
    const json = await userTable().get("key", key);
    if(json == null) {
        return undefined;
    }
    // valueを復号化.
    return _decodeValue(key, json);
}

// 登録されている1つのsecret情報をJSON取得.
// key 対象のkeyを設定します.
// 戻り値: JSON結果が返却されます.
//         存在しない場合はundefined返却されます.
const getJSON = async function(key) {
    const result = await get(key);
    if(result == undefined) {
        return;
    }
    return JSON.parse(result);
}

// 埋め込みコードのSecret内容を取得.
// ※埋め込みコードはS3ではなく、環境変数に埋め込まれたコードに対して
//   Secretと同様の処理でvalueを取得するものです.
// key 対象のkeyを設定します.
// embedCode 対象の埋め込みコードを設定します.
// 戻り値: 復号結果が文字列で返却されます.
const getEmbed = function(key, embedCode) {
    // 埋め込みコード用のdescriptionを生成.
    const description = DESCRIPTION_EMBED_CODE + key +
        DESCRIPTION_EMBED_ENDPOINT_CODE;
    // １回目の復号化.
    const result = cip.dec(embedCode,
        cip.key(cip.fhash(key, true), description)
    );
    // ２回目復号化.
    return _decodeValue(key, JSON.parse(result));
}

// 埋め込みコードのSecret内容を取得.
// ※埋め込みコードはS3ではなく、環境変数に埋め込まれたコードに対して
//   Secretと同様の処理でvalueを取得するものです.
// key 対象のkeyを設定します.
// embedCode 対象の埋め込みコードを設定します.
// 戻り値: JSON結果が返却されます.
const getEmbedJSON = function(key, embedCode) {
    return JSON.parse(getEmbed(key, embedCode));
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.get = get;
exports.getJSON = getJSON;
exports.getEmbed = getEmbed;
exports.getEmbedJSON = getEmbedJSON;

})();
