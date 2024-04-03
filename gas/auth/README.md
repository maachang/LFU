# GASを利用したlfuでのoauth対応.

GoogleWorkspaceを会社契約している場合、会社の人のみが利用可能な形でGAS(GoogleAppScript)が利用できる.

昨今ではリモートワークの普及もあり、社外から接続する場合 `SSOログイン` は必須となっている.

LFUでもそれに則って、GASを認可機関として利用する形のoauth化を実現する.

ここでは、これに対しての利用手順について説明していく.

## GAS側での設定方法.

1. GoogleWorkspaceで新しいGASを作成する.
2. 名前はたとえば `gasOAuth` とか.
3. 以下の `スクリプト プロパティ` を定義する.<br>
・ALLOW_AUTH_KEY_CODE<br>
　Auth用KeyCode文字列.<br>
・ALLOW_MAIL_DOMAINS<br>
　利用可能なメールアドレス.複数定義の場合は aaa, bbb のように定義する.<br>
4. デプロイを行う<br>
・ `新しいデプロイ` を選択<br>
　説明を入力（しなくても良いが `無題` となる)
・次のユーザとして実行<br>
　ウェーブアプリケーションにアクセスしているユーザ.<br>
・アクセスできるユーザ<br>
　◯◯ 内の全員(〇〇には契約している組織名が入る)<br>

これらの設定を行う事でGASでのoAuth側の作成が完了する.

## LFU側で利用方法について.

まず `ALLOW_AUTH_KEY_CODE` 用のコードを作成する必要がある.

これは以下のコマンドで作成する.

~~~cmd
$ lfusim -g -l 48
vE6QWWubm2TM3sAGXlcDNowaPRJjm8VVqRnzVe4NZnk0kXV8WgMSBQBs4TdvHqF+
~~~

次にjsonpのコードを準備する.

~~~js
(function(_g) {
// jsonp呼び出し.
// url jsonp先のURLを設定します.
//     このURL先のresponseヘッダはcontent-type=application/json である必要があります.
// callback jsonpの実行結果を格納する function(json) を設定します.
// successCall ロードがsuccessの場合に呼び出されます.
// errorCall ロードがerrorの場合に呼び出されます.
// errorTimeout ロードエラーの判定用タイムアウト値(ミリ秒)を設定します.
//              設定しない場合は2.5秒がセットされます.
// callbackParamsName jsonp先に渡すコールバック対象の変数名を設定します.
//     未設定の場合 `jsonpCall` が設定されます.
_g.jsonp = function(
   url, callback, successCall, errorCall, errorTimeout, callbackParamsName) {
   // コールバック先に渡すコールバック引数が設定されていない場合.
   if(callbackParamsName == undefined ||
      callbackParamsName == null ||
      callbackParamsName == "") {
      // デフォルト名をセット.
      callbackParamsName = "jsonpCall";
   }
   // ランダムなjsonpコールバックメソッド名を生成.
   const callbackName =
      "_$_$_$jsonp_$" +
      Date.now().toString(16) + randomID();
   // jsonp条件をセット.
   const em = document.createElement("script");

   // コールバック先に対して生成したランダムなjsonpコールバックメソッド名を設定.
   // この時の定義名は `jsonpCall` なので、利用先ではこの名前を設定する..
   url += (url.indexOf("?") != -1 ? "&" : "?") +
      callbackParamsName + "=" +  callbackName;
   em.src = url;
   const head = document.getElementsByTagName("head");
   let successFlag = false;

   // グローバルにjsonb処理結果呼び出しのコールバックメソッドを定義.
   _g[callbackName] = function(json) {
      // 正常実行.
      successFlag = true;
      // コールバック実行(遅延実行).
      delayCall(function() {
         if(typeof(successCall) == "function") {
            try {
               successCall();
            } catch(e) {
               console.error(
                  "[error]successCall処理でエラーが発生しました", e);      
            }
         }
         // コールバック実行.
         callback(json);
      });
      // ロング遅延実行で後始末.
      longDelayCall(function() {
         // 後始末.
         delete _g[callbackName];
         head[0].removeChild(em)
      });
   };

   // ロードエラーイベント.
   if(typeof(errorCall) == "function") {
      // chromeなどの場合、エラーになってもloadイベントに
      // 来るので、loadの後にjsonpのcallbackが呼び出されない
      // 場合はエラーになるように設置する.
      em.addEventListener("load", function(event) {
         // タイムアウト値が設定されてない場合.
         errorTimeout = errorTimeout|0;
         if(errorTimeout <= 0) {
            // デフォルトの2.5秒設定.
            errorTimeout = 2500;
         }
         // タイムアウト実行.
         setTimeout(function() {
            // ただしsuccessFlagがtrueの場合は
            // エラー処理を行わない.
            if(!successFlag) {
               errorCall();
            }
         }, errorTimeout);         
      },false);
      // firefoxの場合エラーが出た場合、エラーイベントとなるので、
      // エラーイベントにも追加.
      em.addEventListener("error", function(event) {
         delayCall(function() {
            errorCall();
         });
      });
   }

   // Scriptタグ発火処理.
   head[0].appendChild(em);
}
})(this);
~~~

