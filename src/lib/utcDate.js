/////////////////////////////////////////////////
// UTC-Date.
// timezoneを扱わない現地時間に対する統一した日付を
// 利用したい場合にこれを使う.
/////////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// TZ名に対するタイムゾーン(分単位)値.
const TZ_DICT = {
    "Africa/Johannesburg": -120,
    "Africa/Lagos": -60,
    "Africa/Windhoek": -120,
    "America/Adak": 540,
    "America/Anchorage": 480,
    "America/Argentina/Buenos_Aires:": 0,
    "America/Bogota": 300,
    "America/Caracas": 240,
    "America/Chicago": 300,
    "America/Denver": 360,
    "America/Godthab": 120,
    "America/Guatemala": 360,
    "America/Halifax": 180,
    "America/Los_Angeles": 420,
    "America/Montevideo": 180,
    "America/New_York": 240,
    "America/Noronha": 120,
    "America/Phoenix": 420,
    "America/Santiago": 180,
    "America/Santo_Domingo": 240,
    "America/St_Johns": 150,
    "Asia/Baghdad": -180,
    "Asia/Baku": -240,
    "Asia/Beirut": -180,
    "Asia/Dhaka": -360,
    "Asia/Dubai": -240,
    "Asia/Irkutsk": -480,
    "Asia/Jakarta": -420,
    "Asia/Kabul": -270,
    "Asia/Kamchatka": -720,
    "Asia/Karachi": -300,
    "Asia/Kathmandu": -345,
    "Asia/Kolkata": -330,
    "Asia/Krasnoyarsk": -420,
    "Asia/Omsk": -360,
    "Asia/Rangoon": -390,
    "Asia/Shanghai": -480,
    "Asia/Tehran": -210,
    "Asia/Tokyo": -540,
    "Asia/Vladivostok": -600,
    "Asia/Yakutsk": -540,
    "Asia/Yekaterinburg": -300,
    "Atlantic/Azores": 0,
    "Atlantic/Cape_Verde": 60,
    "Australia/Adelaide": -570,
    "Australia/Brisbane": -600,
    "Australia/Darwin": -570,
    "Australia/Eucla": -525,
    "Australia/Lord_Howe": -630,
    "Australia/Sydney": -600,
    "Etc/GMT+12": 720,
    "Europe/Berlin": -120,
    "Europe/London": -60,
    "Europe/Moscow": -180,
    "Pacific/Apia": -780,
    "Pacific/Auckland": -720,
    "Pacific/Chatham": -765,
    "Pacific/Easter": 300,
    "Pacific/Gambier": 540,
    "Pacific/Honolulu": 600,
    "Pacific/Kiritimati": -840,
    "Pacific/Majuro": -720,
    "Pacific/Marquesas": 570,
    "Pacific/Norfolk": -660,
    "Pacific/Noumea": -660,
    "Pacific/Pago_Pago": 660,
    "Pacific/Pitcairn": 480,
    "Pacific/Tongatapu": -780,
    "UTC": 0
}

// 元のTZ_OFFSET.
const SRC_TZ_OFFSET = new Date().getTimezoneOffset();

// タイムゾーン(分)値に対するTZ名.
const TZ_TIME_TZ_NAME = {}
for(let k in TZ_DICT) {
    TZ_TIME_TZ_NAME[TZ_DICT[k]] = k
    process.env.TZ = k
}

// 元のTimeZone名と同じTimeZoneの環境変数にセット.
process.env.TZ = TZ_TIME_TZ_NAME[SRC_TZ_OFFSET];

// UTCのTZ環境変数セット.
const toUTCEnv = function() {
    const old = process.env.TZ;
    process.env.TZ = "UTC"
    return old;
}

// 元のTZに戻す.
const setTzEnv = function(v) {
    process.env.TZ = v
}

// 元のDate#getTimezoneOffset()が0の場合のデフォルト値.
// JTS.
let DEFAULT_TZ_OFFSET = -540;

// new Date()処理.
const newDate = function() {
    const ag = arguments;
    const len = ag.length;
    let old = ""
    try {
        // tzをUTCセット.
        old = toUTCEnv();
        // 最大10引数に対応.
        switch(len) {
            case 0:
                return new Date();
            case 1:
                return new Date(ag[0]);
            case 2:
                return new Date(ag[0], ag[1]);
            case 3:
                return new Date(ag[0], ag[1], ag[2]);
            case 4:
                return new Date(ag[0], ag[1], ag[2], ag[3]);
            case 5:
                return new Date(ag[0], ag[1], ag[2], ag[3],
                    ag[4]);
            case 6:
                return new Date(ag[0], ag[1], ag[2], ag[3],
                    ag[4], ag[5]);
            case 7:
                return new Date(ag[0], ag[1], ag[2], ag[3],
                    ag[4], ag[5], ag[6]);
            case 8:
                return new Date(ag[0], ag[1], ag[2], ag[3],
                    ag[4], ag[5], ag[6], ag[7]);
            case 9:
                return new Date(ag[0], ag[1], ag[2], ag[3],
                    ag[4], ag[5], ag[6], ag[7], ag[8]);
        }
        return new Date(ag[0], ag[1], ag[2], ag[3], ag[4],
            ag[5], ag[6], ag[7], ag[8], ag[9]);
    } finally {
        // tzを元に戻す.
        setTzEnv(old);
    }
}

