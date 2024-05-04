// s3オブジェクトをstream取得支援するための処理.
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// streamBuffer.
const streamBuffer = frequire("./lib/streamBuffer.js");

// 初期設定時のstreamバッファ長.
const STREAM_BUFFER_LENGTH = 65535;

// stream形式に対してStream読み込みを行い、読み込みコールバックをセット.
// s3client s3client.create されたオブジェクトを設定します.
// options {Bucket: string, Key: string, gzip: boolean}
//         - [必須]Bucket 対象のbucket名を設定します.
//         - [必須]Key 対象のkey名を設定します.
//         - [任意]gzip true の場合レスポンスBodyをgzip解凍
//                 しながら取得します.
//        またoptions.responseが設定されます.
//        {status: number, header: object}
// call stream取得される度に呼び出される function(streamBuffer, args, end)
//      を設定します. 
//      - streamBuffer: 現状のstreamBufferが設定されます.
//      - args このfunction reader() の第4引数が設定されます.
//      - end true の場合受信終了を示します.
// args call 実行時に第2引数に渡される引数(dict)を設定します.
exports.reader = async function(
    s3client, options, call, args) {
    
    // stream受取り用バッファ情報.
    const buf = streamBuffer.create(
        STREAM_BUFFER_LENGTH);

    // s3Client処理を実行.
    await s3client.getStreamObject(
        options, function(end, chuned) {
        // 受信中の場合.
        if(end == false) {
            buf.push(chuned);
            call(buf, args, false);
        // 受信終了の場合.
        } else {
            call(buf, args, true);
            buf.destroy();
        }
    });
}

// バイナリコード.
const _DQUOTE = "\"".charCodeAt() & 0x0ff; // "
const _ENTER = "\n".charCodeAt() & 0x0ff; // \n
const _YY = "\\".charCodeAt() & 0x0ff; // \\

// １行のCSV終端を取得.
// buf 対象のstreamBufferを設定します.
// 戻り値: 終端の文字列番号が返却されます.
const indexOfCsvEndRow = function(buf) {
    let n, y, b, quote;
    b = 0;
    y = false;
    quote = -1;
    const len = buf.length();
    for (let i = 0; i < len; i++) {
        n = buf.getByteUnsafe(i);
        // クォーテーション内の場合.
        if (quote != -1) {
            // クォーテーション解除.
            if (!y && quote == n) {
                quote = -1;
            }
            // クォーテーション開始.
        } else if (!y && (n == _DQUOTE)) {
            quote = n;
        // 改行コードの場合.
        } else if (n == _ENTER) {
            // 終端.
            return i;
        }
        // 前￥確認.
        y = n == _YY;
    }
    return -1;
}

// 文字列を置き換える.
const changeString = function(base, src, dest) {
    base = "" + base;
    src = "" + src;
    dest = "" + dest;
    let old = base;
    let val = base;
    while (true) {
        val = val.replace(src,dest);
        if (old == val) {
            return val;
        }
        old = val;
    }
}

// 行単位でCsv読み込み文字列をパース.
// rawString Csv読み込みの文字列.
// parseCode 区切り文字.
// 戻り値: 行単位で区切られたArray[string...]が返却されます.
const parseCsvRow = function(rawString, parseCode) {
    rawString = rawString.trim();
    let len = rawString.length;
    const ret = [];
    let n, m, y, b, quote;
    b = 0;
    y = false;
    quote = -1;
    for(let i = 0; i < len; i ++) {
        n = rawString[i];
        // クォーテーション内の場合.
        if(quote != -1) {
            // クォーテーション解除.
            if(!y && quote == n) {
                quote = -1;
            }
        // クォーテーション開始.
        //} else if(!y && (n == "'" || n == "\"")) {
        } else if(!y && (n == "\"")) {
            quote = n;
        // parseコードの場合.
        } else if(n == parseCode) {
            // 前のポジションからparseコード前までを取得.
            m = rawString.substring(b, i).trim();
            // クォーテーションで囲まれている場合.
            if(m.startsWith("\"") && m.endsWith("\"")) {
                // 囲まれたクォーテーションを外す.
                m = m.substring(1, m.length - 1);
            }
            ret[ret.length] = m;
            m = null;
            // 次の開始ポーションを設定する.
            b = i + 1;
        }
        // 前￥確認.
        y = n == "\\";
    }
    // 最後の情報が残ってる場合は取得する.
    const last = rawString.substring(b, len).trim();
    if(last.length > 0) {
        ret[ret.length] = last;
    }
    // ""xxx"" の条件がある場合変換する.
    len = ret.length;
    let v;
    for(let i = 0; i < len; i ++) {
        // ダブルクォーテーションが存在しない場合は
        // 処理しない.
        if(ret[i].indexOf("\"") == -1) {
            continue;
        }
        v = changeString(ret[i], "\"\"", "\"").trim();
        if(v.startsWith("\"")) {
            v = v.substring(1).trim();
        }
        if(v.endsWith("\"")) {
            v = v.substring(0, v.length - 1).trim();
        }
        ret[i] = v;
    } 
    return ret;
}


