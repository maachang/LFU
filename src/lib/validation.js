///////////////////////////////////////////////////////////
// validation処理.
// HTTPのGETやPOSTのパラメータのvalidation処理を行う.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// method.
const METHOD = {
    "all": "*",
    "get": "GET",
    "post": "POST",
    "delete": "DELETE",
    "put": "PUT",
    "patch": "PATCH"
};

// Validate型.
const MODEL = {
    "none": 0,
    "string": 1,
    "integer": 2,
    "float": 3,
    "boolean": 4,
    "calendar": 5,
    "time": 6,
    "timestamp": 7,
    "date": 8
};

// validateエラーの返却処理.
// status 対象のHTTPステータスを設定します.
// message 対象のHTTPステータスメッセージを設定します.
const resultError = function(status, message) {
    throw new HttpError({
        status: status, message: message});
}

// [validate]デフォルト定義.
const defaultValue = function(define, value) {
    // valueが存在しない.
    if(isNull(value)) {
        // defineも定義されていない.
        if(isNull(define)) {
            return undefined;
        }
        // default値を返却.
        return define;
    }
    return value;
}

// 定義されていない場合.
const isNull = function(value) {
    return (value == null || value == undefined);
}

// 数値のみの場合.
// value 対象の条件を設定します.
// 戻り値: 数字の場合はtrue返却.
const isNumber = function(value) {
    return !isNaN(parseFloat(value));
}

// 整数変換を行う.
// value 対象の条件を設定します.
// 戻り値: 変換された整数が返却されます.
const convertInt = function(value) {
    const ret = parseInt(value);
    if(isNaN(ret)) {
        resultError(500,
            "Integer conversion failed: " + value);
    }
    return ret;
}

// 浮動小数点変換を行う.
// value 対象の条件を設定します.
// 戻り値: 変換された浮動小数点が返却されます.
const convertFloat = function(value) {
    const ret = parseFloat(value);
    if(isNaN(ret)) {
        resultError(500,
            "Float conversion failed: " + value);
    }
    return ret;
}

// valueを型条件に従って変換.
// model 変換対象の型を設定します.
// value 変換対象のvalueを設定します.
// 戻り値: 変換結果が返却されます.
const conertValue = function(name, model, value) {
    // modelが定義されていない場合、そのまま返却.
    // または、define定義で文字列以外の場合.
    if(isNull(model)) {
        return value;
    }
    // 指定タイプを取得.
    const modelNum = isNumber(model) ?
        parseInt(model) :
        MODEL[(""+model).toLowerCase()];
    // タイプが対象外 or noneの場合.
    if(modelNum == undefined || modelNum == 0) {
        return value;
    }
    // valueを整形.
    value = (value == null || value == undefined) ?
        "" : value;
    // それぞれのタイプ変換.
    switch(modelNum) {
        case 1: return value;
        case 2: return convertInt(value);
        case 3: return convertFloat(value);
        case 4: return ("" + value.toLowerCase()) == "true";
        case 5: return new Calendar(value);
        case 6: return new Time(value);
        case 7: return new Timestamp(value);
        case 8: return new Timestamp(value);
    }
    // それ以外の該当しない条件の場合はエラー.
    resultError(500,
        "Specified conversion model (" +
        model + ") does not match(name: " +
        name + ")");
}

// クォーテーションカット.
// 対象の文字列を設定します.
// クォーテーションがカットされた内容が返却されます.
const cutQuotation = function(n) {
    return ((n[0] == "\"" && n[n.length - 1] == "\"") ||
        (n[0] == "\'" && n[n.length-1] == "\'")) ?
        n.substring(1 ,n.length - 1).trim() : n;
}

// [validate]存在確認.
const v_required = function(value) {
    return value != null && value != undefined ||
        (typeof(validate) == "string" && value.length > 0);
}

// [validate]正規表現.
const v_regex = function(value, reg) {
    if(!(reg instanceof RegExp)) {
      reg = new RegExp(""+reg);
    }
    return v_required(value) && (reg.test(""+value));
}

// 正規表現: URLチェック.
const r_url =
    new RegExp("https?://[\\w/:%#\\$&\\?\\(\\)~\\.=\\+\\-]+");
// 正規表現: emailチェック.
const r_email =
    new RegExp("\\w{1,}[@][\\w\\-]{1,}([.]([\\w\\-]{1,})){1,3}$");
// 正規表現: date(yyyy/MM/dd)チェック.
const r_date =
    new RegExp("^\\d{2,4}\\/([1][0-2]|[0][1-9]|[1-9])\\/([3][0-1]|[1-2][0-9]|[0][1-9]|[1-9])$");
// 正規表現: Time(HH:mm)チェック.
const r_time =
    new RegExp("^([0-1][0-9]|[2][0-3]|[0-9])\\:([0-5][0-9]|[0-9])$");

