#!/usr/bin/env node

/*!
 * lfu-simulator(LFU[Lambda function URLs] Simulator).
 * Copyright(c) 2022 maachang.
 * MIT Licensed
 */
(function(_g) {
'use strict';

// cluster.
const cluster = require("cluster");

// プログラム(node)引数.
const args = require("./modules/args.js");

// 定数定義.
const cons = require("./constants.js");

// クラスタ実行の場合、コマンド実行を行う.
if(cluster.isMaster) {
    
    //////////////////////////////////////////
    // コマンド引数処理.
    //////////////////////////////////////////

    // バージョン表示.
    if(args.isValue("-v", "--version")) {
        require("./help.js").version();
        return;
    // ヘルプ表示.
    } else if(args.isValue("-h", "--help")) {
        require("./help.js").print();
        return;
    // アクセスキーを生成.
    } else if(args.isValue("--keygen")) {
        const ret = require("./confenv.js").getKeyCode(
            args.get("-k", "--key"),
            args.get("-p", "--pass")
        );
        console.log("access key : %s", ret.key);
        console.log("access path: %s", ret.pass);
        return;
    // confEnvファイルの暗号化.
    } else if(args.isValue("--encode")) {
        const ret = require("./confenv.js").encodeCipherConfEnv(
            args.get("-f", "--file"),
            args.get("-k", "--key"),
            args.get("-p", "--pass")
        );
        console.log("success.");
        console.log("src : %s", ret.src);
        console.log("dest: %s", ret.dest);
        return;
    // confEnvファイルの復号化.
    } else if(args.isValue("--decode")) {
        const ret = require("./confenv.js").decodeCipherConfEnv(
            args.get("-f", "--file"),
            args.get("-k", "--key"),
            args.get("-p", "--pass")
        );
        console.log("success.");
        console.log("src : %s", ret.src);
        console.log("dest: %s", ret.dest);
        return;
    // 乱数発行を行う.
    } else if(args.isValue("-g", "--gen")) {
        // nums取得.
        const nums = require("./modules/util/nums.js");
        // nanoTimeを取得.
        const key = nums.getNanoTime();
        // 乱数作成.
        const rand = nums.Xor128(key);
        let len = key & 0x01f;
        for(let i = 0; i < len; i ++) {
            rand.next();
        }
        // 乱数の長さを取得.
        len = args.get("-l", "--len");
        if(!nums.isNumeric(len)) {
            // 乱数の長さは28文字.
            len = cons.DEF_RANDOM_BINARY;
        } else {
            // 指定された内容を数字変換.
            len = parseInt(len);
            if(len <= 0) {
                // 長さが0以下の場合.
                len = cons.DEF_RANDOM_BINARY;
            }
        }
        const bin = rand.getBytes(len);
        // 変換タイプを取得.
        let type = args.get("-t", "--type");
        if(type == "base64") { 
            console.log(bin.toString("base64"));
        } else {
            console.log(bin.toString("hex"));
        }
        return;
    }
}

//////////////////////////////////////////
// lfuシミュレーター実行処理.
//////////////////////////////////////////

// ユーティリティ.
const util = require("./modules/util/util.js");

// lfuPath.
let lfuPath = null;

// confEnv条件を取得.
// profile ${HOME}/.lfu.env.json 定義で利用したいprofile名を設定します.
const requireConfEnv = function(profile) {
    // ${HOME}/.lfu.env.json を反映する.
    require("./lfuEnv.js").reflection(profile);
    // ./lfu.env.json を反映する.
    const confEnv = require("./confenv.js");
    confEnv.loadConfEnv();
}

// [環境変数]LFU_PATHを取得.
const getLfuPath = function() {
    // lfuパスを取得.
    lfuPath = util.getEnv(cons.ENV_LFU_PATH);
    if(typeof(lfuPath) != "string") {
        // lfuパスが設定されていない場合エラー.
        throw new Error("lfu path(ENV: " +
            cons.ENV_LFU_PATH + ") is not set.");
    }
    // LFUPathの環境変数対応.
    if(lfuPath.endsWith("/")) {
        lfuPath = lfuPath.substring(0, lfuPath.length - 1);
    }
    return lfuPath;
}
 
// [環境変数]MAIN_EXTERNALを取得.
const getMainExternal = function() {
    // mainExternalを取得.
    const mainExternal = util.getEnv("MAIN_EXTERNAL");
    if(mainExternal == undefined || mainExternal == null) {
        // MAIN_EXTERNAL が設定されていない場合エラー.
        throw new Error(
            "\"MAIN_EXTERNAL\" environment variable is not set.")
    }
    return mainExternal.trim().toLowerCase();;
}

// confEnvをロード.
const loadConfEnv = function() {
    // confEnv条件を取得.
    requireConfEnv(args.get("--profile"));

    // mainExternalを取得.
    const mainExternal = getMainExternal();

    // lfuパスを取得.
    getLfuPath();

    // s3の場合.
    if(mainExternal == "s3") {
        if(process.env["S3_CONNECT"] == undefined ||
            process.env["S3_CONNECT"] == null) {
            process.env["S3_CONNECT"] = "$requirePath,$region";
        }
    // gitの場合.
    } else if(mainExternal == "git") {
        if(process.env["GIT_CONNECT"] == undefined ||
            process.env["GIT_CONNECT"] == null) {
            // ダミーセット.
            process.env["GIT_CONNECT"] =
                "$organization,$repo,$branch,$requirePath,$token";
        }
    }
}

// logger設定をロード.
const loadLogger = function() {
    // ログ初期化.
    const logger = require("./modules/logger.js");
    // ログ設定.
    logger.setting({
        dir: util.getEnv(cons.ENV_LOGGER_DIR),
        file: util.getEnv(cons.ENV_LOGGER_NAME),
        level: util.getEnv(cons.ENV_LOGGER_LEVEL)
    });
}

// 初期処理.
const loadInit = function() {
    // confEnvをロード.
    loadConfEnv();
    
    // ログ初期化.
    loadLogger();
}

// クラスター起動.
const startupCluster = function() {

    /////////////////////////////////
    // 未設定条件が存在するかチェック.
    /////////////////////////////////

    // confEnv条件を取得.
    requireConfEnv();
    // mainExternalを取得.
    getMainExternal();
    // lfuパスを取得.
    getLfuPath();

    // ワーカー数を取得.
    let workerLen = args.get("-w", "--worker")|0;
    if(workerLen == 0) {
        // ワーカー数が設定されていない場合
        // cpu数をワーカー数とする.
        workerLen = require('os').cpus().length;
    }

    // ワーカー起動.
    for (let i = 0; i < workerLen; ++i) {
        cluster.fork();
    }

    // プロセスが落ちた時の処理.
    const _exitNodeJs = function() {
        console.log("## exit lfu-simurator");
        process.exit();
    };

    // node処理終了.
    process.on('exit', function() {
        console.log("exit");
    });

    // 割り込み系と、killコマンド終了.
    process.on('SIGINT', _exitNodeJs);
    process.on('SIGBREAK', _exitNodeJs);
    process.on('SIGTERM', _exitNodeJs);

    // クラスタプロセスが落ちた場合、再起動.
    cluster.on('exit', function () {
        console.debug("## cluster exit to reStart.");
        // 再起動.
        cluster.fork();
    });
}

// ワーカー起動.
const startWorker = function() {
    // 初期設定.
    loadInit();
    
    // バインドポート番号を取得.
    let bindPort = args.get("-p", "--port")|0;
    if(bindPort <= 0) {
        // デフォルトのバインドポートをセット.
        bindPort = cons.BIND_PORT;
    }

    // プロセス例外ハンドラ.
    process.on('uncaughtException', function(e) {
        console.trace("error uncaughtException", e);
    });

    // promise例外ハンドラ.
    process.on('unhandledRejection', function(rejection) {
        console.trace("error unhandledRejection", rejection);
    });

    // fakereqreg.jsを呼び出す.
    // 偽s3requireを定義.
    // 偽grequireを定義.
    require("./fakereqreg.js");

    // lfuweb.jsを呼び出す.
    require("./lfuweb.js").startup(
        lfuPath, bindPort);
}

/////////////////////
// クラスタ用プロセス.
/////////////////////
if (cluster.isMaster) {
    startupCluster();

/////////////////////
// ワーカープロセス.
/////////////////////
} else {
    // ワーカー起動.
    startWorker();
}

})(global);