基本的に会社等の団体契約でのGoogleWorkspaceの場合は以下にあるように<br>
- https://qiita.com/faunsu/items/722ab6d7f6178508851c

`XMLHttpRequest` でのドメイン超え設定のアクセスでもすべて「エラー」になる.

そのため、抜け道である scriptタグを使った `JSONP` でしかアクセスできない.

またこの `JSONP` を使う方法としてまず以下のように

- requestOAuth.lfu.js
~~~js
// oAuth.
const gasAuth = frequire("./lib/auth/gasAuth.js");

// oAuthのリクエスト処理を実施.
// resState レスポンスステータスを設定します.
// resHeader レスポンスヘッダを設定します.
// request リクエスト情報を設定します.
// 戻り値: レスポンスBody情報を返却します.
exports.handler = async function(resState, resHeader, request) {
    // gasAuthURLを取得.
    const oauthUrl = gasAuth.executeOAuthURL(request);
    // allowAccessDataURLを取得.
    const allowAccessDataURL = gasAuth.allowAccountDataURL();
    // リダイレクト.
    resState.redirect(
        "/requestOAuth.html?oauthUrl=" + encodeURIComponent(oauthUrl) +
        "&allowAd=" + encodeURIComponent(allowAccessDataURL));
}
~~~

としてsever側で、gasへのoauth用のパラメータを作成して、リダイレクトして `html` 側に渡してやる必要がある.

理由として、この機能はブラウザ側でGASの認可が行われるためであり、GASでのoauthの実現は `ブラウザ側` で行う必要があるため、このような複雑なものとなっている.

あと、GASは利用ユーザが初めて利用する場合は `利用ユーザ設定やGoogleWorkspace内で利用される権限等の確認画面` があって、これらをユーザ側が承認する必要がある.

そのため最初の１回目のアクセスでは `JSONP` ではこれができないので、直接GASのURLにアクセス(url=allowAd)する必要がある.

なので `リダイレクト先のhtml` では、これらの実装を行う必要がある.

以下サンプルです.

- requestOAuth.html
~~~html

<!-- gas アクセスデータの利用許可用のリンク. -->
<div id="allowAd">now loading</div>

<script>

// HttpGetパラメータを取得.
// 戻り値: Getパラメータが返却されます.
const httpGetParams = function() {
   let kv;
   // getParameterのパース処理.
   const list = new URL(location.href)
      .searchParams.toString().split("&");
   const len = list.length;
   const ret = {};
   // key=valueの条件をパースする.
   for(let i = 0; i < len; i ++) {
      kv = list[i].split("=");
      ret[decodeURIComponent(kv[0])] = kv[1];
   }
   // valueは`decodeURIComponent`されていないので、別途対応が必要.
   return ret;
}

// oauthエラー.
const errorOAuth = function() {
    // エラー処理を実施する.
}

// loginページに戻る.
const moveLogin = function() {
    location.href = "ログインページのURLを設定";
}

// 表示内容を更新.
const updateView = function(value) {
    const em = document.getElementById("allowAd");
    em.innerHTML = value;
}

