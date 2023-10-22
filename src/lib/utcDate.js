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
let DEFAULT_TZ_OFFSET = -540;

// UTC-DateのデフォルトTZOffsetをセット.
const setDefaultTzOffset = function(second) {
    DEFAULT_TZ_OFFSET = second | 0;
    return getDefaultTzName();
}

// 対象名を指定してTimeZoneをセット.
const setDefaultTimeZone = function(name) {
    const tz = TZ_DICT["" + name];
    if(tz == undefined) {
        return;
    }
    DEFAULT_TZ_OFFSET = tz
}

// UTC-DateのデフォルトTZOffsetを取得.
const getDefaultTzOffset = function() {
    return DEFAULT_TZ_OFFSET;
}

// UTC-Dateのデフォルトタイムゾーン値を取得.
const getDefaultTzName = function() {
    return process.env.TZ;
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
    return new Date(now.getTime() - (tzOffet * 60000));
}

// dateオブジェクトを作成.
const createDate = function(y, m, d) {
    let old = ""
    try {
        old = toUTCEnv();
        let date;
        // 設定なし.
        if(y == undefined || y == null) {
            date = nowDate();
        // y, m, d で設定.
        } else if(typeof(y) == "number") {
            if(typeof(m) == "number") {
                if(typeof(d) == "number") {
                    date = new Date(y, m, d);
                } else {
                    date = new Date(y, m);
                }
            } else {
                date = new Date(y);
            }
        // 文字列で設定.
        } else if(typeof(y) == "string") {
            date = new Date(y);
        // Dateオブジェクトで設定.
        } else if(y instanceof Date) {
            date = new Date(y);
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
    } finally {
        setTzEnv(old);
    }
}

// dateを文字列変換.
const dateToString = function(object, mode) {
    let old = ""
    try {
        old = toUTCEnv();
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
    } finally {
        setTzEnv(old);
    }
}

// 開始/終了日を取得.
const between = function(date, mode) {
    let old = ""
    try {
        old = toUTCEnv();
        // dateが設定されていない場合.
        if(date == undefined || date == null) {
            date = nowDate();
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
            start = create(date.getFullYear(), 0, 1);
            end = create(date.getFullYear() + 1, 0, 1);
            end = create(end.getTime() - 1);
            return {start: start, end: end};
        }
        // 月の開始終了を返却.
        if(mode == false || mode == "month") {
            start = create(date.getFullYear(), date.getMonth(), 1);
            end = create(date.getFullYear(), date.getMonth() + 1, 1);
            end = create(end.getTime() - 1);
            return {start: start, end: end};
        }
        // 週の開始終了を返却.
        if(mode == "week") {
            const d = date.getDay();
            start = create(date).change("date", (d * -1));
            end = create(date).change("date", (6 - d));
            return {start: start, end: end};
        }
        // 日の開始終了を返却.
        start = create(date.getFullYear(), date.getMonth(), date.getDate());
        end = create(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        end = create(end.getTime() - 1);
        return {start: start, end: end};
    } finally {
        setTzEnv(old);
    }
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
        let old = ""
        try {
            old = toUTCEnv();
            return date.getFullYear();
        } finally {
            setTzEnv(old);
        }
    }
    o.getMonth = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getMonth();
        } finally {
            setTzEnv(old);
        }
    }
    o.getDate = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getDate();
        } finally {
            setTzEnv(old);
        }
    }
    o.getDay = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getDay();
        } finally {
            setTzEnv(old);
        }
    }
    o.getHours = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getHours();
        } finally {
            setTzEnv(old);
        }
    }
    o.getMinutes = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getMinutes();
        } finally {
            setTzEnv(old);
        }
    }
    o.getSeconds = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getSeconds();
        } finally {
            setTzEnv(old);
        }
    }
    o.getMilliseconds = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getMilliseconds();
        } finally {
            setTzEnv(old);
        }
    }
    o.getTime = function() {
        let old = ""
        try {
            old = toUTCEnv();
            return date.getTime();
        } finally {
            setTzEnv(old);
        }
    }
    o.getTimezoneOffset = function() {
        return 0;
    }
    o.set = function(y, m, d) {
        let old = ""
        try {
            old = toUTCEnv();
            date = createDate(y, m, d);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setFullYear = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setFullYear(v)
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setMonth = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setMonth(v)
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setDate = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setDate(v);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setHours = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setHours(v);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setMinutes = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setMinutes(v);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setSeconds = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setSeconds(v);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.setMilliseconds = function(v) {
        let old = ""
        try {
            old = toUTCEnv();
            date.setMilliseconds(v);
        } finally {
            setTzEnv(old);
        }
        return o;
    }
    o.change = function(mode, value) {
        let old = ""
        try {
            old = toUTCEnv();
            // 現状を変更する.
            mode = mode.toLowerCase();
            if(mode == "year") {
                date.setYear(date.getYear() + value);
            } else if(mode == "month") {
                date.setMonth(date.getMonth() + value);
            } else if(mode == "week") {
                date.setDate(date.getDate() + (value * 7));
            } else if(mode == "date") {
                date.setDate(date.getDate() + value);
            } else if(mode == "hours") {
                date.setHours(date.getHours() + value);
            } else if(mode == "minutes") {
                date.setMinutes(date.getMinutes() + value);
            } else if(mode == "seconds") {
                date.setSeconds(date.getSeconds() + value);
            } else if(mode == "milliseconds") {
                date.setMilliseconds(date.getMilliseconds() + value);
            }
            return o;
        } finally {
            setTzEnv(old);
        }
    }
    o.copyToChange = function(mode, value) {
        // 現状を変更せずに新しく作られたものを変更する.
        const ret = o.create(date);
        return ret.change(mode, value);
    }
    o.clear = function(mode) {
        let old = ""
        try {
            old = toUTCEnv();
            if(mode == "month") {
                // 月からリセット.
                date.setMonth(0);
                date.setDate(1);
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "week") {
                // 最寄りの日曜日に戻す.
                date.setDate(
                    date.getDate() - date.getWeek());
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "date") {
                // 日からリセット.
                date.setDate(1);
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "hours") {
                // 時間からリセット.
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "minutes") {
                // 分からリセット.
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "seconds") {
                // 秒からリセット.
                date.setSeconds(0);
                date.setMilliseconds(0);
            } else if(mode == "milliseconds") {
                // ミリ秒からリセット.
                date.setMilliseconds(0);
            }
            return o;
        } finally {
            setTzEnv(old);
        }
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

// タイムゾーン名を指定してTZOffsetをセット.
exports.setDefaultTimeZone = setDefaultTimeZone;

// UTC-DateのデフォルトTZOffsetをセット.
exports.setDefaultTzOffset = setDefaultTzOffset;

// UTC-DateのデフォルトTZOffsetを取得.
exports.getDefaultTzOffset = getDefaultTzOffset;

// UTC-Dateのデフォルトタイムゾーン値を取得.
exports.getDefaultTzName = getDefaultTzName;

})();