///////////////////////////////////////////////
// Csv読み込み用オブジェクト.
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

// 行単位でCsv読み込み文字列を分解.
// s Csv読み込みの文字列.
// pc 区切り文字.
// 戻り値: 行単位で区切られた文字列が返却されます.
const parseEnter = function(s, pc) {
    let n, y, b, quote;
    b = 0;
    y = false;
    quote = -1;

    // 元のCSV文字列をtrim.
    s = s.trim() + "\n";

    const len = s.length;
    const ret = [];

    for (let i = 0; i < len; i++) {
        n = s[i];
        // クォーテーション内の場合.
        if (quote != -1) {
            // クォーテーション解除.
            if (!y && quote == n) {
                quote = -1;
            }
            // クォーテーション開始.
        //} else if (!y && (n == "'" || n == "\"")) {
        } else if (!y && (n == "\"")) {
            quote = n;
            // 改行コードの場合.
        } else if (n == "\n") {
            // 開始ポジションから改行コードまでの１行を取得.
            // １行のパースを楽にするために末尾に区切り文字をセット.
            ret[ret.length] = s.substring(b, i + 1)
                .trim() + pc;
            // 次の開始ポーションを設定する.
            b = i + 1;
        }
        // 前￥確認.
        y = n == "\\";
    }
    return ret;
}