// 現在Dateを取得.
const nowDate = function() {
    const now = new Date();
    // 元のタイムゾーンをマイナスする.
    // これにより現地時間をUTCに変換できる.
    // ただし 元からタイムゾーンが0の場合はデフォルトのタイムアウト値
    // (デフォルト値は 'Asia/Tokyo' を対象とする.
    let tzOffet = SRC_TZ_OFFSET;
    if(tzOffet == 0) {
        // ただSRC_TZ_OFFSET == 0 の場合はデフォルトTZ_OFFSET値で
        // 計算するようにする.
        tzOffet = DEFAULT_TZ_OFFSET;
    }
    return newDate(now.getTime() - (tzOffet * 60000));
}

// dateオブジェクトを作成.
const createDate = function(y, m, d) {
    let date;
    // 設定なし.
    if(y == undefined || y == null) {
        date = nowDate();
    // y, m, d で設定.
    } else if(typeof(y) == "number") {
        if(typeof(m) == "number") {
            if(typeof(d) == "number") {
                date = newDate(y, m, d);
            } else {
                date = newDate(y, m);
            }
        } else {
            date = newDate(y);
        }
    // 文字列で設定.
    } else if(typeof(y) == "string") {
        date = newDate(y);
    // Dateオブジェクトで設定.
    } else if(y instanceof Date) {
        date = newDate(y);
    // UtcDateオブジェクトが設定された場合.
    } else if(y.UTC_DATE_SIMBOL == "utcDate") {
        date = y.rawDate();
    }
    // 正しく生成されているかチェック.
    if(date == undefined || isNaN(date.getFullYear())) {
        // エラーの場合.
        let args = "";
        if(y != undefined) {
            args += " [0]: " + y;
        }
        if(m != undefined) {
            args += " [1]: " + m;
        }
        if(d != undefined) {
            args += " [2]: " + d;
        }
        throw new Error(
            "utc-dateの作成に失敗しました:" + args);
    }
    return date;
}

// dateを文字列変換.
// ここで渡されるオブジェクトは utcDate.create()の
// 内容なので、内部はUTCは使わない。
const dateToString = function(object, mode) {
    let ret = ""
    let y = "" + object.getFullYear();
    y = "0000".substring(y.length) + y;
    ret += y;
    // 年出力.
    if(mode == "year") {
        return ret;
    }
    let M = "" + (object.getMonth() + 1);
    M = "00".substring(M.length) + M;
    ret += "-" + M;
    // 月出力.
    if(mode == false || mode == "month") {
        return ret;
    }
    // 日出力.
    let d = "" + object.getDate();
    ret += "-" + "00".substring(d.length) + d
    if(mode == true || mode == "date") {
        return ret;
    }
    // full.
    let h = "" + object.getHours();
    h = "00".substring(h.length) + h;
    let m = "" + object.getMinutes();
    m = "00".substring(m.length) + m;
    let s = "" + object.getSeconds();
    s = "00".substring(s.length) + s;
    let sss = "" + object.getMilliseconds();
    sss = "000".substring(sss.length) + sss;
    return ret + " " + h + ":" + m + ":" + s + "." + sss;
}