// CSV１行のArrayをHeaderIndex化対応.
// header headerIndex 対象のCSVヘッダを設定します.
// row 対象行のArrayを設定します.
// 戻り値: headerKey, valueに変換されます.
const csvRowToKeyValues = function(header, row) {
    const ret = {};
    const len = row.length;
    for(let i =0; i < len; i ++) {
        ret[header[i]] = row[i];
    }
    return ret;
}

// s3上にあるCsvファイルをStream取得.
// s3client s3client.create されたオブジェクトを設定します.
// options
//         (必須)bucket S3Bucket名を設定します.
//         (必須)prefix prefix + key名を設定します.
//         (任意)region 指定しない場合は登用リージョンが設定されます.
//         (任意)header CSVの１行目にヘッダが存在しない場合は
//             　Array(string)でヘッダ名を 設定します.
//         (任意)gzip 対象S3のStreamがgzip形式の場合は true を設定します.
//         (任意)parseCode CSVの区切り文字を設定します.
//         (任意)charset 文字列のcharsetを設定します.
//        またoptions.responseが設定されます.
//        {status: number, header: object}
// call stream取得される度に呼び出される function(row, args)
//      を設定します. 
//      - row: CSVの行数を設定します.
//      - args このfunction csvReader() の第4引数が設定されます.
// args call 実行時に第2引数に渡される引数(dict)を設定します.
exports.csvReader = async function(
    s3client, options, call, args) {
    // CSV区切り文字を取得.
    let parseCode = options.parseCode;
    let charset = options.charset;
    if(typeof(parseCode) != "string") {
        parseCode = ","
    }
    if(typeof(charset) != "string") {
        charset = "utf-8"
    }
    
    // ヘッダ情報.
    let header = undefined;
    // optionsでヘッダ条件が設定されている場合.
    if(options.header != undefined &&
        options.header != null) {
        header = options.header;
    }

    // stream受取り用バッファ情報.
    const buf = streamBuffer.create(
        STREAM_BUFFER_LENGTH);

    // s3Client処理を実行.
    await s3client.getStreamObject(
        options, function(end, chuned) {
        // 受信中の場合.
        if(end == false) {
            buf.push(chuned);
        }

        let p, row;
        // CSV行があるだけ処理.
        while(true) {
            // CSV終端を取得.
            p = indexOfCsvEndRow(buf);
            // 情報が存在しない.
            if(p == -1) {
                // 終了条件でバッファが存在する場合.
                // プラス:ヘッダ情報が存在する場合.
                if(end == true && buf.length() > 0 &&
                    header != undefined) {
                    // 1行のCSVをセット.
                    call(csvRowToKeyValues(
                        header, parseCsvRow(
                            buf.get(buf.length()).toString(
                                charset), parseCode)), args);
                }
                // 処理終了.
                break;
            }
            // 1行情報の情報を取得.
            row = buf.get(p + 1).toString(charset)
            // CSVの終端が見つかった場合.
            row = parseCsvRow(row, parseCode);
            // ヘッダ情報が設定されていない場合は取得.
            if(header == undefined) {
                // 1行目はヘッダなので次の処理.
                header = row;
                continue;
            }
            // CSV変換して処理実行.
            call(csvRowToKeyValues(header, row), args);
            row = null;
        }
    });
}

})();
