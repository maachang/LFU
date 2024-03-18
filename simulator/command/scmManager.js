// [command]secretsManager(管理用).
//
(function() {
'use strict';

// コマンド引数用.
const args = require("../modules/args.js");

// util.
const util = require("../modules/util/util.js");

// secretManager.
const scmMan = require("../../src/lib/scmManager.js");

// lfu用SecretsManagerコマンド名.
const COMMAND_NAME = "lfuscm";

// プロセス終了
const _exit = function(code) {
    process.on("exit", function() {
        process.exit(code);
    });
}

// 出力.
const p = function() {
    console.log.apply(null, arguments);
}

// エラー出力.
const error = function() {
    console.error.apply(null, arguments);
    _exit(1);
}

// secretJSON情報を表示.
// json secretJSON情報を設定します.
const _getSecretView = function(json) {
    p("[SUCCESS]\n" +
        JSON.stringify(json, null, "  "));
}

// 新しいSecret登録を行います.
// secret secret名を設定します.
// description 説明を設定します.
// json secret化するkey, value情報を連想配列で設定します.
// 戻り値: trueの場合、正常に登録されました.
const create = async function(secret, description, json) {
    try {
        // 生成処理.
        await scmMan.create(secret, description, null, json);
        // 正常に処理が成功した場合、登録結果を出力.
        return await get(secret);
    } catch(e) {
        error(
            "[ERRPR]Creation of specified secret " +
            secret + " failed.", e);
    }
    return false;
}

// 新しい組み込みsecretコードを生成します.
// ※埋め込みコードなので、S3に保存されずに、Lambdaの環境変数埋め込み対応
//   で利用される事が想定されます.
// secret secret名を設定します.
// value value情報を設定します.
// 戻り値: trueの場合、正常に処理されました.
const createEmbedCode = function(secret, value) {
    try {
        // 組み込みコードを生成.
        const result = scmMan.createEmbedCode(secret, value);
        // 生成できたものを表示する.
        p(result);
        return true;
    } catch(e) {
        error("[ERROR]secret embed code creation failed.", e);
    }
    return false;
}

// secretの削除.
// secret secret名を設定します.
// 戻り値: trueの場合削除に成功しまし.
const remove = async function(secret) {
    try {
        if(await scmMan.remove(secret)) {
            p("[SUCCESS]Target secret Deletion successful.");
            return true;
        } else {
            console.warn(
                "[WARN]Secret " + secret + " does not exist.");
        }
    } catch(e) {
        error(
            "[ERROR]Target secret Deletion failed.", e);
    }
    return false;
}

// 指定Keyからvalue意外の内容(key, description)を取得.
// secret secret名を設定します.
// 戻り値: trueの場合、取得に成功しました.
const get = async function(secret) {
    try {
        const json = await scmMan.get(secret);
         _getSecretView(json);
        return true;
    } catch(e) {
        error("[ERRPR]Target secret does not exist.", e);
    }
    return false;
}

// 登録Secret一覧を取得.
// detail trueの場合、Secret毎の詳細情報を含めて表示とします.
//        false および指定なしの場合は、Secretキー名だけを表示します.
// 戻り値: trueの場合、取得に成功しました.
const list = async function(detail) {
    try {
        let i, len, marker, off = 0, max = 50;
        let list = [];
        while(true) {
            const n = await scmMan.list(
                off, max, marker);
            const lst = n.list;
            len = lst.length;
            for(i = 0; i < len; i ++) {
                list[list.length] = lst[i];
            }
            off += len;
            marker = n.marker;
            if(len == 0 || marker == null) {
                break;
            }
        }
        // 詳細を取得.
        if(detail == true) {
            const n = [];
            len = list.length;
            for(i = 0; i < len; i ++) {
                // Secret表示用として詳細を取得.
                n[n.length] = await scmMan.get(list[i]);
            }
            list = n;
        }
        // JSON出力.
        p("[SUCCESS]\n" +
            JSON.stringify(list, null, "  "));
        return true;
    } catch(e) {
        error("[ERROR]Failed to get user list.", e);
    }
    return false;
}

// ヘルプ.
const help = function() {
    p("Usage: %s [OPTION]...", COMMAND_NAME);
    p("Performs SecretsManager registration management for LFU.");
    p("The value registered in Secret is packed using LFU's strong encryption process.")
    p("");
    p("  --profile Set the Profile name you want to use in ~/.lfu.env.json.")
    p("");
    p("Set execution subcommand [generate] [embed] [list] [get] [remove].")
    p("> " + COMMAND_NAME + " [Set execution subcommand]")
    p("  generate: Generate a new Secret.")
    p("    If you wish to update, please regenerate.")
    p("       -s or --secret:      [Required]Set the key to register.")
    p("       -d or --description: [Optional]Set a description.")
    p("       -k or --key:         *At least one definition is required.")
    p("       -v or --value:       *At least one definition is required.")
    p("         > -k hoge -v abcdefg -k moge -v xyz")
    p("           secretValue will be json={hoge:'abcdefg', moge: 'xyz'}.")
    p("       -f or --force:       [Optional]Set when overwriting registration.")
    p("")
    p("  embed: Create the embed code.");
    p("       -s or --secret:      [Required]Set the key to register.")
    p("       -v or --value:       [Required]Set the value to register.")
    p("")
    p("  list: Display a list of registered secrets.")
    p("       -d or --detail:      [Optional]If this content is defined, output")
    p("                                      user detailed information.")
    p("")
    p("  get: Gets the contents of the specified SecretKey.")
    p("       -s or --secret:      [Required]Set the key to register.")
    p("")
    p("  remove: Delete registered Secret.")
    p("       -s or --secret:      [Required]Set the key to register.")
    p()
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

        // 実行副コマンドを取得.
        let type = args.get(0);
        if(type == null || type == "") {
            // 設定されてない場合.
            //error("[ERROR]Execution subcommand not set.");
            // エラー+helpを出力.
            help()
            _exit(1);
            return;
        }
        type = type.trim().toLowerCase();

        // ${HOME}/.lfu.env.json を反映する.
        require("../lfuEnv.js")
            .reflection(args.get("--profile"));

        // 必須環境変数が定義されているかチェック.
        if(!util.requireEnv(["MAIN_S3_BUCKET"])) {
            _exit(1);
            return;
        }

        // secretsManagerに登録.
        if(type == "generate" || type == "create") {
            // 引数を取得.
            const secret = args.get("-s", "--secret");
            let description = args.get("-d", "--description");
            // value登録情報群を取得.
            // -k xxx -v yyy -k zzz -v abc
            //  > json: {xxx: yyy, zzz abc}
            //    となる.
            let k, v;
            const jsonValue = {};
            let cnt = 0;
            while(true) {
                // key: value情報を取得.
                k = args.next(cnt, "-k", "--key");
                v = args.next(cnt, "-v", "--value");
                // key及びvalueが存在しない場合は処理を終了.
                if(k == null || v == null) {
                    break;
                }
                // JSON追加.
                jsonValue[k] = v;
                cnt ++;
            }
            // 上書き指定でない場合.
            if(!args.isValue("-f", "--force")) {
                // secretKeyが既に登録されている場合はエラー.
                let use = false;
                try {
                    await scmMan.get(secret);
                    use = true
                } catch(e) {
                    use = false;
                }
                if(use) {
                    error("[ERROR]The specified SecretKey(" +
                        secret + ") already exists.")
                    return;
                }
            }
            // 登録処理.
            const result = create(secret, description, jsonValue);
            if(result) {
                _exit(0);
            }
            return;
        }

        // 埋め込みコードを生成.
        if(type == "embed" || type == "embedded") {
            // 引数を取得.
            const secret = args.get("-s", "--secret");
            const value = args.get("-v", "--value");
            // 埋め込みコードを生成.
            const result = createEmbedCode(secret, value);
            if(result) {
                _exit(0);
            }
            return;
        }

        // secretsManagerに登録.
        if(type == "list" || type == "ls") {
            // 引数を取得.
            const detail = args.isValue("-d", "--detail");
            const result = await list(detail);
            if(result) {
                _exit(0);
            }
            return;
        }

        // 1つのsecret内容を取得.
        if(type == "get") {
            // 引数を取得.
            const secret = args.get("-s", "--secret");
            const result = get(secret);
            if(result) {
                _exit(0);
            }
            return;
        }

        // 1つのsecret内容を削除.
        if(type == "remove" || type == "delete") {
            // 引数を取得.
            const secret = args.get("-s", "--secret");
            const result = remove(secret);
            if(result) {
                _exit(0);
            }
            return;
        }

        // バージョン呼び出し.
        if(args.isValue("-v", "--version")) {
            const pkg = require("../package.json");
            p(pkg.version);
            _exit(0);
            return;
        }
        
        // それ以外.
        error("[ERROR]Execution subcommand not set: " + type);

    } catch(e) {
        // エラー出力.
        error("[ERROR]", e);
    }
}

// コマンド実行.
command();

})();