// LFUをminify化して、zip変換.
//
// - linux上での実行を想定.
// - uglify-js(npm)を利用.
//   > npm -g install uglify-js
//     でインストール.
// - zipコマンドを利用.
//   > sudo apt install zip
//     でインストール.
//
(function() {
'use strict';

// コマンド実行.
const { execSync } = require("child_process");

// fs.
const fs = require("fs");

// LFUソースファイルリスト.
const LFU_SRC_LIST = ".lfuSrcList.JSON";

// minify用ディレクトリ.
const MINIFY_DIR = ".minSrc";

// コマンド名.
const COMMAND_NAME = "minifyLfu";

// 文字列出力.
const p = function(v) {
    console.log(v);
}

// 起動パラメータで設定されたパスを取得.
// 戻り値: パスが返却されます.
const getPath = function() {
    // 対象パスを取得.
    let path = process.argv[2];
    // パスが設定されてない場合はhelp.
    if(path == undefined) {
        // help表示.
        p("Usage: " + COMMAND_NAME + " [OPTION]...");
        p(" This is a command to zip the LFU source code and minify the js.");
        p("[OPTION]:")
        p("  path: Set the current directory name of LFU.");
        p("        Normally, set . to change the current directory of LFU.")
        p("  notMinify: By setting true, yes, on, ok, it will be zipped without compression.");
        p("[example]")
        p(" $ cd LFU")
        p(" $ " + COMMAND_NAME + " .");
        p(" # rmdir: ./.minSrc");
        p(" mkdir: ./.minSrc");
        p(" > [base]src/LFUSetup.js");
        p(" > [base]src/freqreg.js");
        p(" > [base]src/greqreg.js");
        p(" ・・・・・・・");
        p("");
        p("The lfu.zip file has been created.");
        p("");
        return undefined;
    }

    // 0x0d, 0x0d が終端に設定されている場合.
    // ※どうやらLinux上でcrlf改行(￥r￥n)のbashファイルから呼び出した場合
    //   プロセスパラメータ(process.argv)の最後0x0d, 0x0dが入る
    //   みたい.
    let bpath = Buffer.from(path);
    if(bpath.length >= 2 &&
        bpath[bpath.length -1] == 0x0d && bpath[bpath.length - 2] == 0x0d) {
        path = path.substring(0, path.length - 2);
    }
    bpath = null;

    // パスが設定されていません.
    if(path == undefined) {
        throw new Error("Target path is not set.");

    // LFUソースリストが指定パスに存在しない場合.
    } else if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
        throw new Error("The file '" + LFU_SRC_LIST +
            "' does not exist in the target path '" +
            path + "'.");
    }
    
    // パスの最後のスラッシュを削除.
    if(path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    return path;
}

// notMinify指定かチェック.
const getNotMinify = function() {
    // notMinifyを取得(minifyLfu path {ここのパラメータ}).
    let notMinify = process.argv[3];
    if(notMinify == undefined) {
        return false;
    }
    notMinify = notMinify.toLowerCase();
    return notMinify == "true" || notMinify == "yes" ||
        notMinify == "on" || notMinify == "ok";
}

// ディレクトリ作成.
// srcの最下層を除いた形でディレクトリを作成します.
// path 対象の基本パスを設定します.
// src 対象のディレクトリやファイルを設定します.
const mkdirToCutFileName = function(path, src) {
    const p = src.lastIndexOf("/");
    if(p == -1) {
        return false;
    }
    const dir = src.substring(0, p);
    try {
        // mkdirsで作成する.
        fs.mkdirSync(path + "/" + dir,
            { recursive: true });
    } catch(e) {
        return false;
    }
}

// .lfuSrcList.JSONファイルを取得.
// path 対象の基本パスを設定します.
// 戻り値 JSONの内容が返却されます.
const loadLfuSrcListJsonFile = function(path) {
    // 指定ファイルが存在しない場合.
    if(!fs.existsSync(path + "/" + LFU_SRC_LIST)) {
        throw new Error("The specified file "
            + path + "/" + LFU_SRC_LIST + " does not exist.");
    }
    // ファイル情報を取得.
    let srcList = fs.readFileSync(
        path + "/" + LFU_SRC_LIST).toString();
    // リスト一覧.
    return JSON.parse(srcList); 
}

// コマンドでjsのminify実行.
// path 対象の基本パスを設定します.
// jsName ディレクトリ名＋jsファイル名を設定します.
// moveDir 移動先のディレクトリ名(path + "/" + moveDir)
//         の条件を設定します.
const cmdMimify = function(path, jsName, moveDir) {
    // コピー先のディレクトリを作成.
    mkdirToCutFileName(path, moveDir + "/" + jsName);
    // minifyする.
    // > uglifyjs <input js file> --compress drop_console=true
    //   --mangle -o <js.min file>
    execSync("uglifyjs " + path + "/" + jsName +
        " --compress drop_console=true --mangle -o " +
        path + "/" + moveDir + "/" + jsName);
}

// コマンドでファイルのコピー実行.
// path 対象の基本パスを設定します.
// fileName ディレクトリ名＋jsファイル名を設定します.
// moveDir 移動先のディレクトリ名(path + "/" + moveDir)
//         の条件を設定します.
const cmdCopy = function(path, fileName, moveDir) {
    // コピー先のディレクトリを作成.
    mkdirToCutFileName(path, moveDir + "/" + fileName);
    // ファイルをコピーする.
    execSync("cp " + path + "/" + fileName + " " +
        path + "/" + moveDir + "/" + fileName);
}


// .lfuSrcList.JSONのjsファイルをミニファイする.
// path 対象の基本パスを設定します.
// srcList loadLfuSrcListJsonFile で取得した内容を設定します.
const executeMinify = function(path, srcList, notMinify) {
    notMinify = notMinify == true;
    console.log("# notMinify: " + notMinify);
    // minify出力先のディレクトリを作成.
    try {
        // 一旦.minSrcディレクトリを削除(rmコマンドで削除).
        console.log("# rmdir: " + (path + "/" + MINIFY_DIR));
        execSync("rm -Rf " + path + "/" + MINIFY_DIR);
    } catch(e) {
        console.warn(e)
    }
    try {
        // .minSrcディレクトリを作成.
        console.log("# mkdir: " + (path + "/" + MINIFY_DIR));
        fs.mkdirSync(path + "/" + MINIFY_DIR);
    } catch(e) {
        console.warn(e)
    }

    // [base]minify.
    const baseList = srcList.base;
    let len = baseList.length;
    for(let i = 0; i < len; i ++) {
        // 指定ファイルが存在しない場合.
        if(!fs.existsSync(path + "/" + baseList[i])) {
            throw new Error("[base]The specified file "
                + path + "/" + baseList[i] + " does not exist.");
        }
        // js ファイルのみminify化.
        if(baseList[i].trim().toLowerCase().endsWith(".js")) {
            // jsをminifyしない場合.
            if(notMinify == true) {
                cmdCopy(path, baseList[i], MINIFY_DIR);
            // jsをminifyする場合.
            } else {
                cmdMimify(path, baseList[i], MINIFY_DIR);
            }
        } else {
            cmdCopy(path, baseList[i], MINIFY_DIR);
        }
        console.log("> [base]" + baseList[i]);
    }

    if(len > 0) {
        console.log();
    }

    // [@public]minify or copy.
    const atPublicList = srcList["@public"];
    len = atPublicList.length;
    for(let i = 0; i < len; i ++) {
        // 指定ファイルが存在しない場合.
        if(!fs.existsSync(path + "/" + atPublicList[i])) {
            throw new Error("[@public]The specified file "
                + path + "/" + atPublicList[i] + " does not exist.");
        }
        // js ファイルのみminify化.
        if(atPublicList[i].trim().toLowerCase().endsWith(".js")) {
            cmdMimify(path, atPublicList[i], MINIFY_DIR);
        } else {
            cmdCopy(path, atPublicList[i], MINIFY_DIR);
        }
        console.log("> [@public]" + atPublicList[i]);
    }

    if(len > 0) {
        console.log();
    }

    // [costom]minify.
    let count = 0;
    const costomList = srcList.custom;
    len = costomList.length;
    for(let i = 0; i < len; i ++) {
        // 指定ファイルが存在しない場合.
        if(!fs.existsSync(path + "/" + costomList[i])) {
            // 存在しない場合は処理しない.
            continue;
        }
        // js ファイルのみminify化.
        if(costomList[i].trim().toLowerCase().endsWith(".js")) {
            cmdMimify(path, costomList[i], MINIFY_DIR);
        } else {
            cmdCopy(path, costomList[i], MINIFY_DIR);
        }
        console.log("> [costom]" + costomList[i]);
        count ++;
    }

    // costom条件が１件でも処理された場合.
    if(count > 0) {
        console.log();
    }

    // minifyした内容をzip化する.
    // > cd ../.minSrc/src; zip archive -r ./
    console.log("> zip");
    execSync("cd " + path + "/" + MINIFY_DIR + "/src" + "; zip archive -r ./");
    console.log();

    // zip化したものを移動.
    console.log("> lfu.zip");
    execSync("mv " + path + "/" + MINIFY_DIR + "/src/archive.zip " + path + "/lfu.zip");
    console.log();
}

// 引数条件取得.
const path = getPath();
if(path == undefined) {
    return;
}
// minify条件を取得.
const notMinify = getNotMinify();
// 対象リストを取得.
const srcList = loadLfuSrcListJsonFile(path);
// 実行処理.
executeMinify(path, srcList, notMinify);

})();
