// secretsManager(管理用command).
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

// コマンド引数用.
const args = require("./modules/args.js");

// 暗号用.
const cip = require("./modules/fcipher.js");

// s3Client.
const s3cl = require("../src/lib/s3client.js");

// [ENV]メインS3バケット.
const ENV_MAIN_S3_BUCKET = "MAIN_S3_BUCKET";

// [ENV]S3scm-Prefix.
const ENV_S3_SCM_PREFIX = "S3_SCM_PREFIX";

// デフォルトのプレフィックス.
const DEFAULT_PREFIX = "secretsManager";

// descriptionなし.
const NONE_DESCRIPTION = "*???*";

// descriptionHEAD.
const DESCRIPTION_HEAD = "q$0I_";

// 埋め込みコード用のdescription.
const DESCRIPTION_EMBED_CODE = "#015_$00000032_%";

// S3Prefix.
const OUTPUT_PREFIX = function() {
    const env = process.env[ENV_S3_SCM_PREFIX];
    if(env == undefined) {
        return DEFAULT_PREFIX;
    }
    return env;
}

// lfu用SecretsManagerコマンド名.
const COMMAND_NAME = "lfuscm";

// [LFU用]secrets manager用のJSONを生成.
// key secretsManagerに登録するKey名を文字列で設定します.
// value secretsManagerに登録するValue情報を文字列で設定します.
// description 説明を設定します.
// 戻り値: {description: "", value: ""} の文字列が返却されます.
const createJSON = function(key, value, description) {
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
    // descriptionをbase64変換.
    description = Buffer.from(description).toString("base64");
    // 暗号化.
    const ret = cip.enc(value,
        cip.key(cip.fhash(key, true),
            cip.fhash(DESCRIPTION_HEAD + description, true)));
    // json文字列で戻す.
    return "{\"description\":\"" + description + "\",\"value\":\"" +
        Buffer.from(ret).toString() + "\"}";
};

// [LFU用]secrets manager用の埋め込みコードを生成.
// ※埋め込みコードなので、S3に保存されずに、Lambdaの環境変数埋め込み対応
//   で利用される事が想定されます.
// key secretsManagerに登録するKey名を文字列で設定します.
// value secretsManagerに登録するValue情報を文字列で設定します.
// 戻り値: 埋め込み用のコードが返却されます.
const createEmbedCode = function(key, value) {
    // 埋め込みコード用のdescriptionを生成.
    const description = DESCRIPTION_EMBED_CODE + key;
    // 埋め込み用のコード生成.
    const result = createJSON(key, value, description);
    // 戻り値を返却.
    return Buffer.from(
        cip.enc(result, cip.key(cip.fhash(key, true), description))
    ).toString();
}

// [LFU用]s3のprefixKeyからkeyを取得.
// prefixKey s3のprefixKeyを設定します.
// 戻り値: key情報が返却されます.
const getS3PrefixToKey = function(prefixKey) {
    // OUTPUT_PREFIX が先頭に存在する場合.
    const outputPrefix = OUTPUT_PREFIX();
    if(prefixKey.startsWith(outputPrefix + "/")) {
        prefixKey = prefixKey.substring(outputPrefix.length + 1);
    }
    // 開始スラッシュは除外.
    if(prefixKey.startsWith("/")) {
        prefixKey = prefixKey.substring(1);
    }
    // 終了スラッシュは除外.
    if(prefixKey.endsWith("/")) {
        prefixKey = prefixKey.substring(0, prefixKey.length - 1);
    }
    // base64デコード.
    return Buffer.from(prefixKey, 'base64').toString();
}

