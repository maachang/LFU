// secretsManager(管理用).
// awsのsecretManager的なことを、単純にS3で行うためのライブラリ.
//  - scmManager.js LFU用SecretManagerの管理機能.
//    管理機能ではこちらを利用します.
//  - scmClient.js LFU用SecretManagerを利用する場合の機能.
//    プログラムで利用する場合に利用します.
//
(function() {
'use strict';

// AWS Secrets Manager を利用すると
// - 10000アクセス毎に0.15USDが発生する.
//
// 一方でS3は１ファイル128kbyte以下なら1つのシークレットが月で
// - 0.0000032USD.
//
// で、アクセス数に依存しない事から、明らかにコストダウンできる.
// > 0.15 / 0.0000032 = 46875個のsecret作成(月管理)ができる.
//   AWSのSecrets Manager月10kアクセス換算で、46875の
//   LFU Secretsが作成できることになる(理論値).
//
// LFUの観点としては、コストが安くAWSでWebアプリが作れる観点から
// この辺コストがかからないで、同じような機能提供できる形として
// 独自規格だが、S3でそれができる仕組みを提供する.
// 暗号用.

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

const cip = frequire("./lib/util/fcipher.js");

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// [ENV]S3scm-Prefix.
const ENV_S3_SCM_PREFIX = "S3_SCM_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_S3_SCM_PREFIX = "secretsManager";

// descriptionなし.
const NONE_DESCRIPTION = "*???*";

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
			authUtil.useString(process.env(ENV_S3_SCM_PREFIX)) ?
				process.env(ENV_S3_SCM_PREFIX) :
				DEFAULT_S3_SCM_PREFIX
		);
	}
	return _userTable;
}

// [ENV]最大SCM表示件数設定.
const ENV_SCM_LIST_LIMIT = "SCM_LIST_LIMIT";

// 最大SCM表示件数を取得.
const MAX_SCM_LIST_LIMIT = 100;

// [ENV]最大表示件数.
let SCM_LIST_LIMIT = process.env[ENV_SCM_LIST_LIMIT]|0;
if(SCM_LIST_LIMIT >= MAX_SCM_LIST_LIMIT) {
    SCM_LIST_LIMIT = MAX_SCM_LIST_LIMIT;
} else if(SCM_LIST_LIMIT <= 0) {
    SCM_LIST_LIMIT = 25;
}

// secrets manager用のJSONを生成.
// key secretsManagerに登録するKey名を文字列で設定します.
// value secretsManagerに登録するValue情報を文字列で設定します.
// description 説明を設定します.
// 戻り値: {key: string, description: string, value: string} の
//         文字列が返却されます.
const _createJSON = function(key, value, description) {
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    // valueはstring必須で情報存在が必須.
    if(!(typeof(value) == "string" && value.length > 0)) {
        throw new Error("value must be a string.");
    }
    // descriptionが文字列でない場合は空をセット.
    if(!(typeof(description) == "string" && description.length > 0)) {
        description = NONE_DESCRIPTION;
    }
    // 暗号化.
    const ret = cip.enc(value,
        cip.key(cip.fhash(key, true),
            cip.fhash(DESCRIPTION_HEAD + description, true)));
    // key, descriptionをbase64変換.
    key = Buffer.from(key).toString("base64");
    description = Buffer.from(description).toString("base64");
    // json文字列で戻す.
    return "{\"key\":\"" + key + "\"," +
        "\"description\":\"" + description + "\"," +
        "\"value\":\"" + Buffer.from(ret).toString() + "\"}";
};

// [LFU用]生成したsecrets managerのValueをS3にUpload.
// key secretsManagerに登録するKey名を文字列で設定します.
// value JSON暗号加工された内容を設定します.
// 戻り値: trueの場合、無事更新されました.
const _outputS3 = async function(key, value) {
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    // 送信処理.
    return await userTable.put("key", key, value);
}

// 新しいsecrets managerを生成.
// key secretsManagerに登録するKey名を文字列で設定します.
// value secretsManagerに登録するValue情報を文字列で設定します.
// description 説明を設定します.
const create = async function(key, value, description) {
    // json変換.
    const json = _createJSON(key, value, description);
    // S3に登録.
    await _outputS3(key, json);
}

// [LFU用]secrets manager用の埋め込みコードを生成.
// ※埋め込みコードなので、S3に保存されずに、Lambdaの環境変数埋め込み対応
//   で利用される事が想定されます.
// key secretsManagerに登録するKey名を文字列で設定します.
// value secretsManagerに登録するValue情報を文字列で設定します.
// 戻り値: 埋め込み用のコードが返却されます.
const createEmbedCode = function(key, value) {
    // 埋め込みコード用のdescriptionを生成.
    const description = DESCRIPTION_EMBED_CODE +
        key + DESCRIPTION_EMBED_ENDPOINT_CODE;
    // 埋め込み用のコード生成.
    const result = _createJSON(key, value, description);
    // 戻り値を返却.
    return Buffer.from(
        cip.enc(result, cip.key(cip.fhash(key, true), description))
    ).toString();
}

// [LFU用]jsonに設定されているkeyとdescriptionを取得.
// value BodyのJSONを設定します.
// 戻り値: {key: string, description: string} が返却されます.
const _getBodyJsonToKeyAndDescription = function(value) {
    // keyはbase64変換されているので、decode.
    const key = Buffer.from(jsonValue.key, 'base64').toString();
    // descriptionはbase64変換されているので、decode.
    let description = Buffer.from(jsonValue.description, 'base64').toString();
    // descriptionが未設定な内容の場合.
    if(description == NONE_DESCRIPTION) {
        description = "";
    }
    return {
        key: key,
        description: description
    };
}

// 指定KeyからKeyとdescriptionを取得.
//  ※管理側のsecretManagerでは、暗号化された内容の取得ができません.
// key 対象のKey明を設定します.
// 戻り値: {key: string, description: string} が返却されます.
const get = async function(key) {
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    const result = await userTable.get("key", key);
    // keyとdescriptionのJSON返却.
    return _getBodyJsonToKeyAndDescription(result);
}

// [LFU用]secrets managerから削除.
// key secretsManagerに登録するKey名を文字列で設定します.
// 戻り値: trueの場合、無事削除されました.
const remove = async function(key) {
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    return await userTable.remove("key", key);
}

// [LFU用]secrets manager一覧を取得.
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
//         list: [user1, user2, ... ]が返却されます.
const list = async function(page, max, marker) {
	max = max|0;
    if(max <= 0) {
        max = SCM_LIST_LIMIT;
    } else if(max >= MAX_SCM_LIST_LIMIT) {
		max = MAX_SCM_LIST_LIMIT;
	}
    page = page|0;
    if(page <= 0) {
        page = 0;
    }
    // １ページの情報を取得.
    const result = await userTable()
		.list(page, max, marker);
	const list = result.list;
    const ret = [];
    const len = list.length;
	for(let i = 0; i < len; i ++) {
        // 対象Keyでない場合.
        if(list[i].key != "key") {
            // 無視.
            continue;
        }
        // ユーザ名をセット.
        ret[ret.length] = list[i].value;
	}
	return {
		page: page,
		max: max,
		marker: result.marker,
		list: ret
	};
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.create = create;
exports.createEmbedCode = createEmbedCode;
exports.get = get;
exports.remove = remove;
exports.list = list;

})();