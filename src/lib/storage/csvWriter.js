///////////////////////////////////////////////
// Csv書き込み用オブジェクト.
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

// ヘッダーキーを作成.
// headerKeyList ヘッダキー群(["key1", "key2", "key3"....])を設定します.
// 戻り血: {"key1": 0, "key2": 1, "key3": 2 ....} のような形で返却されます.
const createHeaderKeys = function(headerKeyList) {
    const ret = {};
    const len = headerKeyList.length;
    for(let i = 0; i < len; i ++) {
        ret[headerKeyList[i]] = i;
    }
    return ret;
}

// 出力内容によっては ダブルクォーテーション を付与する.
// parseCode CSV区切り文字を設定します.
// value １つのColumnValueを設定します.
// 戻り値: 変換されたColumnValueが返却されます.
const outValue = function(parseCode, value) {
    if(value == null || value == undefined) {
        return "";
    }
    // 文字列変換(trim).
    value = ("" + value).trim();

    // ダブルクォーテーションが設定されている場合.
    if(value.indexOf("\"") != -1) {
        // CSVの項目内のダブルクォーテーションは["]を[""]に
        // 設定する必要がある.
        let c;
        // 前後にダブルクォーテーションをセット.
        let res = "\"";
        const len = value.length;
        for(let i = 0; i < len; i ++) {
            // ["]を[""]にする.
            if((c = value[i]) == "\"") {
                res += "\"";
            }
            res += c;
        }
        // 前後にダブルクォーテーションをセット.
        res += "\"";
        value = res;
    // parseCodeが入ってる場合.
    } else if(value.indexOf(parseCode) != -1) {
        // 前後にダブルクォーテーションをセット.
        value = "\"" + value + "\"";
    }
    return value;
}

// デフォルトのValue変換出力.
// value 変換元のcolumnValueを設定します.
// 戻り値: 文字列に変換された内容が返却されます.
const defaultConvertFunc = function(value) {
    if(value == null || value == undefined) {
        return "";
    }
    const type = typeof(value);
    if(type == "number") {
        return value.toString();
    } else if(type == "boolean") {
        return value.toString();
    } else if(type == "string") {
        return value.toString();
    } else if(value instanceof Date) {
        return value.toString();
    }
    return JSON.stringify(value);
}

// CsvWriterを生成.
// headers Csvヘッダ情報をArray形式で設定します.
//         ["name", "id", "description"] とすることで
//         ３つのCSVヘッダが設定されます.
// options オプションを設定します.
//   {parseCode: string} 区切り文字を設定します.
//   {convertFunc: function} CsvWriter.putで渡されるvalueに対して
//                           カスタムな文字変換処理が行なえます.
//                           function(value) 戻り値 String型 の定義を
//                           設定してください.
const createCsvWriter = function(headers, options) {
    let parseCode = undefined;
    let convertFunc = undefined;

    // オプションが設定されている場合.
    if(options != null && options != undefined) {
        parseCode = options.parseCode;
        convertFunc = options.convertFunc;
    }

    // ヘッダ長.
    const headerLength = headers.length;

    // ヘッダーキーを生成.
    const headerKeys = createHeaderKeys(headers);

    // Csv区切り文字.
    if(parseCode == null || parseCode == undefined) {
        parseCode = ",";
    }

    // convertFunc.
    if(typeof(convertFunc) != "function") {
        convertFunc = defaultConvertFunc;
    }

    // 1行情報.
    const oneLine = new Array(headerLength);

    // Csv書き込み結果(String).
    let body = "";

    // 書き込み行数.
    let rowCount = 0;

    // ヘッダ書き込み.
    const _writeHeader = function() {
        // ヘッダを出力.
        for(let i = 0; i < headerLength; i ++) {
            if(i != 0) {
                body += parseCode;
            }
            body += outValue(parseCode, headers[i]);
        }
        body += "\n";
    }

    // ヘッダ書き込み.
    _writeHeader();

    /////////////////////////////////////////////////////
    // オブジェクト郡.
    /////////////////////////////////////////////////////
    const ret = {};

    // 情報クリア.
    ret.clear = function() {
        body = "";
        rowCount = 0;
        _writeHeader();
        for(let i = 0; i < headerLength; i ++) {
            oneLine[i] = undefined;
        }
    }

    // 書き込みCSV情報を取得.
    // 戻り値: 現在書き込み中のCSVデータが返却されます.
    ret.getWriteCsv = function() {
        return body;
    }

    // 書き込みCSV情報を取得.
    // 戻り値: 現在書き込み中のCSVデータが返却されます.
    ret.toString = function() {
        return body;
    }

    // 現在の行情報を出力.
    // オブジェクトが返却されます.
    ret.next = function() {
        for(let i = 0; i < headerLength; i ++) {
            if(i != 0) {
                body += parseCode;
            }
            body += outValue(parseCode, oneLine[i]);
            oneLine[i] = undefined;
        }
        body += "\n";
        rowCount ++;
        return ret;
    }

    // １つのカラム条件をセット.
    // key 対象のカラム名を設定します.
    // value 対象の要素を設定します.
    // 戻り値: オブジェクトが返却されます.
    ret.put = function(key, value) {
        const no = headerKeys[key];
        if(no == undefined) {
            throw new Error(
                "Specified Column(" + key +
                ") does not exist.");
        }
        oneLine[no] = convertFunc(value);
        return ret;
    }

    // 書き込み行数を取得.
    // 戻り値: 書き込み行数が返却されます.
    ret.count = function() {
        return rowCount;
    }

    // ヘッダ一覧を取得.
    // 戻り値: ヘッダ一覧が返却されます.
    ret.getHeaders = function() {
        const ret = new Array(headerLength);
        for(let i = 0; i < headerLength; i ++) {
            ret[i] = headers[i];
        }
        return ret;
    }

    // ヘッダサイズを取得.
    // 戻り値: ヘッダ数が返却されます.
    ret.getHeaderLength = function() {
        return headerLength;
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.createCsvWriter = createCsvWriter;

})();