// 開始/終了日を取得.
// date = Dateオブジェクトである必要がある.
const between = function(date, mode) {
    // dateが設定されていない場合.
    if(date == undefined || date == null) {
        date = nowDate();
    // 文字列で設定.
    } else if(typeof(date) == "string") {
        date = newDate(date);
    // UtcDateオブジェクトが設定された場合.
    } else if(date.UTC_DATE_SIMBOL == "utcDate") {
        date = date.rawDate();
    }

    // modeを整形.
    if(mode == undefined || mode == null) {
        mode = "date";
    } else {
        mode = (""+mode).trim();
    }

    let start, end;

    // 年の開始終了を返却.
    if(mode == "year") {
        start = create(date.getUTCFullYear(), 0, 1);
        end = create(date.getUTCFullYear() + 1, 0, 1);
        end = create(end.getTime() - 1);
        return {start: start, end: end};
    }
    // 月の開始終了を返却.
    if(mode == false || mode == "month") {
        start = create(date.getUTCFullYear(), date.getUTCMonth(), 1);
        end = create(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
        end = create(end.getTime() - 1);
        return {start: start, end: end};
    }
    // 週の開始終了を返却.
    if(mode == "week") {
        const d = date.getUTCDay();
        start = create(date).change("date", (d * -1));
        end = create(date).change("date", (6 - d));
        return {start: start, end: end};
    }
    // 日の開始終了を返却.
    start = create(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    end = create(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
    end = create(end.getTime() - 1);
    return {start: start, end: end};
}

// UTCDateオブジェクト作成.
const create = function(y, m, d) {
    // 情報元となるDateオブジェクトを作成.
    let date = createDate(y, m, d);
    // export先..
    const o = {};
    // UtcDateオブジェクトを示す情報.
    o.UTC_DATE_SIMBOL = "utcDate";
    
    o.getFullYear = function() {
        return date.getUTCFullYear();
    }
    o.getMonth = function() {
        return date.getUTCMonth();
    }
    o.getDate = function() {
        return date.getUTCDate();
    }
    o.getDay = function() {
        return date.getUTCDay();
    }
    o.getHours = function() {
        return date.getUTCHours();
    }
    o.getMinutes = function() {
        return date.getUTCMinutes();
    }
    o.getSeconds = function() {
        return date.getUTCSeconds();
    }
    o.getMilliseconds = function() {
        return date.getUTCMilliseconds();
    }
    o.getTime = function() {
        return date.getTime();
    }
    o.getTimezoneOffset = function() {
        return 0;
    }
    o.set = function(y, m, d) {
        date = createDate(y, m, d);
        return o;
    }
    o.setFullYear = function(v) {
        date.setUTCFullYear(v)
        return o;
    }
    o.setMonth = function(v) {
        date.setUTCMonth(v)
    }
    o.setDate = function(v) {
        date.setUTCDate(v);
        return o;
    }
    o.setHours = function(v) {
        date.setUTCHours(v);
        return o;
    }
    o.setMinutes = function(v) {
        date.setUTCMinutes(v);
        return o;
    }
    o.setSeconds = function(v) {
        date.setUTCSeconds(v);
        return o;
    }
    o.setMilliseconds = function(v) {
        date.setUTCMilliseconds(v);
        return o;
    }
    o.change = function(mode, value) {
        // 現状を変更する.
        mode = mode.toLowerCase();
        if(mode == "year") {
            date.setUTCYear(date.getUTCYear() + value);
        } else if(mode == "month") {
            date.setUTCMonth(date.getUTCMonth() + value);
        } else if(mode == "week") {
            date.setUTCDate(date.getUTCDate() + (value * 7));
        } else if(mode == "date") {
            date.setUTCDate(date.getUTCDate() + value);
        } else if(mode == "hours") {
            date.setUTCHours(date.getUTCHours() + value);
        } else if(mode == "minutes") {
            date.setUTCMinutes(date.getUTCMinutes() + value);
        } else if(mode == "seconds") {
            date.setUTCSeconds(date.getUTCSeconds() + value);
        } else if(mode == "milliseconds") {
            date.setUTCMilliseconds(date.getUTCMilliseconds() + value);
        }
        return o;
    }
    o.cchange = function(mode, value) {
        // 現状を変更せずに新しく作られたものを変更する.
        const ret = create(date);
        return ret.change(mode, value);
    }
    o.clear = function(mode) {
        if(mode == "month") {
            // 月からリセット.
            date.setUTCMonth(0);
            date.setUTCDate(1);
            date.setUTCHours(0);
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "week") {
            // 最寄りの日曜日に戻す.
            date.setUTCDate(
                date.getUTCDate() - date.getUTCWeek());
            date.setUTCHours(0);
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "date") {
            // 日からリセット.
            date.setUTCDate(1);
            date.setUTCHours(0);
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "hours") {
            // 時間からリセット.
            date.setUTCHours(0);
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "minutes") {
            // 分からリセット.
            date.setUTCMinutes(0);
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "seconds") {
            // 秒からリセット.
            date.setUTCSeconds(0);
            date.setUTCMilliseconds(0);
        } else if(mode == "milliseconds") {
            // ミリ秒からリセット.
            date.setUTCMilliseconds(0);
        }
        return o;
    }
    o.between = function(mode) {
        return between(date, mode);
    }
    o.rawDate = function() {
        return date;
    }
    o.toString = function(mode) {
        return dateToString(o, mode);
    }
    return o;
};

// utcDate生成処理.
exports.create = create;

// 開始、終了日を取得.
exports.between = between;

})();