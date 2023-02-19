///////////////////////////////////////////////////////////
// 派生Object定義.
///////////////////////////////////////////////////////////
(function() {
'use strict'

// 1度model.jsをrequireしてる場合.
if(global["_$use%-%model"] == true) {
    // 再読み込みしない.
    return;
}

// 比較処理.
const compareTo = function(src, dest) {
    if(src > dest) {
        return 1;
    } else if(src < dest) {
        return -1;
    }
    return 0;
}

// 現在日付を返却.
const newCalendar = function() {
    const ret = new Date();
    return [
        ret.getFullYear(),
        ret.getMonth(),
        ret.getDate()
    ];
}

// calendarコンストラクタ.
const calendarConstractor = function(args) {
    // パラメータが設定されていない場合.
    if(args.length == 0) {
        return newCalendar();
    // argumentsが１つの場合.
    } else if(args.length == 1) {
        args = args[0];
        // パラメータが設定されていない.
        if(args == undefined || args == null) {
            return newCalendar();
        // 文字列の場合.
        } if(typeof(args) == "string") {
            // 単純にDate指定の文字列変換.
            let n = new Date(args);
            // 失敗した場合.
            if(Number.isNaN(n.getTime())) {
                // 日付分を除外した時分秒だけで判別.
                n = new Date(args);
                // 解決できない場合.
                if(Number.isNaN(n.getTime())) {
                    // Invalida Date.
                    return null;
                }
            }
            // 解決できた場合はその内容を時間変換.
            return [n.getFullYear(), n.getMonth(), n.getDate()];
        } else if(args instanceof Date) {
            // dateオブジェクトで返却.
            return [args.getFullYear(), args.getMonth(), args.getDate()];
        } else if(typeof(args) == "number") {
            // numberの場合、日付オブジェクトに変換して返却.
            let n = new Date(args);
            return [n.getFullYear(), n.getMonth(), n.getDate()];
        }
    // 複数のパラメータで設定されている場合.
    } else {
        const len = args.length > 3 ? 3 : args.length;
        const ret = [1970, 0, 1];
        for(let i = 0; i < len; i ++) {
            ret[i] = parseInt(args[i]);
        }
        return ret;
    }
}

// calendar値を数字変換.
// 3byte.
const getCalendarParseInt = function(y, m, d) {
    // yearの範囲は -16383 から 16383年.
    return ((y + 16383) << 9) |
        (m << 5) |
        (d);
}

// calendarの数字変換内容を文字変換.
const convertIntToCalendar = function(value) {
    return {
        y: ((value >> 9) & 0x07fff) - 16383,
        m: ((value >> 5) & 0x0f),
        d: (value & 0x01f)
    }
}

// calendarオブジェクト.
class Calendar extends Date {
    // コンストラクタ.
    constructor() {
        // calendarコンストラクタの内容取得.
        const calendar = calendarConstractor(arguments);
        if(calendar == null) {
            super(NaN);
            return;
        }
        super(new Date(
            calendar[0], calendar[1], calendar[2]).getTime());
    }
    // 時分秒の設定は行えないようにする.
    setHours() {}
    setUTCHours() {}
    setMinutes() {}
    setUTCMinutes() {}
    setSeconds() {}
    setUTCSeconds() {}
    setMilliseconds() {}
    setUTCMilliseconds() {}
    setTime(time) {
        const calendar = calendarConstractor([time]);
        if(calendar == null) {
            super.setTime(0);
        } else {
            super.setTime(new Date(
                calendar[0], calendar[1], calendar[2]).getTime());
        }
    }
    // localTimeを返却.
    toString() {
        const y = "" + (super.getFullYear());
        const m = "" + (super.getMonth() + 1);
        const d = "" + (super.getDate());
        return "0000".substring(y.length) + y + "-" +
            "00".substring(m.length) + m + "-" +
            "00".substring(d.length) + d;
    }
    // jsonで返却する値を返却.
    toJSON() {
        return this.toString();
    }
    // 指定条件と大なり小なりを取得.
    compareTo(date) {
        if(date instanceof Date) {
            const src = getCalendarParseInt(
                this.getFullYear(),
                this.getMonth(),
                this.getDate()
            );
            const dest = getCalendarParseInt(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
            );
            return compareTo(src, dest);
        }
        return -1
    }
    // 指定条件と一致チェック.
    equals(date) {
        return this.compareTo(date) == 0;
    }
}

// 現在時間を返却.
const nowTime = function() {
    const ret = new Date();
    return [
        ret.getHours(),
        ret.getMinutes(),
        ret.getSeconds(),
        ret.getMilliseconds()
    ];
}

// timeコンストラクタ.
const timeConstractor = function(args) {
    // パラメータが設定されていない場合.
    if(args.length == 0) {
        return nowTime();
    // argumentsが１つの場合.
    } else if(args.length == 1) {
        args = args[0];
        // パラメータが設定されていない.
        if(args == undefined || args == null) {
            return nowTime();
        // 文字列の場合.
        } if(typeof(args) == "string") {
            // 単純にDate指定の文字列変換.
            let n = new Date(args);
            // 失敗した場合.
            if(Number.isNaN(n.getTime())) {
                // 日付分を除外した時分秒だけで判別.
                n = new Date("1970-01-01 " + args);
                // 解決できない場合.
                if(Number.isNaN(n.getTime())) {
                    // Invalida Date.
                    return null;
                }
            }
            // 解決できた場合はその内容を時間変換.
            return [n.getHours(), n.getMinutes(), n.getSeconds(),
                n.getMilliseconds()];
        } else if(args instanceof Date) {
            // dateオブジェクトで返却.
            return [args.getHours(), args.getMinutes(), args.getSeconds(),
                args.getMilliseconds()];
        } else if(typeof(args) == "number") {
            // numberの場合、日付オブジェクトに変換して返却.
            let n = new Date(args);
            return [n.getHours(), n.getMinutes(), n.getSeconds(),
                n.getMilliseconds()];
        }
    // 複数のパラメータで設定されている場合.
    } else {
        const len = args.length > 4 ? 4 : args.length;
        const ret = [0, 0, 0, 0];
        for(let i = 0; i < len; i ++) {
            ret[i] = parseInt(args[i])
        }
        return ret;
    }
}

// timeを数字変換.
const getTimeParseInt = function(h, m, s, ms) {
    return (h << 22) +
        (m << 16) +
        (s << 10) +
        ms
}

// timeの数字変換内容を文字変換.
const convertIntToTime = function(value) {
    return {
        h: ((value >> 22) & 0x01f),
        m: ((value >> 16) & 0x03f),
        s: ((value >> 10) & 0x03f),
        ms: (value & 0x03ff)
    }
}

// timeオブジェクト.
class Time extends Date {
    // コンストラクタ.
    constructor() {
        // timeコンストラクタの内容取得.
        const time = timeConstractor(arguments);
        if(time == null) {
            super(NaN);
            return;
        }
        super(new Date(
            1970, 0, 1, time[0], time[1], time[2], time[3]).getTime());
    }
    // 年月日情報を更新できないようにする.
    setFullYear() {}
    setUTCFullYear() {}
    setMonth() {}
    setUTCMonth() {}
    setDate() {}
    setUTCDate() {}
    setTime(time) {
        const timeOnly = timeConstractor([time]);
        if(timeOnly == null) {
            super.setTime(0);
        } else {
            super.setTime(new Date(
                1970, 0, 1, timeOnly[0], timeOnly[1], timeOnly[2],
                timeOnly[3]).getTime());
        }
    }
    // localTimeを返却.
    toString() {
        const h = "" + (super.getHours());
        const m = "" + (super.getMinutes());
        const s = "" + (super.getSeconds());
        const ms = "" + (super.getMilliseconds());
        return "00".substring(h.length) + h + ":" +
            "00".substring(m.length) + m + ":" +
            "00".substring(s.length) + s + "." +
            "000".substring(ms.length) + ms;
    }
    // jsonで返却する値を返却.
    toJSON() {
        return this.toString();
    }
    // 指定条件と大なり小なりを取得.
    compareTo(date) {
        if(date instanceof Date) {
            const src = getTimeParseInt(
                this.getHours(),
                this.getMinutes(),
                this.getSeconds(),
                this.getMilliseconds()
            )
            const dest = getTimeParseInt(
                date.getHours(),
                date.getMinutes(),
                date.getSeconds(),
                date.getMilliseconds()
            )
            return compareTo(src, dest);
        }
        return -1
    }
    // 指定条件と大なり小なりを取得.
    equals(date) {
        return this.compareTo(date) == 0;
    }
}

// 現在日付時間を返却.
const nowTimestamp = function() {
    const ret = new Date();
    return [
        ret.getFullYear(),
        ret.getMonth(),
        ret.getDate(),
        ret.getHours(),
        ret.getMinutes(),
        ret.getSeconds(),
        ret.getMilliseconds()
    ];
}

// timestampコンストラクタ.
const timestampConstractor = function(args) {
    // パラメータが設定されていない場合.
    if(args.length == 0) {
        return nowTimestamp();
    // argumentsが１つの場合.
    } else if(args.length == 1) {
        args = args[0];
        // パラメータが設定されていない.
        if(args == undefined || args == null) {
            return nowTimestamp();
        // 文字列の場合.
        } if(typeof(args) == "string") {
            // 単純にDate指定の文字列変換.
            let n = new Date(args);
            console.log(n);
            // 失敗した場合.
            if(Number.isNaN(n.getTime())) {
                // 日付分を除外した時分秒だけで判別.
                n = new Date(args);
                // 解決できない場合.
                if(Number.isNaN(n.getTime())) {
                    // Invalida Date.
                    return null;
                }
            }
            // 解決できた場合はその内容を時間変換.
            return [n.getFullYear(), n.getMonth(), n.getDate(),
                n.getHours(), n.getMinutes(), n.getSeconds(),
                n.getMilliseconds()];
        } else if(args instanceof Date) {
            // dateオブジェクトで返却.
            return [args.getFullYear(), args.getMonth(), args.getDate(),
                args.getHours(), args.getMinutes(), args.getSeconds(),
                args.getMilliseconds()];
        } else if(typeof(args) == "number") {
            // numberの場合、日付オブジェクトに変換して返却.
            let n = new Date(args);
            return [n.getFullYear(), n.getMonth(), n.getDate(),
                n.getHours(), n.getMinutes(), n.getSeconds(),
                n.getMilliseconds()];
        }
    // 複数のパラメータで設定されている場合.
    } else {
        const len = args.length > 7 ? 7 : args.length;
        const ret = [1970, 0, 1, 0, 0, 0, 0];
        for(let i = 0; i < len; i ++) {
            ret[i] = parseInt(args[i]);
        }
        return ret;
    }
}

// timestampオブジェクト.
class Timestamp extends Date {
    // コンストラクタ.
    constructor() {
        // timeコンストラクタの内容取得.
        const ts = timestampConstractor(arguments);
        if(ts == null) {
            super(NaN);
            return;
        }
        super(new Date(
            ts[0], ts[1], ts[2],
            ts[3], ts[4], ts[5], ts[6]).getTime());
    }
    setTime(time) {
        const timeOnly = timestampConstractor([time]);
        if(timeOnly == null) {
            super.setTime(0);
        } else {
            super.setTime(new Date(
                ts[0], ts[1], ts[2],
                ts[3], ts[4], ts[5], ts[6]).getTime());
            }
    }
    // localTimeを返却.
    toString() {
        const y = "" + (super.getFullYear());
        const m = "" + (super.getMonth() + 1);
        const d = "" + (super.getDate());
        const h = "" + (super.getHours());
        const mi = "" + (super.getMinutes());
        const s = "" + (super.getSeconds());
        const ms = "" + (super.getMilliseconds());
        return "0000".substring(y.length) + y + "-" +
            "00".substring(m.length) + m + "-" +
            "00".substring(d.length) + d + " " +
            "00".substring(h.length) + h + ":" +
            "00".substring(mi.length) + mi + ":" +
            "00".substring(s.length) + s + "." +
            "000".substring(ms.length) + ms;
    }
    // jsonで返却する値を返却.
    toJSON() {
        return this.toString();
    }
    // 指定条件と大なり小なりを取得.
    compareTo(date) {
        if(date instanceof Date) {
            return compareTo(
                this.getTime(), date.getTime());
        }
        return -1;
    }
    // 指定条件と一致チェック.
    equals(date) {
        return this.compareTo(date) == 0;
    }
}

// 初期設定.
const init = function() {
    // load Model.
    global["_$use%-%model"] = true;

    // Calendar(DateOnly)オブジェクト.
    Object.defineProperty(global, "Calendar",
        {writable: false, value: Calendar});
    // Time(TimeOnly)オブジェクト.
    Object.defineProperty(global, "Time",
        {writable: false, value: Time});
    // Timestamp(DateTime)オブジェクト.
    Object.defineProperty(global, "Timestamp",
        {writable: false, value: Timestamp});
}

// 初期処理実行.
init();

})();