// [LFU用]jsonに設定されているdescriptionを取得.
// jsonValue BodyのJSONを設定します.
// 戻り値: 説明が返却されます.
const getBodyJsonToDescription = function(jsonValue) {
    // descriptionはbase64変換されているので、decode.
    const ret = Buffer.from(jsonValue.description, 'base64').toString();
    // 未設定な内容の場合.
    if(ret == NONE_DESCRIPTION) {
        return "";
    }
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

// [LFU用]対象S3のprefixから、Keyとdescriptionを取得.
// s3BucketName 対象のS3Bucket名を設定します.
// key base64変換されているKeyを設定します.
// 戻り値: {key: "", description: ""} が返却されます.
const getS3ToKeyAndDescription = async function(s3BucketName, key) {
    // s3BucketNameはstring必須で情報存在が必須.
    if(!(typeof(s3BucketName) == "string" && s3BucketName.length > 0)) {
        throw new Error("s3BucketName must be a string.");
    }
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    // s3から情報を取得.
    const result = await getS3Client().getObject({
        Bucket: s3BucketName,
        Key: OUTPUT_PREFIX() + "/" + key
    });
    // keyとdescriptionのJSON返却.
    return {
        key: getS3PrefixToKey(key),
        description: getBodyJsonToDescription(
            JSON.parse(Buffer.from(result).toString()))
    };
}

// 指定Keyからvalue要素以外の内容を取得.
// s3BucketName 対象のS3Bucket名を設定します.
// key base64変換されていないKeyを設定します.
// 戻り値: {key: "", description: ""} が返却されます.
const getValue = async function(s3BucketName, key) {
    return await getS3ToKeyAndDescription(s3BucketName,
        Buffer.from(key).toString("base64"));
}

// [LFU用]生成したsecrets managerのValueをS3にUpload.
// s3BucketName 対象のS3Bucket名を設定します.
// key secretsManagerに登録するKey名を文字列で設定します.
// jsonValue JSON暗号加工された内容を設定します.
// 戻り値: trueの場合、無事更新されました.
const outputS3 = async function(s3BucketName, key, jsonValue) {
    // s3BucketNameはstring必須で情報存在が必須.
    if(!(typeof(s3BucketName) == "string" && s3BucketName.length > 0)) {
        throw new Error("s3BucketName must be a string.");
    }
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    // prefixKeyはbase64変換.
    const prefixKey = Buffer.from(key).toString("base64");
    // 送信処理.
    return await getS3Client().putObject({
        Bucket: s3BucketName,
        Key: OUTPUT_PREFIX() + "/" + prefixKey,
        Body: jsonValue
    });
}

// [LFU用]secrets managerから削除.
// s3BucketName 対象のS3Bucket名を設定します.
// key secretsManagerに登録するKey名を文字列で設定します.
// 戻り値: trueの場合、無事削除されました.
const removeS3 = async function(s3BucketName, key) {
    // s3BucketNameはstring必須で情報存在が必須.
    if(!(typeof(s3BucketName) == "string" && s3BucketName.length > 0)) {
        throw new Error("s3BucketName must be a string.");
    }
    // keyはstring必須で情報存在が必須.
    if(!(typeof(key) == "string" && key.length > 0)) {
        throw new Error("key must be a string.");
    }
    // prefixKeyはbase64変換.
    const prefixKey = Buffer.from(key).toString("base64");
    // 削除処理.
    return await getS3Client().deleteObject({
        Bucket: s3BucketName,
        Key: OUTPUT_PREFIX() + "/" + prefixKey
    });
}

// s3リストを取得.
const _listGet = async function(out, params) {
    const list = await getS3Client().listObjects(params);

    // レスポンスステータスが400以上の場合エラー.
    if(params.response.status >= 400) {
        throw new Error("[ERROR: " + response.status +
            "]getList bucket: " + bucket +
            " prefix: " + params.Prefix);
    }
    // 取得リストに対してKeyとdescriptionを取得してセット.
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        const key = list[i].substring(params.Prefix.length + 1);
        out[out.length] = await getS3ToKeyAndDescription(
            params.Bucket, key);
    }
    // 次のMarkerを返却.
    return params.response.header["x-next-marker"];
}

// [LFU用]secrets manager 一覧を取得.
// s3BucketName 対象のS3Bucket名を設定します.
// 戻り値: [{key: string, description: string}, ...]
//   - key key名が格納されます.
//   - description 説明が格納されます. 
const listS3 = async function(s3BucketName) {
    // 基本的なパラメータをセット.
    const outputPrefix = OUTPUT_PREFIX();
    const params = {
        Bucket: s3BucketName,
        Prefix: outputPrefix,
        MaxKeys: 10,
        delimiter: "/" + outputPrefix + "/",
        KeyOnly: true
    };
    // リストを格納するための情報を生成.
    const ret = [];
    // リスト一覧が取得完了までループ.
    while(true) {
        const marker = await _listGet(ret, params);
        if(marker == "false") {
            // 次のmarkerが存在しない場合は返却処理.
            return ret;
        }
        params.response = null;
        params.Marker = marker;
    }
}

// 出力.
const p = function(s) {
    console.log.apply(null, arguments);
}

// ヘルプ.
const help = function() {
    p("Usage: %s [OPTION]...", COMMAND_NAME);
    p("Performs SecretsManager registration management for LFU.");
    p("The value registered in Secret is packed using LFU's strong encryption process.")
    p("");
    p("-t or --type: [Required]Set the processing type.")
    p("    generate: Generate a new Secret.")
    p("       -k or --key:         [Required]Set the key to register.")
    p("       -v or --value:       [Required]Set the value to register.")
    p("       -d or --description: [Optional]Set a description.")
    p("       -b or --bucket:      [Optional]Set the S3Bucket name to be registered.")
    p("         Required if the environment variable `MAIN_S3_BUCKET` is not set.")
    p("")
    p("   embed: Create the embed code.");
    p("       -k or --key:         [Required]Set the key to register.")
    p("       -v or --value:       [Required]Set the value to register.")
    p("       -b or --bucket:      [Optional]Set the S3Bucket name to be registered.")
    p("         Required if the environment variable `MAIN_S3_BUCKET` is not set.")
    p("")
    p("   list: Display a list of registered secrets.")
    p("       -b or --bucket:      [Optional]Set the S3Bucket name to register.")
    p("         Required if the environment variable `MAIN_S3_BUCKET` is not set.")
    p("")
    p("   get: Gets the contents of the specified SecretKey.")
    p("       -k or --key:         [Required]Set the key to register.")
    p("       -b or --bucket:      [Optional]Set the S3Bucket name to register.")
    p("         Required if the environment variable `MAIN_S3_BUCKET` is not set.")
    p("")
    p("   delete: Delete registered Secret.")
    p("       -k or --key:         [Required]Set the key to register.")
    p("       -b or --bucket:      [Optional]Set the S3Bucket name to register.")
    p("         Required if the environment variable `MAIN_S3_BUCKET` is not set.")
}

