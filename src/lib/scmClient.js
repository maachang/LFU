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

// 暗号用.
const cip = frequire("./lib/util/fcipher.js");

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// [ENV]S3scm-Prefix.
const ENV_S3_SCM_PREFIX = "S3_SCM_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_S3_SCM_PREFIX = "secretsManager";

// descriptionHEAD.
const DESCRIPTION_HEAD = "q$0I_";

// 埋め込みコード用のdescription.
const DESCRIPTION_EMBED_CODE = "#015_$00000032_%";

// シークレットマネージャ管理用テーブル.
let _userTable = undefined;
const userTable = function() {
	if(_userTable == undefined) {
		_userTable = s3kvs.create().currentTable(
			authUtil.useString(process.env(ENV_S3_SCM_PREFIX)) ?
				process.env(ENV_S3_SCM_PREFIX) :
				DEFAULT_S3_SCM_PREFIX
		);
	}
	return _userTable;
}

// 対象secretBodyから復元value情報を取得.
const _decodeValue = function(key, json) {
    const value = json.value;
    const description = json.description;
    // 復号化.
    return cip.dec(value,
        cip.key(
            cip.fhash(key, true),
            cip.fhash(DESCRIPTION_HEAD + description, true)
        )
    );
}

// 登録されている1つのsecret情報を取得.
// key 対象のkeyを設定します.
// 戻り値: secretValueが返却されます.
const get = async function(key) {
    try {
        // jsonを取得.
        const json = await userTable.get("key", key);
        // valueを復号化.
        return _decodeValue(key, JSON.parse(json));
    } catch(e) {
        // エラー出力.
        console.warn("[WARN]secret key: " + key, e);
        // 存在しない場合は空返却.
        return undefined;
    }
}

// 埋め込みコードのSecret内容を取得.
// ※埋め込みコードはS3ではなく、環境変数に埋め込まれたコードに対して
//   Secretと同様の処理でvalueを取得するものです.
// key 対象のkeyを設定します.
// embedCode 対象の埋め込みコードを設定します.
// 戻り値: 復号結果が返却されます.
const getEmbed = function(key, embedCode) {
    // 埋め込みコード用のdescriptionを生成.
    const description = DESCRIPTION_EMBED_CODE + key;
    // １回目の復号化.
    const result = cip.dec(embedCode,
        cip.key(cip.fhash(key, true), description)
    );
    // ２回目復号化.
    return _decodeValue(key, JSON.parse(result));
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.get = get;
exports.getEmbed = getEmbed;

})();
