///////////////////////////////////////////////
// slack送信処理.
///////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// httpsClient.
const httpsClient = frequire("./lib/httpsClient.js");

// URLの後ろ4文字だけ表示.
const convertURLLast4String = function(url) {
    if(url.length <= 4) {
        return "********" + url;
    }
    return "********" + url.substirng(url.length - 4);
}

// JSON情報をPOST送信.
// url 送信先URLを設定します.
// json 送信対象のJSON情報(string)を設定します.
// 戻り値: HTTPレスポンスBodyが返却されます.
const _sendHttpJson = async function(url, json) {
    // dict型やlist型の場合はstring変換.
    if(typeof(json) == "object") {
        json = JSON.stringify(json);
    }
    // ヘッダ生成.
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "lfu/" + Date.now(),
        "X-Header": "X-Header"
    }
    // httpsClient問い合わせ.
    const response = {};
    const ret = await httpsClient.request(url, null, {
        method: "POST",
        header: headers,
        body: json,
        response: response,
        // URLで設定.
        directURL: true
    });
    // responseのstatusが400以上の場合.
    if(response.status >= 400) {
        // エラー表示.
        throw new Error("HTTPエラーステータス: " +
            response.status + " が発生しました: " +
            " URL: " + convertURLLast4String(url) + ": " +
            JSON.stringify(json, null, "  "));
    }
    // 文字列変換して返却.
    return ret.toString();
}

// [text]メッセージ送信.
// webhook slackのWebHookで提示されたURLを設定します.
// message 送信メッセージを設定します.
// userName slackユーザ名を設定します.
// icon slackアイコン名を設定します.
// channel 送信先チャンネルを設定します.
// options その他装飾等を行う場合は、ここに設定します.
//         この辺は https://qiita.com/ik-fib/items/b4a502d173a22b3947a0
// 戻り値: "ok" で正しく送信されました.
const sendText = async function(
    webhook, message, userName, icon, channel, options) {
    // Array形式の場合は、改行をセットして文字列化.
    if(Array.isArray(message)) {
        let n = "";
        const len = message.length;
        for(let i = 0; i < len; i ++) {
            if(i != 0) {
                n += "\n";
            }
            n += message[i];
        }
        message = n;
    }

    // 基本送信データ.
    const body = {
        "text": message,
    };
    // 書き込みユーザ名(userName)を設定.
    if(typeof(userName) == "string" && userName.length > 0) {
        body["username"] = userName;
    }
    // 書き込みアイコン(icon_emoji)を設定.
    if(typeof(icon) == "string" && icon.length > 0) {
        // slackアイコン名に変換.
        if(!icon.startsWith(":")) {
            icon = ":" + icon;
        }
        if(!icon.endsWith(":")) {
            icon = icon + ":";
        }
        body["icon_emoji"] = icon;
    }
    // 送信先チャンネルが設定されている場合は、bodyにセット.
    if(typeof(channel) == "string" && channel.length > 0) {
        // slackチャンネル名に変換.
        if(!channel.startsWith("#")) {
            channel = "#" + channel;
        }
        body["channel"] = channel;
    }
    // option情報に条件が存在する場合.
    if(options != null && options != undefined) {
        for(let k in options) {
            body[k] = options[k];
        }
    }
    // 送信処理.
    return await _sendHttpJson(
        webhook, JSON.stringify(body));
}

// [JSON]メッセージ送信.
// webhook slackのWebHookで提示されたURLを設定します.
// json 送信JSONを設定します.
// 戻り値: "ok" で正しく送信されました.
const sendJSON = async function(webhook, json) {
    // [JSON]送信処理.
    return await _sendHttpJson(webhook,
        JSON.stringify(json));
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.sendText = sendText;
exports.sendJSON = sendJSON;

})();