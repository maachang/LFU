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


// JSON情報をPOST送信.
// url 送信先URLを設定します.
// json 送信対象のJSON情報(string)を設定します.
// 戻り値: HTTPレスポンスBodyが返却されます.
const _sendHttpJson = async function(url, json) {
    // ヘッダ生成.
    const headers = {
        "Content-Type": "application/json",
        "Content-Length": ("" + json.length),
        "X-Header": "X-Header"
    }
    // httpsClient問い合わせ.
    return await httpsClient.request(url, null, {
        method: "POST",
        header: headers,
        body: json,
        // URLで設定.
        directURL: true
    });
}

// [text]メッセージ送信.
// url slackのWebHookで提示されたURLを設定します.
// message 送信メッセージを設定します.
// channel 送信先チャンネルを設定します.
// options その他装飾等を行う場合は、ここに設定します.
//         この辺は https://qiita.com/ik-fib/items/b4a502d173a22b3947a0
// 戻り値: "ok" で正しく送信されました.
const sendText = async function(url, message, channel, options) {
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
    // 送信先チャンネルが設定されている場合は、bodyにセット.
    if(typeof(channel) == "string" && channel.length > 0) {
        body["channel"] = channel;
    }
    // option情報に条件が存在する場合.
    if(options != null && options != undefined) {
        for(let k in options) {
            body[k] = options[k];
        }
    }
    // 送信処理.
    return await _sendHttpJson(url, JSON.stringify(body));
}

// [JSON]メッセージ送信.
// url slackのWebHookで提示されたURLを設定します.
// json 送信JSONを設定します.
// 戻り値: "ok" で正しく送信されました.
const sendJSON = async function(url, json) {
    // [JSON]送信処理.
    return await _sendHttpJson(url, JSON.stringify(json));
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.sendText = sendText;
exports.sendJSON = sendJSON;

})();