// アクセスデータの利用許可用内容を表示.
const viewAllowAccessData = function(params) {
    updateView(
        "利用許可設定が必要です。以下のリンクでアクセスデータの利用許可を行ってください。<br>" +
        "<a href='" +
        decodeURIComponent(params.allowAd) +
        "' target='_blank'>アクセスデータの利用許可</a><br>" +
        "<br>利用許可を行った後に" +
        "<button onclick='javascript:moveLogin();'>戻る</button>" +
        "を押下してログイン画面に遷移してください。"
    );
}

// oauthLogin処理.
const oauthLogin = function(params) {
    try {
        const params = httpGetParams();
        jsonp(decodeURIComponent(params.oauthUrl), function(value) {
            // コールバック結果.
            try {
                // statusが200以外.
                if(value.status != 200) {
                    // エラーの場合.
                    errorOAuth();
                // statusが200.
                } else {
                    // 正常取得の場合はリダイレクト.
                    location.href = "/resultOAuth" +
                        "?mail=" + encodeURIComponent(value["mail"]) +
                        "&redirectToken=" + encodeURIComponent(value["redirectToken"]) +
                        "&type=" + encodeURIComponent(value["type"]) +
                        "&tokenKey=" + encodeURIComponent(value["tokenKey"]) +
                        "&srcURL=" + encodeURIComponent(value["srcURL"]);
                }
            } catch(e) {
                // ログイン処理で例外発生.
                console.error("[error]oauthログイン処理でエラーが発生しました", e);
                errorOAuth();
            }
        }, function() {
            // ロード成功.
            // successと表示.
            updateView("success");
        }, function() {
            // ロード失敗.
            // アクセスデータの利用許可用内容を表示.
            viewAllowAccessData(httpGetParams());
        });
    } catch(e) {
        // ログイン処理で例外発生.
        console.error("[error]oauthログイン処理でエラーが発生しました", e);
        errorOAuth();
    }
}

// 初期処理.
oauthLogin(httpGetParams());

</script>
~~~

ちょっと面倒ですが、JSONPってブラウザによって挙動が変わるので、たとえばFirefoxだと `初回アクセスでのGAS利用確認画面` の場合はエラーハンドリングできるが、一方のGoogleChromeでは、これがハンドリングできない。

なので「タイムアウト」で一定期間読み込みできない場合は「失敗」扱いとなり、JSONPは非常に使いづらいと思います。

次にoauthによるGoogleWorkspaceのメールアドレス取得ができた場合の処理対応について説明する.

ここでは `取得できたメールアドレス` を使って「ログイン済み=ログインセッションを作成」する必要があるので、oauth成功したら、更に「リダイレクト」する必要がある.

ここでは `resultOAuth` にリダイレクトしているので、次にこれに対しての処理内容を説明する.

- resultOAuth.lfu.js
~~~js
// oAuth.
const gasAuth = frequire("./lib/auth/gasAuth.js");

// oAuthのResult処理を実施.
// resState レスポンスステータスを設定します.
// resHeader レスポンスヘッダを設定します.
// request リクエスト情報を設定します.
// 戻り値: レスポンスBody情報を返却します.
exports.handler = async function(resState, resHeader, request) {
    // redirectAuthを実行.
    if(!await gasAuth.redirectOAuth(resState, resHeader, request)) {
        // srcURLが存在しない場合は、自分でリダイレクト.
        resState.redirect("ログイン後に表示するRedirect先.");
     }
}
~~~

先ほどの `html` から `server` に遷移して、そこで実際のoAuthログインを行い、AuthSessionを登録してログイン状態を維持する形が取られるようになる.

流れとしてまとめると

```
※ [S]: server, [B]browser.

oauth開始 -> [S]requestOAuth -> [B]requestOAuth.html -> GAS -> [S]resultOAuth -> ログイン完了画面に遷移
　　＜redirect＞　　　　＜redirect＞　　　　　　＜JSONP＞　＜redirect＞　　＜redirect＞
```

こんな感じでリダイレクトが多岐に渡るわけだが、これまでのような形で実装する事で、GASを使ったoauthの実装は実現することが出来る.
