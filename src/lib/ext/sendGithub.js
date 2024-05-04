///////////////////////////////////////////////
// 指定githubRepogitoryに対して送信処理.
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

// issue作成対象のURLを取得.
const _getURL = function(oganization, repository) {
    let path;
    if(oganization == undefined || oganization == null ||
        oganization == "") {
        path = "repos/" + repository + "/issues";
    } else {
        path = "repos/" + oganization +
            "/" + repository + "/issues";
    }
    return {
        host: "api.github.com",
        path: path
    }
}

// githubRepogitoryに新しいissueを作成.
// token 対象のTokenを設定します.
// oganization 組織契約しているrepositoryの場合は設定します.
// repository 対象のrepository名を設定します.
// title issueタイトルを設定します.
// body issueボディを設定します.
// labels ラベル群をArray(string)で設定します.
//        ここでのラベルはissueに付くラベル名群.
// 戻り値: {url, title, number}
//         url: 新しいissueのURL.
//         title: issueのタイトル.
//         number: issueの番号.
const createIssue = async function(
    token, oganization, repository, title, body, labels) {
    // URLを生成.
    const url = _getURL(oganization, repository);

    // HTTPヘッダにトークンセット.
    const headers = {
        "Authorization": "token " + token,
        "User-Agent": "lfu/" + Date.now(),
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    };

    // labelsが存在しない場合は空をセット.
    if(labels == undefined || labels == null) {
        labels = [];
    }

    // 送信Payloadを設定.
    const payload = JSON.stringify({
        title: title,
        body: body,
        labels: labels
    });

    // 送信処理.
    const response = {};
    let result = await httpsClient.request(
        url.host, url.path, {
            method: "POST",
            header: headers,
            body: payload,
            response: response
        }
    );
    // responseのstatusが400以上の場合.
    if(response.status >= 400) {
        // エラー表示.
        throw new Error("HTTPエラーステータス: " +
            response.status + " が発生しました: " +
            JSON.stringify(url, null, "  "));
    }
    // 返却結果を取得して、返却.
    result = JSON.parse(result.toString()); 
    return {
        url: result.html_url,
        title: result.title,
        number: result.number
    };
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.createIssue = createIssue;

})();