// 行単位でCsv読み込み文字列をパース.
// rawString Csv読み込みの文字列.
// parseCode 区切り文字.
// 戻り値: 行単位で区切られたArray[string...]が返却されます.
const parseCsv = function(rawString, parseCode) {
    if(parseCode == undefined) {
        parseCode = ",";
    }
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

// ヘッダーキーを作成.
const createHeaderKeys = function(out, headerKeyList) {
    const len = headerKeyList.length;
    for(let i = 0; i < len; i ++) {
        out[headerKeyList[i]] = i;
    }
}

// デフォルトのColumnタイプ単位の変換処理を行う.
// type 変換タイプを設定します.
//      number 数字変換します.
//      string 文字変換します.
//      boolean Boolean変換します.
//      それ以外 json形式で返却します.
// value 変換文字列を設定します.
// 戻り値: 変換された内容が返却されます.
const defaultConvertFunc = function(type, value) {
    switch(type) {
        case 'number': return parseFloat(value);
        case 'string': return "" + value;
        case 'boolean':
            value = ("" + value).trim().toLowerCase();
            return (value == "true" || value == "on" || value == "t");
        case 'date': return new Date(("" + value).trim());
    }
    return JSON.parse(("" + value).trim());    
}

// CsvRowを生成.
// columnHeader カラムヘッダを設定します.
// convertFunc カスタムな変換処理を設定します.
//             設定しない場合はデフォルト設定されます.
//             形式は function(type, value) で定義します.
//              type は number, string, boolean, date の文字が
//              設定されます.
//              value は 変換対象の情報が設定されます.
const createCsvRow = function(columnHeader, convertFunc) {
    let list = null;
    
    // convertFuncが設定されていない場合.
    if(typeof(convertFunc) != "function") {
        // デフォルトの変換形式を設定.
        convertFunc = defaultConvertFunc;
    }

    // CSVのダブルクォーテーション["]に対する変換処理.
    // CSVの場合、内部でダブルクォーテーション["]を扱う場合
    // [""]が１つの単位で利用されるので、これらを１つに
    // 置きかえる.
    // str 対象の文字列を設定します.
    // 戻り値: 変換された内容が返却されます.
    const _convertDoubleQuotation = function(str) {
        // 事前調べ.
        if(str.indexOf("\"\"") == -1) {
            return str;
        }
        // 存在する場合は２連続ダブルクォーテーションを１つにする.
        let c;
        let ret = "";
        const len = str.length;
        for(let i = 0; i < len; i ++) {
            c = str[i];
            if(i + 1 < len && c == "\"" &&
                str[i + 1] == "\"") {
                i ++;
            }
            ret += c;
        }
        return ret;
    }

    // 条件を指定して内容を取得.
    // n 取得条件を設定します.
    // 戻り値: 取得内容が返却されます.
    const _get = function(n) {
        let ret;
        // 条件は数字.
        if(typeof(n) == "number") {
            ret = list[n];
        // 条件は文字列.
        } else {
            let keyNo = columnHeader["" + n];
            if(keyNo == undefined) {
                return undefined;
            }
            ret = list[keyNo]
        }
        return _convertDoubleQuotation(ret);
    }

    /////////////////////////////////////////////////////
    // オブジェクト郡.
    /////////////////////////////////////////////////////
    const ret = {};

    // 次の条件をセット.
    // c 今回読み込むCsvColumnsリストを設定します.
    // 戻り値: このオブジェクトが返却されます.
    ret.next = function(c) {
        list = c;
        return ret;
    }

    // 指定条件で存在するかチェック.
    // name 取得条件を設定します.
    // 戻り値: 存在する場合 true.
    ret.contains = function(name) {
        let ret = _get(name);
        return ret != undefined;
    }

    // String型で取得.
    // name 取得条件を設定します.
    // 戻り値: 取得内容がString型で返却されます.
    ret.getString = function(name) {
        let ret = _get(name);
        if(ret == undefined) {
            return undefined;
        }
        return convertFunc("string", ret);
    }

    // Number型で取得.
    // name 取得条件を設定します.
    // 戻り値: 取得内容がNumber型で返却されます.
    ret.getNumber = function(name) {
        let ret = _get(name);
        if(ret == undefined) {
            return undefined;
        }
        return convertFunc("number", ret);
    }

    // Boolean型で取得.
    // name 取得条件を設定します.
    // 戻り値: 取得内容がBoolean型で返却されます.
    ret.getBoolean = function(name) {
        let ret = _get(name);
        if(ret == undefined) {
            return undefined;
        }
        return convertFunc("boolean", ret);
    }

    // Date型で取得.
    // name 取得条件を設定します.
    // 戻り値: 取得内容がDate型で返却されます.
    ret.getDate = function(name) {
        let ret = _get(name);
        if(ret == undefined) {
            return undefined;
        }
        return convertFunc("date", ret);
    }

    // JSON型で取得.
    // name 取得条件を設定します.
    // 戻り値: 取得内容がJSON型で返却されます.
    ret.getJSON = function(name) {
        let ret = _get(name);
        if(ret == undefined) {
            return undefined;
        }
        return convertFunc("json", ret);
    }

    // 長さを取得.
    // 戻り値: 長さが返却されます.
    ret.length = function() {
        return list.length;
    }

    // 行情報を全て、JSON変換する.
    // 戻り値: {key: value, ...} の結果が返却されます.
    ret.toJSON = function() {
        const ret = {};
        for(let k in columnHeader) {
            ret[k] = _get(k);
        }
        return ret;
    }

    return ret;
}

// CsvReaderを生成.
// csvString Csv読み込みの文字列を設定します.
// options オプションを設定します.
//   {parseCode: string} 区切り文字を設定します.
//   {convertFunc: function} カスタムな変換処理を設定します.
//                           設定しない場合はデフォルト設定されます.
//   {headerKeyArray: array} デフォルトのヘッダーキー郡をArray型で設定します.
//                           これを設定しない場合指定CSV文字列の１行目をHeaderKeyと
//                           します.
//   {jsIterator: boolean} trueの場合 javascriptのiterator的実装が利用できます.
//                         falseの場合 Java的: hasNext, next形式になります.
// jsIteratorMode javascript用のIterator実装を行う場合 trueを設定.
const createCsvReader = function(csvString, options) {
    let parseCode = undefined;
    let convertFunc = undefined;
    let defaultHeaderKeyArray = undefined;
    let jsIterator = undefined;

    // オプションが設定されている場合.
    if(options != null && options != undefined) {
        parseCode = options.parseCode;
        convertFunc = options.convertFunc;
        defaultHeaderKeyArray = options.headerKeyArray;
        jsIterator = options.jsIterator;
    }
    jsIterator = jsIterator == true;
    
    // 現在の読み込み位置.
    let nowLine = 0;
    // リセット開始位置.
    let resetLine = 0;
    // ヘッダカラム名.
    // {key: no} で格納して、キー名で頭出しをする.
    let headerKeys = {};

    /////////////////////////////////////////////////////
    // 初期処理.
    /////////////////////////////////////////////////////

    // parseCodeが空の場合.
    if(parseCode == null || parseCode == undefined) {
        // 区切り文字.
        parseCode = ",";
    }

    // 改行単位で区切る.
    const srcCsv = parseEnter(csvString, parseCode);

    // csvHeader.
    let headers = null;

    // defaultHeaderKeyArrayがArrayの場合.
    if(Array.isArray(defaultHeaderKeyArray)) {
        // 指定ヘッダをセット.
        headers = defaultHeaderKeyArray;
        // defaultHeaderKeyArrayをヘッダーキーとして処理.
        createHeaderKeys(headerKeys, headers);
    } else {
        // CSVの１行目をヘッダとして取得.
        headers = parseCsv(srcCsv[0], parseCode);
        // srcCsv[0]をヘッダーキーとして処理.
        createHeaderKeys(headerKeys, headers);
        // nowLineを1進める.
        nowLine = 1;
        // リセット開始位置をセット.
        resetLine = 1;
    }

    // CsvRowを作成.
    const csvRow = createCsvRow(headerKeys, convertFunc);
    // headerKeysを削除.
    headerKeys = null;

    /////////////////////////////////////////////////////
    // オブジェクト郡.
    /////////////////////////////////////////////////////
    const ret = {};

    // js用iteratorの場合.
    if(jsIterator) {

        // 次の情報を読み込む.
        // 戻り値: {value: CsvRow, done: boolean} １行を読み込む情報が返却されます.
        ret.next = function() {
            if(nowLine >= srcCsv.length) {
                return {
                    value: null,
                    done: true
                };
            }
            // １つの読み込み情報行を返却.
            return {
                value: csvRow.next(
                    parseCsv(srcCsv[nowLine ++], parseCode)),
                done: false
            };
        }
        
    // java的: hasNext, next形式.
    } else {
        
        // 次の情報が存在するかチェック.
        // 戻り値; trueの場合、存在します.
        ret.hasNext = function() {
            if(nowLine >= srcCsv.length) {
                return false;
            }
            return true;
        }

        // 次の情報を読み込む.
        // 戻り値: CsvRow １行を読み込む情報が返却されます.
        ret.next = function() {
            if(nowLine >= srcCsv.length) {
                throw new Error("CsvReader: Reading past EOF.");
            }
            // １つの読み込み情報行を返却.
            return csvRow.next(parseCsv(srcCsv[nowLine ++], parseCode));
        }
    }

    // jsIterator対応か取得.
    // 戻り値: trueの場合、js用のiteratorです.
    ret.isJsIterator = function() {
        return jsIterator;
    }

    // ポジションをリセットして最初から読み込む.
    // 戻り値: このオブジェクトが返却されます.
    ret.resetPosition = function() {
        nowLine = resetLine;
        return ret;
    }

    // CSVヘッダ情報群を取得.
    // 戻り値: 設定されているHTTPヘッダ情報を取得.
    ret.getHeaders = function() {
        return headers;
    }

    return ret;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.createCsvReader = createCsvReader;

})();
