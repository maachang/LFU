# AWS Lambda関数URLのコストについて説明

関数URLのコストについて説明していく.

## AWS Lambda自体の実行コスト

まずLambdaの実行に関してのコストは以下のようになる。

コストは[AWSのサイト](https://docs.aws.amazon.com/ja_jp/whitepapers/latest/how-aws-pricing-works/aws-lambda.html)にあるように
> AWS Lambda の無料利用枠には、1 か月あたり 100 万件の無料リクエストと、1 か月あたり 40 万 GB-s のコンピューティングタイムが含まれている

とあるので

- 40万 GByte
  - 128MByte = 3125000秒 / 868時間(約36日) １ヶ月.
  - 256MByte = 1562500秒 / 434時間(約18日) １ヶ月.
  - 512MByte = 781250秒 / 217時間(約9日) １ヶ月.
  - 1024MByte = 390625秒 / 108時間(約4.5日) １ヶ月.
  - 10240MByte = 39062秒 / 10.8時間(約0.45日) １ヶ月.

が無料枠で利用することができる.

無料枠が終わったとしても

- コンピューティングタイム
  - 0.00001667 USD/GB 秒<br>
  なので、たとえば１つのLambdaを１日ずっと動かすとした場合.
    - 128MByte = 0.18436USD
    - 256MByte = 0.36871USD
    - 512MByte = 0.73742USD
    - 1024MByte = 1.47485USD
    - 10240MByte = 14.7485USD

- リクエスト毎
  - 0.0000002 USD/リクエスト<br>
  なので、100万回リクエスト
    - 0.20 USD

となっている.

## 関数URLのコスト

関数URLは、対象のLambdaに対してHTTPSのエンドポイントを生やして、そこにブラウザ等からアクセス可能となるので、基本的に２つのコスト発生が見込まれる.

1. HTTPSエンドポイント
2. インターネット転送量コスト

それぞれ以下より説明していく.

### 関数URLでのHTTPSエンドポイントのコスト

HTTPSエンドポイントのコストについては[このサイト](https://www.ragate.co.jp/blog/articles/12061)にあるように
~~~
Lambda URL - 100万リクエスト当たりの料金:
・ API Gateway REST: $3.5/million requests.
・ API Gateway HTTP: $1/million requests
・ Function URL = no extra costs
~~~

これを見るとわかるように `HTTPSエンドポイント` に対して 関数URLは `no extra costs` つまり無料.

### インターネット転送量コスト

この辺色々調べてみたが、確たる転送量コストについての記載は無く、唯一それっぽい内容が[このサイト](https://aws.amazon.com/jp/blogs/news/announcing-aws-lambda-function-urls-built-in-https-endpoints-for-single-function-microservices/)にあるように
~~~
Function URL の料金
関数 URL は Lambda のリクエストと期間の料金に含まれます。例えば、128 MB のメモリと平均呼び出し時間が 50 ミリ秒の Lambda 関数を 1 つデプロイするとします。この関数は毎月 500 万件のリクエストを受信するため、リクエストのコストは 1.00 USD、期間のコストは 0.53 USD になります。
~~~

ここで言う所の `リクエスト` がインターネットの接続回数を指していて、これが `500万アクセス/月:1USD` つまり
- 1アクセス: 0.0000002USD

となり、社内で利用するWebアプリ程度なら最大で100万アクセスとしても
- 0.2USD = 1USD=150円 = `約30円`

となる.

## まとめ

以上を見る限り規模の小さいWebアプリであれば、ほとんどコストが発生しない、発生したとしても超少額であると言う事が分かる内容であると言える.
