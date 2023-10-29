// [LFU内部定義のブラウザ向けpublic環境][javascript]
//
// このjsはgithubのリポジトリで定義されているブラウザ用jsに対して利用できるようにする.
// ただしrepogitoryがprivateなものは取得が出来ないので注意が必要.
// 
// この処理でやることはGETパラメータで設定されているsrc=の条件群をajax(同期)で
// ダウンロードして、その複数内容を実行する.
//
// githubで定義されているjs に対して raw.githubusercontent.com で取得する場合
// 対象のjsファイルは mimeTypeが text/plain で取得される.
// この場合ブラウザでは、危険なアクセスとしてscriptタグのsrc指定の条件は読み取らない.
//
// なので、このjsファイルでajaxを利用してgithubにあるjsを読み込むように対応する.
// また raw.githubusercontent.com にある jsファイルは ajaxでドメイン超えが可能なので
// このjsで対応する事が可能となる.
//
// このjsによって raw.githubusercontent.com にあるjsを利用可能にする.
// 
// またこのjsの利用方法として以下の形で利用できる.
// <script src="raw.githubusercontent.js?src=davidshimjs/qrcodejs/master/qrcode.js">
// これによって qrcode.js を読み込む事ができる.
//
// またこの定義は複数定義する事ができるので ?src=...&src=...&src=... のように複数のjs
// 読み込み設定で行う事ができる.
// 
// また http:// や https:// で開始するものは、その条件で取得する.
// 依存関係のあるのもは一括読み込みすることで、エラー発生は起きにくくなるので、まとめて
// 定義を推奨する.
//
(function() {
'use strict';

// このjsのファイル名.
const THIS_JS_NAME = "raw.githubusercontent.js";

// githubusercontentのURL.
const RAW_GITHUB_URL = "https://raw.githubusercontent.com";

// このjsを呼び出している元のGETパラメータを取得.
let params = new URL(document.querySelector('[src*="' + THIS_JS_NAME + '"]').src).search;

// GETパラメータが存在しない場合は処理しない.
if(typeof(params) != "string" || (params = params.trim()).length == 0) {
    return;
}
params = params.substring(1);

// 同期用ajaxで取得.
// 通常ブラウザでは非推奨の同期用ajaxで処理する.
// github-repogitoryがprivateの場合は読み込みが出来ないので注意.
const syncAjx = function(url) {
    // timestampパラメータをセット.
    if(url.indexOf("?") != -1) {
        url += "&";
    } else {
        url += "?";
    }
    url += "t=" + Date.now();
    try {
        const request = new XMLHttpRequest();
        request.open('GET', url, false);
        request.send(null);
        if (request.status === 200) {
            return request.responseText;
        }
    } catch(e) {}
    return null
}

// GETパラメーターを解析.
let pms = [];
{
    let list = params.split("&");
    const len = list.length;
    for (let i = 0; i < len; i++) {
        const n = list[i].split("=");
        let o = null;
        if (n.length == 1) {
            o = [n[0], ''];
        } else {
            o = [n[0], decodeURIComponent(n[1]).trim()];
        }
        pms[pms.length] = o;
    }
}
params = null;

// src設定された複数のjs群を読み込む.
const len = pms.length;
let script = "";
for(let i = 0; i < len; i++) {
    const o = pms[i];
    // srcパラメータ以外の設定.
    if(o[0] != "src") {
        continue;
    }
    let src = o[1];
    // 先頭に/が存在しない場合.
    if(!src.startsWith("/")) {
        src = "/" + src;
    }
    // github内のsrcを取得する.
    src = RAW_GITHUB_URL + src;
    try {
        // 同期ajaxでJSを取得する.
        const s = syncAjx(src);
        if(s != null) {
            // 取得できた場合は複数のjsを連結させる.
            script = "\n" + s;
        }
    } catch(e) {
        console.error("[error]loadJs: " + src, e);
    }
}

// 実行するjsが存在する場合.
if(script.length > 0) {
    // headタグに取得した連結jsスクリプトを展開する.
    const em = document.createElement('script');
    em.text = script;
    document.head.appendChild(em);
}

})();
