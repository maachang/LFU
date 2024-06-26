# LFU環境変数説明

以下LFUで必要な環境変数について説明します.<br>
LFUではWebアプリの定数定義のような感じで環境変数を利用しています.

## 1. AWS IAM Credential関連

Lambda側では特に設定する必要はありません.<br>
simurator利用時に設定しておけば、対象AWSリソースにアクセスできるのでこの時に設定する必要があります.<br>
またこれらの定義は `~/.lfu.env.json` に定義する事を推奨します.<br>
詳しくは [こちら](xxx) に詳しく説明しています.

|変数名|設定内容|説明|
|:---|:---|:---|
|AWS_ACCESS_KEY_ID|string|AWS IAM権限のAccessKey|
|AWS_SECRET_ACCESS_KEY|string|AWS IAM権限のSecretAccessKey|
|AWS_SESSION_TOKEN|string|一時的なCredentialの場合はセット|

## 2. LFU基本設定

LFUをAWS Lambdaで実行するために必要な設定内容です.

|変数名|設定内容|説明|
|:---|:---|:---|
|MAIN_EXTERNAL|`git` or `s3`|[**`必須`**]requestURL先のリソース先(`git` or `s3`)を指定|
|REQUEST_PATH|ROOTパス|[**`必須`**]requestURL `/` に対する、対象のROOTパスを設定|
|S3_CONNECT|requirePath, region|[`準必須`]s3require, s3request時の接続設定<br>`S3_CONNECT` or `GIT_CONNECT`の設定が必須|
|GIT_CONNECT|organization, repo, branch,<br> requirePath|[`準必須`]grequire, grequest時の接続設定<br>具体的なパスの元URLは<br> ・raw.githubusercontent.com/{organization}/{repo}/{branch}/{requirePath}/...<br>となる<br>`S3_CONNECT` or `GIT_CONNECT`の設定が必須|
|GIT_CONNECT_TOKEN|token|[任意]対象githubRepogitoryがprivateな場合の<br>TOKEN(lfuSecretManagerで変換が必須)<br>対象Repogitoryがprivateの場合は `必須`|
|CACHE_TIMEOUT|number(ミリ秒)|[任意]require系のキャッシュタイムアウト値|
|NONE_GZIP|boolean|[任意]レスポンスBodyを圧縮しない場合の設定<br>false以外はtrue設定|
|MAIN_S3_BUCKET|s3Bucket名|[任意]MAINS3バケット名<br>この値を設定することでS3Bucket名が必要な処理で省略可<br>この設定は `S3_CONNECT` の環境変数とは別のもので、例えば `s3Kvs` などで利用される|
|FILTER_FUNCTION|HTMLリソースパス|[任意]filterFunc読み込み先を指定<br>HTMLリソース先の実装先ファイル名を設定|
|ORIGIN_MIME|HTMLリソースパス|[任意]拡張MimeType定義読み込み先を指定<br>HTMLリソース先の実装先ファイル名を設定|
|LFU_INDEX_PATH|path|[任意]pathの最後が/の時のインデックスパス認識先<br>設定しない場合は `index.html` が設定|
|LFU_ERROR_HTML_TEMPLATE_PATH|path|[任意]LFUがjhtml実行時にエラーになった場合のテンプレートパスを設定|
|S3_KVS_PREFIX|path|[任意]S3KVSのPrefix先を設定<br>設定しない場合は `s3kvs` が設定される|

## 3. lfu-simurator専用

ローカル開発で利用するLFUSimulator `lfusim` コマンド用の環境変数.<br>
　※この定義は[LFU]のAWS Lambdaでは不要.

|変数名|設定内容|説明|
|:---|:---|:---|
|LFU_PATH|{LFUディレクトリ}/src|[**`必須`**]ローカルcloneしたLFUディレクトリ＋srcパスを設定|
|LFU_FAKE_S3_PATH|path|[`準必須`]偽 $S3_CONNECT ローカルパス設定<br>LFU_FAKE_S3_PATH or LFU_FAKE_GITHUB_PATHの設定が必須|
|LFU_FAKE_GITHUB_PATH|path|[`準必須`]偽 $GIT_CONNECT ローカルパス設定<br>LFU_FAKE_S3_PATH or LFU_FAKE_GITHUB_PATHの設定が必須|
|LFU_ENV_CONF|lfu.env.json|[任意]指定jsonファイル指定で、環境変数設定が不要となる<br>lfusim実行パスに `./lfu.env.json` を設定している場合は<br>自動的に読み込む|
|LFU_HTTP_CROS_MODE|boolean|[任意]ブラウザのクロスアカウントをONにする場合はtrue|
|LFU_CIPHOER_KEY|string|[任意]`lfu.env.json`を暗号化してる場合のKey名<br>これは直接環境変数に設定する必要がある|
|LFU_CIPHOER_PASS|string|[任意]`lfu.env.json`を暗号化してる場合のパスワード<br>これは直接環境変数に設定する必要がある|
|LFU_LOGGER_DIR|path|[任意]ログ出力先ディレクトリ名を設定します<br>設定しない場合は `./log` に出力される|
|LFU_LOGGER_NAME|string|[任意]ログファイル名(head)を設定します<br>設定しない場合は `log` が設定される<br>またこの名前は`{string}-{yyyy-MM--dd}.log` ファイル名となる|
|LFU_LOGGER_LEVEL|string|[任意]ログ出力レベルを設定<br>`trace`: なし<br>`debug`: debug以上<br>`info`: info以上<br>`warn`: warning以上<br>`error`: error以上<br>設定しない場合は `debug`設定|

## 4. lfu版SecretManager用

LFU版SecretManagerとはAWSのSecretManagerのコストと比べてS3でLFUが独自管理したほうが「安価」なので、これを利用する場合の環境変数内容を説明.

|変数名|設定内容|説明|
|:---|:---|:---|
|S3_SCM_PREFIX|s3Prefix|[任意]lfu版secretManagerの管理先のPrefixを設定<br>設定しない場合は `secretsManager` が設定される|

## 5. ログインセッション管理用

LFUには、ログインセッション管理機能があり、これを利用する場合の環境変数の説明.

|変数名|設定内容|説明|
|:---|:---|:---|
|LOGIN_TOKEN_KEYCODE|string|[任意]ログイントークンを作成する時のヒントとなるKeyを設定<br>設定しない場合はリクエストのhost名|
|LOGIN_USER_LIST_LIMIT|number|[任意]ユーザ一覧を取得する場合のリミット値を設定<br>設定しない場合は100で、S3の規定で１度に最大1000まで|
|LOGIN_TOKEN_EXPIRE|number|[任意]ログインTokenのExpire値を日で指定<br>設定しない場合は1が設定|

## 6. gas oauth用

LFUでは、GAS(googleAppScript)にスクリプトを設定して、ここから企業契約でのGoogleWorkspace認証を行うことで、擬似的なOAuthを行う.<br>
GASのoAuthを利用する場合は、前項の「ログインセッション管理」関連も利用されるので関係性がある.

|変数名|設定内容|説明|
|:---|:---|:---|
|GAS_AUTH_URL|url|[**`必須`**]gasのURLを設定|
|ALLOW_GAS_AUTH_KEY_CODE|base64|[**`必須`**]lfusimコマンド `lfusim -keygen` で作成したKeyCodeを設定|
|GAS_OAUTH_TOKEN_KEY_LENGTH|number|[任意]tokenKey長|
|GAS_OAUTH_TOKEN_KEY_EXPIRE|number|[任意]tokenKeyのexpire値(分)|