// プロセス終了
const _exit = function(code) {
    process.on("exit", function() {
        process.exit(code);
    });
}

// エラー出力.
const error = function() {
    console.error.apply(null, arguments);
    _exit(1);
}

// コマンド実行.
const command = async function() {
    try {
        // ヘルプ呼び出し.
        if(args.isValue("-h", "--help")) {
            help();
            _exit(0);
            return;
        }

        // typeを取得.
        let type = args.get("-t", "--type");
        if(type == null || type == "") {
            // 設定されてない場合.
            error("[ERROR]Processing type not set.");
            return;
        }
        type = type.trim().toLowerCase();

        // S3Bucket名が設定されているか.
        let s3Bucket = args.get("-b", "--bucket");
        if(s3Bucket == null || s3Bucket == "") {
            // 環境変数に登録されている内容を利用する.
            s3Bucket = process.env[ENV_MAIN_S3_BUCKET];
            if(s3Bucket == undefined) {
                error("[ERROR]The S3Bucket name to be registered as a secret has not been set.")
                return;
            }
        }

        // secretsManagerに登録.
        if(type == "generate") {
            // 引数を取得.
            const key = args.get("-k", "--key");
            const value = args.get("-v", "--value");
            if(key == null || key == "") {
                error("Key setting is required.");
                return;
            }
            if(value == null || value == "") {
                error("Value setting is required.");
                return;
            }
            let description = args.get("-d", "--description");
            if(description == null || description == "") {
                description = "";
            }
            // json変換.
            const json = createJSON(key, value, description);
            // S3に登録.
            await outputS3(s3Bucket, key, json);
            p("[SUCCESS]Generation and registration completed successfully.")
            return;
        }

        // 埋め込みコードを生成.
        if(type == "embed") {
            // 引数を取得.
            const key = args.get("-k", "--key");
            const value = args.get("-v", "--value");
            if(key == null || key == "") {
                error("Key setting is required.");
                return;
            }
            if(value == null || value == "") {
                error("Value setting is required.");
                return;
            }
            // 埋め込みコードを生成.
            const result = createEmbedCode(key, value);
            p(result);
            return;
        }

        // secretsManagerに登録.
        if(type == "list") {
            const result = await listS3(s3Bucket)
            p(JSON.stringify(result, null, "  "));
            return;
        }

        // 1つのsecret内容を取得.
        if(type == "get") {
            // 引数を取得.
            const key = args.get("-k", "--key");
            if(key == null || key == "") {
                error("Key setting is required.");
                return;
            }
            try {
                const result = await getValue(s3Bucket, key)
                p(JSON.stringify(result, null, "  "));
            } catch(e) {
                error("[ERROR]Retrieval failed.")
            }
            return;
        }

        // 1つのsecret内容を取得.
        if(type == "get") {
            // 引数を取得.
            const key = args.get("-k", "--key");
            if(key == null || key == "") {
                error("Key setting is required.");
                return;
            }
            try {
                const result = await getValue(s3Bucket, key)
                p(JSON.stringify(result, null, "  "));
            } catch(e) {
                error("[ERROR]Retrieval failed.")
            }
            return;
        }

        // 1つのsecret内容を削除.
        if(type == "delete") {
            // 引数を取得.
            const key = args.get("-k", "--key");
            if(key == null || key == "") {
                error("Key setting is required.");
                return;
            }
            try {
                const result = await removeS3(s3Bucket, key)
                p("[SUCCESS]Removed: " + result);
            } catch(e) {
                error("[ERROR]Retrieval failed.")
            }
            return;
        }

        // バージョン呼び出し.
        if(args.isValue("-v", "--version")) {
            const pkg = require("./package.json");
            p(pkg.version);
            _exit(0);
            return;
        }
        
        // それ以外.
        error("[ERROR]Unsupported type specification: " + type);

    } catch(e) {
        // エラー出力.
        error("[ERROR]", e);
    }
}

// コマンド実行.
command();

})();