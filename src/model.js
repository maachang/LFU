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
// src 比較元を設定します.
// dest 比較先を設定します.
// 戻り値: 比較結果が返却されます.
//         比較元より比較先の方が小さい場合は０以上が返却.
//         比較元より比較先の方が大きい場合は０以下が返却.
//         比較元と比較先が同じ場合は０が返却.
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
    return ((y + 16383) << 9) | // 32767(0x7fff)[15]
        (m << 5) | // 12(0xf)[4]
        (d); // 31(0x1f)[5]
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
const Calendar = class extends Date {
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
    // unixTimeで設定.
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
        if(Number.isNaN(super.getTime())) {
            return 'Invalid Date';
        }
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
    // date 比較対象先条件を設定します.
    // 戻り値: 比較結果が返却されます.
    //         比較元より比較先の方が小さい場合は０以上が返却.
    //         比較元より比較先の方が大きい場合は０以下が返却.
    //         比較元と比較先が同じ場合は０が返却.
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
    // binary変換バイト数.
    getByteLength() {
        return 3; // 3Byte.
    }
    // binaryを出力.
    // output Arrayを設定します.
    // offset 書き込み開始位置を設定します.
    exportBinary(output, offset) {
        // 数字変換.
        const value = getCalendarParseInt(
            this.getFullYear(),
            this.getMonth(),
            this.getDate()
        );
        output[offset + 0] = (value & 0x0ff0000) >> 16;
        output[offset + 1] = (value & 0x0ff00) >> 8;
        output[offset + 2] = value & 0x0ff;
    }
    // binaryを入力.
    // input Arrayを設定します.
    // offset 読み込み開始位置を設定します.
    importBinary(input, offset) {
        const value =
            ((input[offset + 0] & 0x0ff) << 16) |
            ((input[offset + 1] & 0x0ff) << 8) |
            ((input[offset + 2] & 0x0ff));
        const o = convertIntToCalendar(value);
        this.setFullYear(o.y);
        this.setMonth(o.m);
        this.setDate(o.d);
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
// 4byte(27bit).
const getTimeParseInt = function(h, m, s, ms) {
    return (h << 22) | // 23(0x1f)[5]
        (m << 16) |    // 59(0x3f)[6]
        (s << 10) |    // 59(0x3f)[6]
        ms             // 999(0x3ff)[10]
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
const Time = class extends Date {
    // コンストラクタ.
    constructor() {
        // timeコンストラクタの内容取得.
        const time = timeConstractor(arguments);
        if(time == null) {
            super(NaN);
            return;
        }
        super(new Date(
            1970, 0, 1, time[0], time[1], time[2], time[3]
            ).getTime());
    }
    // 年月日情報を更新できないようにする.
    setFullYear() {}
    setUTCFullYear() {}
    setMonth() {}
    setUTCMonth() {}
    setDate() {}
    setUTCDate() {}
    // unixTimeで設定.
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
        if(Number.isNaN(super.getTime())) {
            return 'Invalid Date';
        }
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
    // date 比較対象先条件を設定します.
    // 戻り値: 比較結果が返却されます.
    //         比較元より比較先の方が小さい場合は０以上が返却.
    //         比較元より比較先の方が大きい場合は０以下が返却.
    //         比較元と比較先が同じ場合は０が返却.
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
    // binary変換バイト数.
    getByteLength() {
        return 4; // 4Byte.
    }
    // binaryを出力.
    // output Arrayを設定します.
    // offset 書き込み開始位置を設定します.
    exportBinary(output, offset) {
        // 数字変換.
        const value = getTimeParseInt(
            this.getHours(),
            this.getMinutes(),
            this.getSeconds(),
            this.getMilliseconds()
        );
        output[offset + 0] = (value &  0xff000000) >> 16;
        output[offset + 1] = (value & 0x0ff0000) >> 16;
        output[offset + 2] = (value & 0x0ff00) >> 8;
        output[offset + 3] = value & 0x0ff;
    }
    // binaryを入力.
    // input Arrayを設定します.
    // offset 読み込み開始位置を設定します.
    importBinary(input, offset) {
        const value = 
            ((input[offset + 0] & 0x0ff) << 24) |
            ((input[offset + 1] & 0x0ff) << 16) |
            ((input[offset + 2] & 0x0ff) << 8) |
            ((input[offset + 3] & 0x0ff));
        const o = convertIntToTime(value);
        this.setHours(o.h);
        this.setMinutes(o.m);
        this.setSeconds(o.s);
        this.setMilliseconds(o.ms);
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
const Timestamp = class extends Date {
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
    // unixTimeで設定.
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
        if(Number.isNaN(super.getTime())) {
            return 'Invalid Date';
        }
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
    // date 比較対象先条件を設定します.
    // 戻り値: 比較結果が返却されます.
    //         比較元より比較先の方が小さい場合は０以上が返却.
    //         比較元より比較先の方が大きい場合は０以下が返却.
    //         比較元と比較先が同じ場合は０が返却.
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
    // binary変換バイト数.
    getByteLength() {
        return 7; // 7Byte.
    }
    // binaryを出力.
    // output Arrayを設定します.
    // offset 書き込み開始位置を設定します.
    exportBinary(output, offset) {
        // 日付情報を数字変換.
        let value = getCalendarParseInt(
            this.getFullYear(),
            this.getMonth(),
            this.getDate()
        );
        output[offset + 0] = (value & 0x0ff0000) >> 16;
        output[offset + 1] = (value & 0x0ff00) >> 8;
        output[offset + 2] = value & 0x0ff;
        // 時間情報を数値変換.
        value = getTimeParseInt(
            this.getHours(),
            this.getMinutes(),
            this.getSeconds(),
            this.getMilliseconds()
        );
        output[offset + 3] = (value &  0xff000000) >> 16;
        output[offset + 4] = (value & 0x0ff0000) >> 16;
        output[offset + 5] = (value & 0x0ff00) >> 8;
        output[offset + 6] = value & 0x0ff;
    }
    // binaryを入力.
    // input Arrayを設定します.
    // offset 読み込み開始位置を設定します.
    importBinary(input, offset) {
        // バイナリを日付変換.
        let value =
            ((input[offset + 0] & 0x0ff) << 16) |
            ((input[offset + 1] & 0x0ff) << 8) |
            ((input[offset + 2] & 0x0ff));
        let o = convertIntToCalendar(value);
        this.setFullYear(o.y);
        this.setMonth(o.m);
        this.setDate(o.d);
        // バイナリを時間変換.
        value = 
            ((input[offset + 3] & 0x0ff) << 24) |
            ((input[offset + 4] & 0x0ff) << 16) |
            ((input[offset + 5] & 0x0ff) << 8) |
            ((input[offset + 6] & 0x0ff));
        o = convertIntToTime(value);
        this.setHours(o.h);
        this.setMinutes(o.m);
        this.setSeconds(o.s);
        this.setMilliseconds(o.ms);

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