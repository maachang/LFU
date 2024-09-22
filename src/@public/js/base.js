/*################################################
## base.js
## LFUの支援javascript(ブラウザ版)
################################################*/
(function(_g) {
"use strict";

// nowLoading-z-index.
const NOW_LOADING_ZINDEX = 500;

// nowLoadingViewId.
const NOW_LOADING_VIEW_ID = "nowLoadingView";

// nowLoadingBackRGBA.
const NOW_LOADING_RGBA = {r:32,g:32,b:32,a:0.5};

// alert-z-index.
const ALERT_ZINDEX = 1000;

// alertViewId.
const ALERT_VIEW_ID = "alertView";

// alert confirm yes button id.
const ALERT_YES_BUTTON_ID = ALERT_VIEW_ID + "_" + "yes";

// alert confirm no button id.
const ALERT_NO_BUTTON_ID = ALERT_VIEW_ID + "_" + "no";

// shadow dialog.
const BACK_DIALOG_SHADOW = "box-shadow: 10px 10px 10px rgba(0,0,0,0.75);";

// alert window id.
const ALERT_WINDOW_ID = "alertWindowId";

// 対象要素がundefinedかnullかチェック.
const isNull = function(v) {
    return v == undefined || v == null;
}

// 文字が存在するかチェック.
// n 対象の文字列を設定します.
// 戻り値: trueの場合文字が存在します.
const useString = function(n) {
    if(isNull(n)) {
        return false;
    }
    n = ("" + n).trim();
    return n != "";
}

// 対象が数値かチェック.
// n 対象のvalueを設定します.
// 戻り値: trueの場合数字です.
const isNumeric = function(n) {
    if(isNull(n)) {
        return false;
    }
    if(isNaN(parseFloat(n))) {
        return false;
    }
    return true;
}

// 対象がbooleanかチェック.
// n 対象のvalueを設定します.
// 戻り値: trueの場合booleanです.
const isBoolean = function(n) {
    if(isNull(n)) {
        return false;
    }
    return (n == true || n == false ||
        n == "true" || n == "false");
}

// 指定文字を置き換える.
// value 変換対象文字列.
// src 変換元.
// dest 変換先.
// 戻り値: 変換されたvalueが返却されます.
const changeString = function(value, src, dest) {
    let bef;
    while(true) {
        value = value.replace(src, dest);
        if(bef == value) {
            // 変換終了.
            return value;
        }
        bef = value;
    }
}

// 対象イベントのキャンセル.
const cancelEvent = function(event) {
    if(!isNull(event)) {
        event.stopPropagation();
        event.preventDefault();
    }
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
{
    _g.isNull = isNull;
    _g.useString = useString;
    _g.isNumeric = isNumeric;
    _g.isBoolean = isBoolean;
    _g.changeString = changeString;
    _g.cancelEvent = cancelEvent;
}

/////////////////////////////////////////////////////
// dialog.js
/////////////////////////////////////////////////////

// 時間差を指定して実行.
// call 実行functionを設定します.
// time 実行差の時間(ミリ秒)を設定します.
const loadDelay = function(call, time) {
    // 遅延実行開始時間(ミリ秒)が指定されてない、既定値未満の場合.
    if((time = time|0) <= 50) {
        // js読み込み・実行から50ミリ秒後に実行.
        time = 50;
    }
    // 遅延実行.
    setTimeout(function() {
        try {
            call();
        } catch(e) {
            console.error(
                "[error]loadDelay処理(" + time +
                ")でエラーが発生しました", e);
        }
    }, time);
}

// 短めの遅延実行.
// call 遅延実行する対象のfunctionを設定します.
const delayCall = function(call) {
    setTimeout(function() {
        try {
            call();
        } catch(e) {
            console.error(
                "[error]delayCall処理でエラーが発生しました",
                e);
        }
    }, 50);
}

// 長い遅延実行.
// call 遅延実行する対象のfunctionを設定します.
const longDelayCall = function(call) {
    setTimeout(function() {
        try {
            call();
        } catch(e) {
            console.error(
                "[error]longDelayCall処理でエラーが発生しました",
                e);
        }
    }, 5000);
}

// 超長い遅延実行.
// call 遅延実行する対象のfunctionを設定します.
const longLongDelayCall = function(call) {
    setTimeout(function() {
        try {
            call();
        } catch(e) {
            console.error(
                "[error]longLongDelayCall処理でエラーが発生しました",
                e);
        }
    }, 30000);
}

// bodyに対して対象elementをTopにセット.
// id 対象のDomIdを設定します.
// 戻り値: 追加したDOMが返却されます.
const appendTopElement = function(id) {
    let em = document.createElement("div");
    em.id = id;
    document.body.prepend(em);
    return em;
}

// Screen display while loading.
const nowLoading = function(rgba) {
    if(isNull(rgba)) {
        rgba = NOW_LOADING_RGBA;
    }
    // get nowLoadingViewId.
    let em = document.getElementById(NOW_LOADING_VIEW_ID);
    if(isNull(em)) {
        // 存在しない場合はBodyTopに追加.
        em = appendTopElement(NOW_LOADING_VIEW_ID)
    }
    let w = document.documentElement.scrollWidth || document.body.scrollWidth;
    let h = document.documentElement.scrollHeight || document.body.scrollHeight;
    em.innerHTML = "<div style='z-index:" + NOW_LOADING_ZINDEX +
        ";position:absolute;width:"+((w|0)-1)+"px;height:"+((h|0)-1)+"px;" +
        "left:0px;top:0px;background-color:rgba("
            +(rgba.r|0)+","+(rgba.g|0)+","+(rgba.b|0)+","+(rgba.a|0)+");' " +
        // Block physical access.
        "onkeydown='event.preventDefault()' " +
        "onclick='event.preventDefault()' " +
        "ontouchstart='event.preventDefault()' " +
        "ontouchend='event.preventDefault()' " +
        "ontouchmove='event.preventDefault()'" +
        ">" + "</div>";
    return true;
}

// Clears the screen display while loading. 
const clearNowLoading = function() {
    // get nowLoadingViewId.
    let em = document.getElementById(NOW_LOADING_VIEW_ID);
    if(isNull(em)) {
        // 存在しない場合はBodyTopに追加.
        em = appendTopElement(NOW_LOADING_VIEW_ID)
    }
    em.innerHTML = "";
}

// Calculate the optimal size of the dialog display frame. 
const dialogPositionCalcSize = function() {
    let left, top, width, height, radius;
    const w = innerWidth;
    const h = innerHeight;
    if(w > h) {
        left = (w*0.3)|0;
        top = (h*0.2)|0;
        width = (w*0.4)|0;
        height = (h*0.6)|0;
        radius = 10;
    } else {
        left = (w*0.15)|0;
        top = (h*0.2)|0;
        width = (w*0.7)|0;
        height = (h*0.6)|0;
        radius = 10;
    }
    return {w:w,h:h,left:left,top:top,width:width,
        height:height,radius:radius};
}

// change html.
const changeHtml = (function() {
    const _chkCD = "&<>\'\" \r\n" ;
    return function( string ) {
        let len = string.length ;
        let chkCd = _chkCD ;
        let ret = "";
        let c ;
        for(let i = 0 ; i < len ; i ++) {
            switch(chkCd.indexOf(c = string.charAt( i ))) {
                case -1: ret += c; break;
                case 0 : ret += "&amp;" ; break ;
                case 1 : ret += "&lt;" ; break ;
                case 2 : ret += "&gt;" ; break ;
                case 3 : ret += "&#039;" ; break ;
                case 4 : ret += "&#034;" ; break ;
                case 5 : ret += "&nbsp;" ; break ;
                case 6 : ret += "" ; break ;
                case 7 : ret += "<br>" ; break ;
                case 8 : ret += "<" ; break ;
                case 9 : ret += ">" ; break ;
            }
        }
        return ret
    }
})();

// add js event.
const addEvent = function(node, name, func) {
    if(isNull(node)) {
        node = window;
    }
    if(node.addEventListener){
        node.addEventListener(name, func, false);
    } else if(node.attachEvent){
        node.attachEvent("on" + name, func);
    }
}

// clear alert window.
const clearAlertWindow = function(noneNowLoading) {
    // get alertViewId.
    let em = document.getElementById(ALERT_VIEW_ID);
    if(isNull(em)) {
        // 存在しない場合はBodyTopに追加.
        em = appendTopElement(ALERT_VIEW_ID);
    }
    em.innerHTML = "";
    if(noneNowLoading != true) {
        clearNowLoading();
    }
}

// create start alert html.
const createStartAlertHtml = function(message) {
    const p = dialogPositionCalcSize();
    const top = p.top + (window.scrollY|0);
    return "<div id='" + ALERT_WINDOW_ID + "' style='z-index:" + ALERT_ZINDEX + ";position:absolute;left:" +
        p.left + "px;top:" + top + "px;"+"width:" + p.width + "px;height:" + p.height + "px;border-radius:" +
        p.radius + "px;word-break:break-all;background:#ffffff;color:#000000;border: solid 2px #efefef;" +
        BACK_DIALOG_SHADOW + "overflow:auto;'" +
        ">" +
        "<div style='margin:10px;font-size:small;color:#666;'>" +
        changeHtml(message) ;
}

// create end alert html.
const createEndAlertHtml = function() {
    return "</div></div>";
}

// new window to alert.
const alertWindow = function(message, call) {
    if(isNull(message) ||
        (message = ("" + message).trim()).length == 0) {
        return;
    }
    // get alertViewId.
    let em = document.getElementById(ALERT_VIEW_ID);
    if(isNull(em)) {
        // 存在しない場合はBodyTopに追加.
        em = appendTopElement(ALERT_VIEW_ID);
    }
    em.innerHTML = createStartAlertHtml(message) + createEndAlertHtml();
        // click callback.
    delayCall(function() {
        nowLoading();
        const em = document.getElementById("alertWindowId");
        if(!isNull(em)) {
            // call指定されている場合.
            if(typeof(call) == "function") {
                // クリックした場合.
                addEvent(em, "click", function() {
                    // コール実行.
                    call();
                    // alert解除.
                    clearAlertWindow()
                });
            } else {
                // クリックでalert解除.
                addEvent(em, "click", function() {
                    // alert解除.
                    clearAlertWindow();
                });
            }
        }
    });
}

// add button.
const addButton = function(id, view) {
    return "<a href='javascript:void(0);' id='" + id +
        "' class='base_dialog_button'>" + view + "</a>";
}

// new window to confirm.
// yes ボタン押下 => call(true)
// no ボタン押下 => call(false)
const confirmWindow = function(message, call) {
    if(isNull(message) || (message = ("" + message).trim()).length == 0) {
        return;
    }
    // get alertViewId.
    let em = document.getElementById(ALERT_VIEW_ID);
    if(isNull(em)) {
        // 存在しない場合はBodyTopに追加.
        em = appendTopElement(ALERT_VIEW_ID);
    }
    em.innerHTML = createStartAlertHtml(message) +
        "<br><br>" +
        addButton(ALERT_YES_BUTTON_ID, "O&nbsp;&nbsp;K") +
        "&nbsp;&nbsp;" +
        addButton(ALERT_NO_BUTTON_ID, "CANCEL") +
        createEndAlertHtml();
    // yes no button click callback.
    delayCall(function() {
        nowLoading();
        // yesButton.
        const yesCall = function() {
            if(!call(true)) {
                clearAlertWindow()
            }
        };
        // noButton.
        const noCall = function() {
            call(false);
            clearAlertWindow()
        };
        let em = document.getElementById(ALERT_YES_BUTTON_ID);
        if(!isNull(em)) {
            addEvent(em, "click", yesCall);
            addEvent(em, "keydown", function(e) {
                e.preventDefault();
                yesCall();
            });
        }
        em = document.getElementById(ALERT_NO_BUTTON_ID);
        if(!isNull(em)) {
            addEvent(em, "click", noCall);
            addEvent(em, "keydown", function(e) {
                e.preventDefault();
            });
            // default cancel focus.
            em.focus();
        }
    });
}

// [async]アラート処理.
// awaitで呼び出す事で、jsの簡略化が出来ますので、こちらの利用を推奨します.
// message 対象のメッセージを設定します.
// 戻り値: awaitで呼び出す場合は　確定した場合は `undefined` が返却されます.
const alertAsync = function(message) {
    return new Promise(function(resolve) {
        alertWindow(message, function() {
            return resolve();
        });
    });
}

// [async]確認アラート処理.
// awaitで呼び出す事で、jsの簡略化が出来ますので、こちらの利用を推奨します.
// message 対象のメッセージを設定します.
// 戻り値: awaitで呼び出す場合は 確認OKが true 確認Cancelが false が返却されます.
const confirmAsync = function(message) {
    return new Promise(function(resolve) {
        confirmWindow(message, function(yes) {
            return resolve(yes);
        });
    });
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
{
    const o = {};
    _g.dialog = o;

    o.nowLoading = nowLoading;
    o.alertWindow = alertWindow;
    o.confirmWindow = confirmWindow;
    o.clearAlertWindow = clearAlertWindow;
    o.clearNowLoading = clearNowLoading;

    // async用.
    o.alertAsync = alertAsync;
    o.confirmAsync = confirmAsync;
}

/*################################################
## request.js
################################################*/

// ajaxHeadを整理.
const _ajax_head = function(m, ax, h){
    if(m == 'JSON') {
        ax.setRequestHeader('Content-Type',
            'application/json');
    } else if(m == 'POST') {
        ax.setRequestHeader('Content-Type',
            'application/x-www-form-urlencoded');
    }
    if(!isNull(h)) {
        for(let k in h) {
            ax.setRequestHeader(k, h[k]);
        }
    }
}

// ajaxMethodを整理.
const _ajax_method = function(m) {
    return m == 'JSON' ? 'POST' : m;
}

// ajax実行.
// url 対象のURLを設定します.
// optins {method: string, header: object, params: object}
//        method HTTPメソッドを設定します.
//        params パラメータを設定します.
//        header 設定したいHTTPリクエストヘッダを設定します.
// 戻り値 promiseオブジェクトが返却されます(async).
//       then({status: number, header: object, body: string}):
//          status: HTTPレスポンスステータスが返却されます.
//          header: HTTPレスポンスヘッダが返却されます.
//          body: HTTPレスポンスBodyが返却されます.
//       catch(e): e: エラー内容が返却されます.
const ajax = function(url, options) {
    if(options == undefined || options == null) {
        options = {};
    }
    // execute ajax(promise=> async).
    return new Promise((resolve, reject) => {
        if(!useString(url)) {
            reject(new Error("No target URL is specified."));
        }
        try {
            let method = !useString(options.method) ?
                "GET" : options.method;
            let params = options.params;
            let header = options.header;
            method = (method+"").toUpperCase();
            let pms = "" ;
            if(!isNull(params)) {
                if(typeof(params) == "string") {
                pms = params ;
                } else if(method == "JSON") {
                pms = JSON.stringify(params);
                } else {
                for(let k in params) {
                    pms += "&" + k + "=" +
                        encodeURIComponent(params[k]) ;
                }
                }
            }
            params = null;
            if(method == "GET" && pms.length > 0) {
                url = url + "?" + pms;
                pms = null;
            }
            // async.
            let x = new XMLHttpRequest();
            x.open(_ajax_method(method), url, true);
            // cookieを利用可能にする.
            x.withCredentials = true;
            // ajax実行.
            x.onreadystatechange = function() {
                if(x.readyState == 4) {
                try {
                    let status = x.status|0;
                    status == 0 ? 500 : status;
                    // response headers.
                    let headers = x.getAllResponseHeaders();
                    let arr = headers.trim().split(/[\r\n]+/);
                    let headerMap = {};
                    arr.forEach(function (line) {
                        const parts = line.split(': ');
                        const header = parts.shift();
                        const value = parts.join(': ');
                        headerMap[header.toLowerCase()] = value;
                    });
                    // 正常終了.
                    resolve({
                        status: status,
                        header: headerMap,
                        body: x.responseText
                    });
                } catch(e) {
                    // 例外.
                    reject(new Error(
                        "An error occurred during ajax processing. (url: " +
                            url + ", options: " + JSON.stringify(options, null, "  ") +
                            ")")
                    );
                } finally {
                    x.abort();
                    x = null;
                }
                }
            };
            _ajax_head(method, x, header);
            x.send(pms);
        } catch(e) {
            // 例外.
            reject(new Error(
                "Error in ajax call(url: " +
                url + ", options: " + JSON.stringify(options, null, "  ") +
                ")")
            );
        }
    });
};

// postでパラメータ送信.
// formTarget form.target 条件を設定します.
// id form.id 名を設定します.
// url 対象のURLを設定します.
// paramName パラメータ名を設定します.
// params パラメータを設定します.
const _sendPost = function(
    formTarget, id, url, paramName, params) {
    if(typeof(params) != "string") {
        // json変換.
        params = JSON.stringify(params);
    }
    let form = document.getElementById(id);
    if(form != undefined) {
        // 前回のFormが存在する場合は削除.
        form.parentElement.removeChiled(form);
    }
	// 新しいformを生成.
	form = document.createElement("form");
	form.target = formTarget;
	form.action = url;
	form.method = "POST";
    form.id = id;

    // formで送る情報を設定.
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = paramName;
    input.value = params;
    form.appendChild(input);

    // bodyに実体化してPOST送信.
    const body = document.getElementsByTagName("body")[0];
    body.appendChild(form);
    form.submit();
	body.removeChild(form);	
}

// ページ遷移.
// method=GETでページ遷移します.
// url 対象のURLを設定します.
// params 対象のパラメータ(string or object)を設定します.
// returnUrl trueを設定するとリダイレクトせず、対象のURLが返却されます.
// 戻り値: returnUrlがtrueの場合 ページ遷移用のURL変換結果が返却されます.
const nextPage = function(url, params, returnUrl) {
    if(params != undefined && params != null) {
        if(typeof(params) != "string") {
            let pms = "";
            for(let k in params) {
                if(pms.length != 0) {
                pms += "&";
                }
                pms += encodeURIComponent(k) + "=" +
                    encodeURIComponent(params[k]);
            }
            params = pms;
        } else {
            params = "" + params;
        }
        if(url.indexOf("?") != -1) {
            url += "&" + params;
        } else {
            url += "?" + params;
        }
    }
    if(returnUrl == true) {
        return url;
    }
    location.href = url;
    return null;
}

// ページ遷移.
// method=POSTでページ遷移します.
// url 対象のURLを設定します.
// paramName パラメータ名を設定します.
// params 対象のパラメータ(string or object)を設定します.
const nextPostPage = function(url, paramName, params) {
    _sendPost("_self", "_$nextPostPage",
        url, paramName, params);
}

// redirect処理.
// 直接リダイレクトをする場合はこちらを呼び出します.
// method=GETでページ遷移します.
// url 対象のURLを設定します.
// params 対象のパラメータ(string or object)を設定します.
const redirect = function(url, params) {
    nowLoading();
    nextPage(url, params);
}

// redirect処理.
// 直接リダイレクトをする場合はこちらを呼び出します.
// method=POSTでページ遷移します.
// paramName パラメータ名を設定します.
// url 対象のURLを設定します.
// params 対象のパラメータ(string or object)を設定します.
const redirectPost = function(url, paramName, params) {
    nowLoading();
    nextPostPage(url, paramName, params);
}

// 新しいWindow(タブ)でredirect処理.
// method=GETでページ遷移します.
// url 対象のURLを設定します.
// params 対象のパラメータ(string or object)を設定します.
const redirectToNewWindow = function(url, params) {
    url = nextPage(url, params, true);
    window.open(url);
}

// 新しいWindow(タブ)でredirect処理.
// method=POSTでページ遷移します.
// url 対象のURLを設定します.
// paramName paramsの名前を設定します.
// params 対象のパラメータ(string or object)を設定します.
const redirectPostToNewWindow = function(url, paramName, params) {
    // 別タブで開くためwindow.open処理.
    const win = window.open("about:blank", "_newWindow");
    _sendPost("_newWindow", "_$redirectPostTo$NewWindow",
        url, paramName, params);
    return win;
}

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
        ret[decodeURIComponent(kv[0])] =
            decodeURIComponent(kv[1]);
    }
    return ret;
}

// [async]ajax.
// 基本 `request.ajax` でなくこの処理を呼び出します.
// url 対象のURLを設定します.
// optins {method: string, header: object, params: object}
//        method HTTPメソッドを設定します.
//        params パラメータを設定します.
//        header 設定したいHTTPリクエストヘッダを設定します.
// startCall ajax処理開始時に呼び出すcallを指定します.
// finalCall ajax処理終了時に呼び出すcallを設定します.
// 戻り値 promiseオブジェクトが返却されます(async).
//       then({status: number, header: object, body: string}):
//          status: HTTPレスポンスステータスが返却されます.
//          header: HTTPレスポンスヘッダが返却されます.
//          body: HTTPレスポンスBodyが返却されます.
//       catch(e): e: エラー内容が返却されます.
const ajaxAsync = function(
    url, options, startCall, finalCall) {
    if(typeof(startCall) != "function") {
        // デフォルトの開始処理をセット.
        startCall = function() {
            // 開始時はNowLoadingをセット.
            nowLoading();
        }
    }
    if(typeof(finalCall) != "function") {
        // デフォルトの終了処理をセット.
        finalCall = function(value, err) {
            // 異常処理系の場合.
            // HTTPレスポンスステータスが400以上.
            if(err != undefined ||
                (value != undefined && value.status >= 400)) {
                try {
                    // nowLoadingを解除.
                    clearNowLoading();
                } catch(e) {}
            }
            // 正常処理の場合 nowLoadingを解除しない.
            // 理由は二重押し等を防ぐため.
        }
    }
    // async結果を返却.
    return new Promise(function(resolve, reject) {
        try {
            // ajax開始時に呼び出される.
            startCall();
        } catch(e) {}
        let vl, er;
        // ajax実行.
        ajax(url, options)
        .then(function(value) {
            vl = value;
            // 正常処理.
            resolve(value);
        })
        .catch(function(err) {
            er = err;
            // 異常処理.
            reject(err);
        })
        .finally(function() {
            // finally.
            if(typeof(finalCall) == "function") {
                try {
                finalCall(vl, er);
                } catch(e) {};
            }
        });
    });
}

// jsからサーバーとのデータI/Oを行う場合は、ajaxAsyncじゃなくて
// こちらを利用.
// url 対象のURLを設定します.
// optins {method: string, header: object, params: object}
//        method HTTPメソッドを設定します.
//        params パラメータを設定します.
//        header 設定したいHTTPリクエストヘッダを設定します.
// 戻り値 promiseオブジェクトが返却されます(async).
//       then({status: number, header: object, body: string}):
//          status: HTTPレスポンスステータスが返却されます.
//          header: HTTPレスポンスヘッダが返却されます.
//          body: HTTPレスポンスBodyが返却されます.
//       catch(e): e: エラー内容が返却されます.
const httpClient = async function(url, options) {
    return await ajaxAsync(url, options,
        function() {
            // 開始時はNowLoadingをセット.
            nowLoading();
        },
        function() {
            try {
                // nowLoadingを解除.
                clearNowLoading();
            } catch(e) {}
        }
    );
}

// ランダムIDを取得.
// 元はcrypto.randomUUID でuuidのハイフンを削除した内容.
const randomID = function() {
    const id = crypto.randomUUID();
    const len = id.length;
    let c, ret = "";
    for(let i = 0; i < len; i ++) {
        if((c = id.charAt(i)) == "-") {
            continue;
        }
        ret += c;
    }
    return ret;
}

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
const jsonp = function(
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

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
{
    const o = {};
    _g.request = o;
    o.ajaxAsync = ajaxAsync;
    o.httpClient = httpClient;
    o.jsonp = jsonp;
    o.nextPage = nextPage;
    o.nextPostPage = nextPostPage;
    o.redirect = redirect;
    o.redirectPost = redirectPost;
    o.redirectToNewWindow = redirectToNewWindow;
    o.redirectPostToNewWindow = redirectPostToNewWindow;
    o.httpGetParams = httpGetParams;
}

/////////////////////////////////////////////////////
// doms.
/////////////////////////////////////////////////////

// 対象オブジェクトがDomオブジェクトかチェック.
// obj 対象のオブジェクトを設定します.
// 戻り値: trueの場合Dom要素です.
const isDomElement = function(obj) {
    try {
        return obj instanceof HTMLElement;
    } catch(e) {
        return (typeof obj === "object") &&
            (obj.nodeType === 1) && (typeof obj.style === "object") &&
            (typeof obj.ownerDocument ==="object");
    }
}

// 対象Elementのタグ名が一致するかチェック.
// elemet 対象のDom要素を設定します.
// name 一致するタグ名のチェックを行います.
// 戻り値: trueの場合一致します.
const isTagName = function(element, name) {
    if(isNull(element) || isNull(element.tagName) ||
        isNull(name)) {
        return false;
    }
    return element.tagName.toLowerCase() == name.toLowerCase();
}

// validate条件をクリア.
// e 対象のDom要素を設定します.
const clearValidate = function(e) {
    // costomValidityをクリア.
    try {
        e.setCustomValidity("");
    } catch(e) {
        console.error("[error] clearValidate", e);
    }
}

// validate対象の処理.
// e 対象のDom要素を設定します.
// message これを設定した場合、このメッセージを優先的にメッセージを表示します.
//         指定してない場合はDomの "v-msg" が対象となります.
const setDomToValidateMessage = function(e, message) {
    try {
        if(typeof(message) == "string" && message.length > 0) {
            e.setCustomValidity("　" + message);
        }
        // validateメッセージが存在する場合.
        else if(useString(e.getAttribute("v-msg"))) {
            e.setCustomValidity("　" + e.getAttribute("v-msg"));
        }
        // 検出したValidate位置に移動.
        e.reportValidity();
        // スクロールを少し上に移動.
        // これで少しは見やすくなる。
        scrollBy(0, -150);
    } catch(e) {
        console.error("[error] setDomToValidateMessage", e);
    }
}

// validate対象の処理.
// e 対象のDom要素を設定します.
// message Domの "v-msg" が存在しない場合は、こちらを優先します.
const setDomToValidateOptionMessage = function(e, message) {
    try {
        // validateメッセージが存在する場合.
        if(useString(e.getAttribute("v-msg"))) {
            e.setCustomValidity("　" + e.getAttribute("v-msg"));
        }
        else if(typeof(message) == "string" && message.length > 0) {
            e.setCustomValidity("　" + message);
        }
        // 検出したValidate位置に移動.
        e.reportValidity();
        // スクロールを少し上に移動.
        // これで少しは見やすくなる。
        scrollBy(0, -150);
    } catch(e) {
        console.error("[error] setDomToValidateOptionMessage", e);
    }
}

// 対象Domのnameに対する指定validationメッセージを表示.
// name domのnameを設定します.
// message 対象のメッセージを設定します.
const setDomNameToValidateMessage = function(name, message) {
    const array = getDomNameArrayToDom(name);
    if(array.length == 0) {
        return true;
    }
    setDomToValidateMessage(array[0], message);
}

// inputタグに min, max が設定されている場合は
// 長さを図る.
// input.type = number の場合は、中の数字のmin, maxを
// チェックします.
// それ以外は、文字の長さをチェックします.
// e 対象のInputDom要素を設定します.
// 戻り値: trueの場合validate対象.
const checkMinMax = function(e) {
    if(!isTagName(e, "input")) {
        return false;
    }
    // valueを取得.
    let value = e.value;
    if(!useString(value)) {
        // 空の場合は処理しない.
        return false;
    }
    // minを取得.
    let min = useString(e.getAttribute("v-min")) ?
        parseInt(e.getAttribute("v-min")) : null;
    min = (min == null || isNaN(min)) ?
        null : min;
    // maxを取得.
    let max = useString(e.getAttribute("v-max")) ?
        parseInt(e.getAttribute("v-max")) : null;
    max = (max == null || isNaN(max)) ?
        null : max;
    // 正しく設定されていない場合.
    if(min == null && max == null) {
        // 処理しない.
        return false;
    }
    value = value.trim();
    const type = e.type.toLowerCase();
    let vlen = value.length;
    // input type = numberの場合.
    if(type == "number") {
        // valueを数字変換.
        vlen = parseInt(value);
        // 内容が数字でない場合はvalidate.
        if(isNaN(vlen)) {
            return true;
        }
    }
    // input min が設定されている場合.
    if(min != null && min > vlen) {
        return true;
    }
    // input max が設定されている場合.
    else if(max != null && max < vlen) {
        return true;
    }
    return false;
}

// input type=tel の番号取得.
const getTelNumber = function(value) {
    // nnn-nnnn-nnnnの場合.
    value = changeString(value, "-", "");
    // (nnn)nnnn-nnnnやnnn(nnnn)nnnの場合.
    value = changeString(value, "(", "");
    value = changeString(value, ")", "");
    // 前後のスペースを削除.
    return value.trim();
}

// 電話番号のチェック処理.
const checkTelNumber = function(value) {
    value = getTelNumber();
    // 電話番号を数字文字列に変換.
    // 日本では固定電話
    //   - nn-nnnn-nnnn = 10桁
    // 携帯電話
    //   - nnn-nnnn-nnnn = 11桁
    // があるので、これを元にチェックする.
    const len = value.length;
    if(len != 10 && len != 11) {
        // 電話番号じゃない.
        return false;
    }
    // 数字であるか確認.
    for(let i = 0; i < len; i ++) {
        if(!(value[i] >= "0" && value[i] <= "9")) {
            return false;
        }
    }
    return true;
}

// 対象Dom要素をvalidate.
// e 対象のDom要素を設定します.
// 戻り値: trueの場合、validateを検出しました.
const isValidateToDom = function(e) {
    if(!isDomElement(e)) {
        throw new Error(
            "The specified object is not a Dom element.");
    }
    // タグ名がないものは除外.
    if(e.tagName == undefined) {
        return false;
    }
    // tag名が入力系の場合のみ対象.
    const name = e.tagName.toLowerCase();
    if(name == "input" || name == "textarea" ||
        name == "select") {
        // validateをクリア.
        clearValidate(e);
        // 入力必須のvalidateの場合.
        // 最小・最大設定があった場合のvalidateの場合.
        if((e.required && !e.checkValidity()) || checkMinMax(e)) {
            // 検出したValidate処理.
            setDomToValidateMessage(e);
            return true;
        }
        // inputの場合.
        else if(name == "input") {
            const type = e.type.toLowerCase();
            // 入力情報が存在する場合、valudateチェック.
            // type=urlとかの場合において、内容はrequireじゃないが
            // 内容だけを確認したい場合の対応.
            if(e.value.length > 0) {
                if(!e.checkValidity()) {
                    // 検出したValidate処理.
                    setDomToValidateMessage(e);
                    return true;
                }
                // 電話番号のvalidateは自分たちで行う.
                else if(type == "tel" && !checkTelNumber(e.value)) {
                    // 検出したValidate処理.
                    setDomToValidateOptionMessage(e,
                        "電話番号(03-1234-5678 or 09012345678)" +
                        "のように入力してください");
                    return true;
                }
            }
        }
    }
    return false;
}

// 全要素をvalidateチェック.
// 戻り値: trueの場合validateチェックに引っかかりました.
const isValidateAll = function() {
    // 全てのタグを取得.
    const list = document.getElementsByTagName("*");
    const len = list.length;
    let e, name;
    // validate処理.
    for(let i = 0; i < len; i ++) {
        // validateチェック.
        if(isValidateToDom(list[i])) {
            return true;
        }
    }
    return false;
}

// form内の要素をvalidate.
// form 対象のFormDom要素を設定します.
// 戻り値: trueの場合、validateを検出しました.
const isValidateToForm = function(form) {
    const list = form.elements;
    const len = list.length;
    // validateをクリア.
    for(let i = 0; i < len; i ++) {
        clearValidate(list[i]);
    }
    // validate処理を実行.
    for(let i = 0; i < len; i ++) {
        // validateチェック.
        if(isValidateToDom(list[i])) {
            return true;
        }
    }
    return false;
}

// 入力タグ名群.
const INPUT_DOM_TAGS = [
    "input", "select", "textarea"
]

// dom.nameに一致するDom一覧を取得.
// arguments dom.name, dom.name, .... と設定します.
// dom.name は <input name>のようなものを指します.
// 戻り値: 指定名に一致したDom群(Array)が返却されます
const getDomNameArrayToDom = function() {
    // 指定名のMapを作成します.
    const nameMap = {};
    let len = arguments.length;
    for(let i = 0; i < len; i ++) {
        nameMap[arguments[i]] = true;
    }
    let tag, list, lenJ, e;
    const ret = [];
    // 入力タグ群でDomのnameを検索.
    len = INPUT_DOM_TAGS.length;
    for(let i = 0; i < len; i ++) {
        tag = INPUT_DOM_TAGS[i];
        // 当該対象の入力Dom群を取得.
        list = document.getElementsByTagName(tag);
        lenJ = list.length;
        for(let j = 0; j < lenJ; j ++) {
            e = list[j];
            if(!isTagName(e, tag)) {
                continue;
            }
            // 指定名と一致するDomの場合.
            if(nameMap[e.name]) {
                // Dom追加.
                ret[ret.length] = e;
            }
        }
    }
    return ret;
}

// dom.name名群を指定してValidate処理.
// arguments dom.name, dom.name, .... と設定します.
// dom.name は <input name>のようなものを指します.
// 戻り値: trueの場合、validateを検出しました.
const isValidateInputArray = function() {
    const list = getDomNameArrayToDom.apply(
        null, arguments);
    const len = list.length;
    // validateをクリア.
    for(let i = 0; i < len; i ++) {
        clearValidate(list[i]);
    }
    // validate処理を実行.
    for(let i = 0; i < len; i ++) {
        // validateチェック.
        if(isValidateToDom(list[i])) {
            return true;
        }
    }
    return false;
}

// 対象Elementのタグ名が一致するかチェック.
const eqTagName = function(element) {
    if(element.tagName == undefined) {
        return false;
    }
    const tagName = element.tagName.toLowerCase();
    if(tagName == null) {
        return false;
    }
    const args = arguments;
    const len = args.length;
    for(let i = 1; i < len; i ++) {
        if(tagName == args[i].toLowerCase()) {
            return true;
        }
    }
    return false;
}

// 子要素群を取得.
// 再帰処理で取得用.
// out タグ要素を格納するArrayを設定します.
// em 対象の要素を設定します.
const _getDomChileds = function(out, em) {
    // タグ名及び子要素がないものは処理対象外.
    if(em.tagName == undefined ||
        em.childNodes == undefined) {
        return;
    }
    const childs = em.childNodes;
    const len = childs.length;
    for(let i = 0; i < len; i ++) {
        // タグ名が無いものは取得しない.
        if(childs[i].tagName == undefined) {
            continue;
        }
        out[out.length] = childs[i];
        _getDomChileds(out, childs[i])
    }
}

// 子要素群を取得.
// em 対象の要素を設定します.
// 戻り値: タグ要素群が返却されます.
const getDomChileds = function(em) {
    if(em == undefined) {
        return null;
    }
    const ret = [];
    _getDomChileds(ret, em);
    return ret;
}

// タグ名を取得.
const getTagName = function(element) {
    if(element.tagName == undefined) {
        return null;
    }
    return element.tagName.toLowerCase();
}

// 入力valueを取得.
const getInputValue = function(element) {
    const tagName = getTagName(element);
    // textareaタグ.
    if(tagName == "textarea") {
        return changeString(element.value, "\r\n", "\n");
    // inputタグ.
    } else if(tagName == "input") {
        const type = element.type.toLowerCase();
        // ラジオボタン、チェックボックスボタン.
        if(type == "radio" || type == "checkbox") {
            return element.checked == true;
        // 対象外のtype.
        } else if(type == "button" ||
            type == "file" ||
            type == "image") {
            return undefined;
        // 電話番号.
        } else if(type == "tel") {
            return getTelNumber(element.value);
        }
        return element.value;
    // selectBox.  
    } else if(tagName == "select") {
        return element.value;
    }
    return undefined;
}

// 配列型のnameを配列に置き換える.
// xxxx[NN] NN=数字 このようなものを配列化する.
// params 対象のパラメータ群を設定します.
// 戻り値: {} パラメータ群が返却されます.
const convertInputValueToArray = function(params) {
    let p, no, e, srcName;
    const ret = {};
    const retList = [];
    const list = {};
    for(let name in params) {
        // xxxx[NN] NN=数字 の可能性.
        if(name.endsWith("]") &&
            (p = name.lastIndexOf("[")) != -1) {
            // 番号を取得.
            no = name.substring(p + 1, name.length - 1);
            // 対象番号が数字なのかを確認.
            if(no == "" + (no|0)) {
                // 数字の場合はlist化.
                no = no|0;
                srcName = name;
                name = srcName.substring(0, p);
                e = list[name];
                if(e == undefined) {
                    e = [];
                    list[name] = e;
                    // 新しい表示順に登録は１度のみ.
                    retList[retList.length] = name;
                }
                e[no] = params[srcName];
            } else {
                // 数字でない場合は通常名でセット.
                ret[name] = params[name];
                // 新しい表示順にセット.
                retList[retList.length] = name;
            }
        } else {
            // 通常名でセット.
            ret[name] = params[name];
            // 新しい表示順にセット.
            retList[retList.length] = name;
        }
    }
    // 配列化された情報が存在する場合.
    for(let name in list) {
        ret[name] = list[name];
    }
    return ret;
}

// 全ての入力情報を取得.
// 戻り値: {} パラメータ群が返却されます.
const getAllInputValues = function(topElement) {
    // topElementが設定されていない場合.
    if(topElement == undefined || topElement == null) {
        // bodyをTopElementとして設定.
        topElement = document.body
    }
    const ret = {};
    const list = getDomChileds(topElement);
    let em, value;
    const len = list.length
    for(let i = 0; i < len; i ++) {
        // inputタグ、textareaタグ、selectタグ以外は処理しない.
        if(!eqTagName((em = list[i]), "input", "textarea", "select")) {
            continue;
        }
        // keyValue取得.
        value = getInputValue(em);
        // radioボタンのケースの場合.
        if(typeof(value) == "boolean" &&
            em.type.toLowerCase() == "radio") {
            if(value == true) {
                // trueの場合はvalueをセット.
                ret[em.name] = em.value; 
            }
        } else {
            ret[em.name] = value;
        }
    }
    // 配列的な変数名(たとえばname.select[0] など).
    // この場合は配列化する.
    return convertInputValueToArray(ret);
}

// dom.name名群を指定してパラメータ取得.
// arguments dom.name, dom.name, .... と設定します.
// dom.name は <input name>のようなものを指します.
// 戻り値: dom内容が返却されます.
const getInputArray = function() {
    const list = getDomNameArrayToDom.apply(
        null, arguments);
    const len = list.length;
    let e, type, key, val, o;
    const ret = {};
    for(let i = 0; i < len; i ++) {
        e = list[i];
        // dom.name を取得.
        if(useString(e.name)) {
            // nameで取得.
            key = e.name;
        } else {
            // 存在しない場合は対象としない.
            continue;
        }
        // typeを取得.
        type = e.type.toLowerCase();
        // テキストエリア.
        if(isTagName(e, "textarea")) {
            // 改行コード[￥r￥n]を[￥n]に置き換える.
            val = e.value;
            let bef = val;
            // 効率悪いけどこれで変換.
            while(true) {
                val = val.replace("\r\n", "\n");
                if(bef == val) {
                // 変換終了.
                break;
                }
                bef = val;
            }
        // ラジオボタン.
        } else if(type == "radio") {
            // checkedがONのvalueを取得.
            if(e.checked) {
                val = e.value;
            } else {
                // 存在しない場合は対象としない.
                continue;
            }
        // チェックボックス.
        } else if(type == "checkbox") {
            // checkedがONのvalueを取得.
            if(e.checked) {
                val = e.value;
            } else {
                // 存在しない場合は対象としない.
                continue;
            }
        // それ以外(他input or select).
        } else {
            val = e.value;
        }
        // 複数存在する可能性の場合.
        // input type=checkbox.
        // のみを対象とする.
        // ※selectの複数対応は除外.
        if(type == "checkbox") {
            // key条件が存在しない場合.
            if(ret[key] == undefined) {
                // 配列でセット.
                ret[key] = [val];
            // key条件が存在する場合.
            } else {
                // 配列に追加.
                o = ret[key];
                o[o.length] = val;
            }
        } else {
            // 単体でセット.
            ret[key] = val;
        }
    }
    return ret;
}

// dom.name名群を指定して初期化.
// arguments dom.name, dom.name, .... と設定します.
// dom.name は <input name>のようなものを指します.
const clearInputArray = function() {
    const list = getDomNameArrayToDom.apply(
        null, arguments);
    const len = list.length;
    let e, type, key, val, o;
    for(let i = 0; i < len; i ++) {
        e = list[i];
        // dom.name を取得.
        if(useString(e.name)) {
            // nameで取得.
            key = e.name;
        } else {
            // 存在しない場合は対象としない.
            continue;
        }
        // typeを取得.
        type = e.type.toLowerCase();
        // テキストエリア.
        if(isTagName(e, "textarea")) {
            e.value = "";
        // ラジオボタン.
        } else if(type == "radio") {
            e.checked = false;
        // チェックボックス.
        } else if(type == "checkbox") {
            e.checked = false;
        // それ以外(他input or select).
        } else {
            e.value = "";
        }
    }
}

// 指定名のElementをFocus.
// name 対象のDomInput名を設定します.
// 戻り値: trueの場合、フォーカスが設定されました.
const focusElement = function(name) {
    // user入力画面にフォーカスをセット.
    try {
        getDomNameArrayToDom(name)[0].focus();
        return true;
    } catch(e) {
        return false;
    }
}

// ※この処理はbody読み込み後に実行する必要があります.
// 何度呼び出しても大丈夫なように対応済み.
// 全テキストエリアにautoHeightByTextAreaを適用する.
// これを設定する事で、入力枠に対して一定以上の改行が入ると
// 自動的に増減するように対応できる.
const autoHeightToTextArea = function() {
    // 実行後100ミリ秒(デフォルト値)で反映させる.
    loadDelay(function() {
        let textarea, func, clientHeight;
        const list = document.getElementsByTagName("textarea");
        const len = list.length;
        for(let i = 0; i < len; i ++) {
            textarea = list[i];
            if(!isTagName(textarea, "textarea")) {
                continue;
            }
            // 前回のイベント定義がある場合は一旦削除.
            if(typeof(textarea.autoHeightToTextArea) == "function") {
                textarea.removeEventListener("input", textarea.autoHeightToTextArea);
                textarea.autoHeightToTextArea = null;
            }

            // 現状の大きさを取得.
            clientHeight = textarea.clientHeight;
            // 初期の現状の大きさが定義されていない場合.
            if(textarea["_srcClientHeight"] == undefined) {
                // 現在の値をセット.
                textarea["_srcClientHeight"] = clientHeight;
            } else {
                // 初期の値を取得.
                clientHeight = textarea["_srcClientHeight"];
            }
            // 現状の大きさとスクロールサイズでリサイズ.
            textarea.style.height = clientHeight + 'px';
            textarea.style.height = textarea.scrollHeight + 'px';

            // function定義.
            func = function(event) {
                const target = event.target;
                // 現状の大きさとスクロールサイズでリサイズ.
                target.style.height = clientHeight + 'px';
                target.style.height = target.scrollHeight + 'px';
            };

            // 入力毎に現状の大きさとスクロールサイズでリサイズ.
            textarea.addEventListener('input', func);
            textarea.autoHeightToTextArea = func;
        }
    });
}

// Form内のタグ一覧を取得してInput のテキスト入力系
// に対して改行禁止させる.
// formElement formタグ要素を設定します.
const noEnterAppendInputText = function(formElement) {
    // 実行後100ミリ秒(デフォルト値)で反映させる.
    loadDelay(function() {
            let list;
        if(isNull(formElement)) {
            // formタグ要素が指定されてない場合.
            list = document.getElementsByTagName("*");
        } else {
            // formタグ要素が指定されてる場合.
            list = formElement.elements;
        }
        let type, em, func;
        const len = list.length;
        for(let i = 0; i < len; i ++) {
            if(eqTagName(list[i], "input") &&
                ((type = list[i].type.toLowerCase()) == "text" ||
                type == "number" || type == "email" || type == "password" ||
                type == "search" || type == "tel" || type == "url")) {
                em = list[i];
                // 前回のイベントが存在する場合.
                if(typeof(em.noEnterAppendInputText) == "function") {
                    // イベントを削除する.
                    em.removeEventListener("keydown", em.noEnterAppendInputText);
                    em.noEnterAppendInputText = null;
                }

                // イベント実行function定義.
                func = function(event) {
                    // 改行のkeydownはイベントをキャンセル.
                    if(event.key === 'Enter') {
                        cancelEvent(event);
                        return false;
                    }
                    return true;
                }
                // イベント追加.
                em.addEventListener("keydown", func);
                em.noEnterAppendInputText = func;
            }
        }
    });
}

// エラーメッセージを表示.
// message 対象のメッセージを設定します.
// 戻り値: trueの場合、正しく処理されました.
const errorMessage = function(message) {
    const e = document.getElementById("errorMessage");
    if(e != undefined) {
        e.innerHTML = message;
        return true;
    }
    return false;
}

// エラーメッセージをクリア.
// 戻り値: trueの場合、正しく処理されました.
const clearErrorMessage = function() {
    return errorMessage("");
}

// HTMLタグのオリジナルタグ(たとえばv-hoge="hogemoge"など)
// が定義されていて、その定義された内容のvalue値が存在するElement一覧を取得.
// attributeKey 対象のオリジナルタグ名を設定します.
// 戻り値: [value: [tagElement ...], value: [tagElement ...], ...] が返却されます.
//         value = オリジナルタグのvalue.
const searchOriginTag = function(attributeKey) {
    let v, ve;
    const ret = {};
    const list = document.getElementsByTagName("*");
    const len = list.length;
    for(let i = 0; i < len; i ++) {
        v = list[i].getAttribute(attributeKey);
        if(useString(v)) {
            ve = ret[v];
            if(ve == undefined) {
                ve = [];
                ret[v] = ve;
            }
            ve[ve.length] = list[i];
        }
    }
    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
{
    const o = {};
    _g.doms = o;

    o.isValidateToDom = isValidateToDom;
    o.isValidateAll = isValidateAll;
    o.isValidateToForm = isValidateToForm;
    o.getDomNameArrayToDom = getDomNameArrayToDom;
    o.setDomToValidateMessage = setDomToValidateMessage;
    o.setDomNameToValidateMessage = setDomNameToValidateMessage;
    o.isValidateInputArray = isValidateInputArray;
    o.getAllInputValues = getAllInputValues;
    o.getInputArray = getInputArray;
    o.clearInputArray = clearInputArray;
    o.focusElement = focusElement;
    o.autoHeightToTextArea = autoHeightToTextArea;
    o.noEnterAppendInputText = noEnterAppendInputText;
    o.errorMessage = errorMessage;
    o.clearErrorMessage = clearErrorMessage;
    o.searchOriginTag = searchOriginTag;
}

})(this);