// validate条件.
const V_TERMS = {
    // [validate]存在確認.
    required: function(reg) {
        return function(value) {
            return v_required(value, reg);
        }
    },
    // [validate]min.
    min: function(len) {
        return function(value, name, model) {
            model = model|0;
            if(!isNumber(len)) {
                resultError(500, "[terms]min len undefined: " + name);
            }
            len = len|0;
            switch(model) {
                case 1: return v_required(value) && (""+value).length >= len;
                case 2:case 3: return v_required(value) && value >= len;
            }
            return false;
        }
    },
    // [validate]max.
    max: function(len) {
        return function(value, name, model) {
            model = model|0;
            if(!isNumber(len)) {
                resultError(500, "[terms]max len undefined: " + name);
            }
            len = len|0;
            switch(model) {
                case 1: return v_required(value) && (""+value).length <= len;
                case 2: case 3: return v_required(value) && value <= len;
            }
            return false;
        }
    },
    // [validate]range.
    range: function(start, end) {
        return function(value, name, model) {
            model = model|0;
            if(!isNumber(start)) {
                resultError(500, "[terms]range start undefined: " + name);
            } else if(!isNumber(end)) {
                resultError(500, "[terms]range end undefined: " + name);
            }
            start = start|0;
            end = end|0;
            if(v_required(value)) {
                if(model == 1) {
                    value = (""+value).length;
                } else if(typt != 2 && model != 3) {
                    return false;
                }
                return value >= start && value <= end;
            }
            return false;
        }
    },
    // [validate]url正規表現.
    url: function() {
        return function(value) {
            return v_regex(value, r_url);
        }
    },
    // [validate]email正規表現.
    email: function() {
        return function(value) {
            return v_regex(value, r_email);
        }
    },
    // [validate]date正規表現.
    date: function() {
        return function(value) {
            return v_regex(value, r_date);
        }
    },
    // [validate]time正規表現.
    time: function() {
        return function(value) {
            return v_regex(value, r_time);
        }
    },
    // [validate]正規表現.
    regex: function(reg) {
        return function(value) {
            return v_regex(value, reg);
        }
    }
}

// validation処理.
// method このメソッド以外は対応しない条件を設定します.
//        "all" or "*" or undefined or null で全てのHTTPメソッドを許可します.
//        "GET" で、GETメソッドを許可します.
//        "POST" で、POSTメソッドを許可します.
//        "DELETE" で、DELETEメソッドを許可します.
//        "PUT" で、PUTメソッドを許可します.
//        "PATCH" で、PATCHメソッドを許可します.
// validate 対象のvalidate条件をObject型で設定します.
//          [
//            {name: string, model: number, terms: string, define: object},
//            ・・・・
//          ]
//          name: (必須)パラメータ名を設定します.
//          model: (オプション)Validate型を数字で設定します.
//                 設定しない場合は文字列となります
//          terms (オプション)validate条件を設定します.
//                存在しない場合は内容チェックしません.
//          define (オプション)パラメータに存在しない定義の場合、この値が
//                 割り当てられます.
// request 対象のHTTPリクエストを設定します.
// 戻り値: validateで変換されたパラメータが返却されます.
const execute = function(method, validate, request) {
    // validateメソッドが存在する場合.
    if(!isNull(method) && method != VM_ALL) {
        method = (method + "").toUpperCase();
        const rMethod = request.method;
        // requestのmethodとvalidateのメソッドが一致しない場合.
        if(rMethod != method) {
            // 400 エラー.
            resultError(400, "Disallowed Method: " + rMethod);
        }
    }
    // validate条件が設定されている場合.
    if(Array.isArray(validate)) {
        const ret = {};
        const len = validate.length;
        let params = request.params;
        if(isNull(params)) {
            // パラメータが存在しない場合、空をセット.
            params = {};
        }
        let em, name, value, model, terms;
        for(let i = 0; i < len; i ++) {
            em = validate[i];
            name = em.name;
            model = em.model;
            terms = em.terms;
            // validate定義がおかしい場合.
            if(typeof(name) != "string" ||
                (!isNull(terms) && typeof(terms) != "function")
            ) {
                // 構成のエラー返却.

            }
            // valueが存在しなくてdefineがあれば、その値.
            value = defaultValue(em.define, params[name]);
            // value変換.
            value = conertValue(name, model, value);
            // validateチェック.
            if(!isNull(terms)) {
                // validateエラー.
                if(!terms(value, name, model)) {
                    // validateのエラー返却.

                }
            }
            // 正常パラメータをセット.
            ret[name] = value;
        }
        // 元のパラメータを srcParamsで設定.
        request["srcParams"] = request.params;
        // validateされたパラメータを正式のパラメータでセット.
        request["params"] = ret;
        // 返却処理.
        return ret;
    }
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////

// [validate定数]method.
for(let k in METHOD) {
    global["VM_" + k.toUpperCase()] = METHOD[k];
}

// [validate定数]変換型定義名.
for(let k in MODEL) {
    global["VC_" + k.toUpperCase()] = MODEL[k];
}

// [validate定数]validate条件.
for(let k in V_TERMS) {
    global["VT_" + k.toUpperCase()] = V_TERMS[k];
}

// validate処理.
exports.execute = execute;

})();