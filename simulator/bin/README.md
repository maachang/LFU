# 利用に対する説明.

## ローカルでLFUコマンドを利用する設定方法.

ローカル環境に対して、1度この設定を行う必要がある.

1. LFU_HOME の環境変数を定義する<br>
  githubRepogitory LFU の展開先のディレクトリを設定する.
2. $LFU_HOME/simulator/bin をPATHに登録する

### 設定例

.profile
~~~sh
export LFU_HOME=$HOME/project/LFU
export PATH=$LFU_HOME/simulator/bin:$PATH
~~~

これによって、ローカルからのLFUコマンドの実行が行える.

## コマンドに対する環境変数切り替え定義.

LFUコマンドに対する環境切り替え用の定義について説明する.

以下のディレクトリに以下のファイルを作成して以下の形で定義する.

~/.lfu.env.json
~~~json
{
    "default": {
        "AWS_ACCESS_KEY_ID": "[デフォルト]aws IAM UserのAccessKey",
        "AWS_SECRET_ACCESS_KEY": "[デフォルト]aws IAM UserのSecretAccessKey",
        "AWS_SESSION_TOKEN": "[デフォルト]awsのSSOログイン等での一時的セッショントークン",
        "AWS_DEFAULT_REGION": "[デフォルト]aws IAM UserのMainリージョン設定(default=ap-northeast-1)",
        "MAIN_S3_BUCKET": "[デフォルト]s3Kvs出力先のS3Bucket名",
        "S3_KVS_PREFIX": "[デフォルト]s3Kvs出力先のS3Prefix",
        "S3_SCM_PREFIX": "[デフォルト]secrityManager出力先Prefix",
        "S3_AUM_PREFIX": "[デフォルト]authUserManager出力先Prefix",
    },
    "profile1": {
        "AWS_ACCESS_KEY_ID": "[profile1用]aws IAM UserのAccessKey",
        "AWS_SECRET_ACCESS_KEY": "[profile1用]aws IAM UserのSecretAccessKey",
        "AWS_SESSION_TOKEN": "[profile1用]awsのSSOログイン等での一時的セッショントークン",
        "AWS_DEFAULT_REGION": "[profile1用]aws IAM UserのMainリージョン設定(default=ap-northeast-1)",
        "MAIN_S3_BUCKET": "[profile1用]s3Kvs出力先のS3Bucket名",
        "S3_KVS_PREFIX": "[profile1用]s3Kvs出力先のS3Prefix",
        "S3_SCM_PREFIX": "[profile1用]secrityManager出力先Prefix",
        "S3_AUM_PREFIX": "[profile1用]authUserManager出力先Prefix",
    }
}
~~~

LFUのコマンド引数で --profile [profile名] を指定することで、コマンド実行時のプロファイルを選択することができる.

また --profile を定義してない場合は `"default"` が対象となる.

また、趣旨としてこのファイルはローカル環境で定義となり、githubRepogitoryのファイルじゃ無い為、AWSのCredentialの定義が行える.


