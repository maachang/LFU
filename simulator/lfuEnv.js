// [ENV]ローカル環境共通変数定義.
// ${HOME}/.lfu.env.json のファイル定義内容を読み込み、それぞれのprofileに別れた定義を持って
// それらを指定できる形として、実行定義を分けれる形を元に、コマンド実行等で利用できるようにする.
// 
(function() {
'use strict';

/* ${HOME}/.lfu.env.json
~~~json
{
    "//": "デフォルトの定義内容.",
    "default": {
        "AWS_ACCESS_KEY_ID": "aws IAM UserのAccessKey",
        "AWS_SECRET_ACCESS_KEY": "aws IAM UserのSecretAccessKey",
        "AWS_SESSION_TOKEN": "awsのSSOログイン等での一時的セッショントークン",
        "AWS_DEFAULT_REGION": "aws IAM UserのMainリージョン設定(default=ap-northeast-1)",
        "MAIN_S3_BUCKET": "s3Kvs出力先のS3Bucket名",
        "S3_KVS_PREFIX": "s3Kvs出力先のS3Prefix",
        "S3_SCM_PREFIX": "secrityManager出力先Prefix",
        "S3_AUM_PREFIX": "authUserManager出力先Prefix",
            ・・・・(任意の環境変数を定義)
    },
    "//": "profile名定義指定毎の専用定義.",
    "{profile名}": {
        "AWS_ACCESS_KEY_ID": "aws IAM UserのAccessKey",
        "AWS_SECRET_ACCESS_KEY": "aws IAM UserのSecretAccessKey",
        "AWS_SESSION_TOKEN": "awsのSSOログイン等での一時的セッショントークン",
        "AWS_DEFAULT_REGION": "aws IAM UserのMainリージョン設定(default=ap-northeast-1)",
        "MAIN_S3_BUCKET": "s3Kvs出力先のS3Bucket名",
        "S3_KVS_PREFIX": "s3Kvs出力先のS3Prefix",
        "S3_SCM_PREFIX": "secrityManager出力先Prefix",
        "S3_AUM_PREFIX": "authUserManager出力先Prefix",
            ・・・・(任意の環境変数を定義)
    }
}
~~~
この定義の主な内容は環境変数定義をコマンド実行に対して置き換えるもの.
なのでこの定義が無くても、環境変数で定義している場合はそれらが使われる.

基本的にdefault定義に対して固有のprofile名の定義は「踏襲」となるので、profile定義
されて居ないものは、踏襲元の定義が利用可能となる。
また、defaultで定義されていない内容はLFUで定義されているデフォルト値を利用対象となる.

あとLFUからのCLI系コマンド実行やsimurator関連では、このコンフィグJSONを基本条件と
して共通利用される.

また、それ以外の環境変数を定義していても、差し替えができるようになる.

あと、定義のvalueに対して既存の環境変数が組み込めるので、この場合は
 - "xxxx/${YYYY}/zzz""
  とした場合、環境変数 YYYY="Hoge"なら
 - "xxxx/Hoge/zzz""
  このようになる.
ただ、同一定義内で利用している環境変数を埋め込むと認識順の関係でうまく当たらない場合があるので、注意が必要.
*/

// ローカルファイル操作用.
const fs = require('fs');

// ユーティリティ.
const util = require("./modules/util/util.js");

// 定義コンフィグファイル名[$HOME/.lfu.env.json].
const CONF_JSON_FILE = "/.lfu.env.json";

// [環境変数]定義コンフィグファイルRootパス.
const ENV_HOME = "HOME";

// 基本コンフィグ定義プロファイル名.
const DEFAULT_CONFIG_PROFILE_NAME = "default";

// ${HOME}/.lfu.env.json ファイルのJSON内容を取得.
// 戻り値: configJSONが返却されます.
const _loadJSON = function() {
    // ログインユーザのRootパスを環境変数から取得.
    let fileName = process.env[ENV_HOME];
    // ログインユーザのRootパスを環境変数取得が成功の場合.
    if(fileName != undefined) {
        // 読み込みファイルが存在するか確認.
        fileName += CONF_JSON_FILE;
        if(fs.existsSync(fileName)) {
            // ファイル内容を読み込んでJSONパースする.
            return JSON.parse(fs.readFileSync(fileName).toString());
        }
    }
    // 空を返却.
    return {};
}

// .lfu.env.json内容のprofileに対してENV内容に反映.
// profile コンフィグ定義プロファイル名を設定します.
// json .lfu.env.jsonファイルのJSONを設定します.
const _updateEnv = function(profile, json) {
    const target = json[profile];
    if(target == undefined) {
        return;
    }
    let v, t;
    for(let k in target) {
        t = typeof(v = target[k]);
        if(t == "string") {
            // 文字列の場合環境変数定義(${....})対応.
            process.env[k] = util.changeEnv("" + v);
        } else if(t == "number" || t == "boolean") {
            // 文字列意外の場合は環境変数対応しない.
            process.env[k] = "" + v;
        }
    }
}

// ${HOME}/.lfu.env.json 定義内容に対して環境変数を反映.
// profile 定義ファイルに対して、対象profile名を設定します.
const reflection = function(profile) {
    // defaultの読み込み.
    const value = _loadJSON();
    _updateEnv(DEFAULT_CONFIG_PROFILE_NAME, value);
    if(typeof(profile) == "string") {
        // profile内容の読み込み.
        _updateEnv(profile, value);
    }
}

////////////////////////////////////////////////////////////////
// 外部定義.
////////////////////////////////////////////////////////////////
exports.reflection = reflection;

})();
