// シンプル日付.
// javascript標準のDateオブジェクトは色々使い勝手が悪い.
// この辺を考慮する形として日付オブジェクトを自作する.
//
(function() {

// １日に対するUnixTime.
const _DATE_UNIXTIME = 86400000;

// １分に対するUnixTime.
const _MINUTES_UNIXTIME = 60000;

// 0-1900までのタイム開始時間リスト.
const _ZERO_1900_TIMES_LIST = [
    [1900,2209053600000,1],[1800,5364727200000,3],[1700,8520400800000,5],[1600,11676160800000,6],
    [1500,14831056800000,1],[1400,17986816800000,3],[1300,21142576800000,5],[1200,24298336800000,6],
    [1100,27454096800000,1],[1000,30609856800000,3],[900,33765616800000,5],[800,36921376800000,6],
    [700,40077136800000,1],[600,43232896800000,3],[500,46388656800000,5],[400,49544416800000,6],
    [300,52700176800000,1],[200,55855936800000,3],[100,59011696800000,5],[0,62167456800000,6]
];

// 0-1900までのタイム開始時間辞書リスト.
const _ZERO_1900_TIMES_DICT = {
    "1900":2209053600000,"1800":5364727200000,"1700":8520400800000,"1600":11676160800000,
    "1500":14831056800000,"1400":17986816800000,"1300":21142576800000,"1200":24298336800000,
    "1100":27454096800000,"1000":30609856800000,"900":33765616800000,"800":36921376800000,
    "700":40077136800000,"600":43232896800000,"500":46388656800000,"400":49544416800000,
    "300":52700176800000,"200":55855936800000,"100":59011696800000,"0":62167456800000
};

// 1970年から開始のUnixTimeの最適な開始UnixTimeを取得.
const _getStartUnixTime = function(unixTime) {
    // マイナスのUnixTimeをプラスに変換.
    const t = unixTime * -1;
    let n;
    let len = _ZERO_1900_TIMES_LIST.length;
    for(let i = 0; i < len; i ++) {
        // _ZERO_1900_TIMES_LIST の 開始ミリ秒(1)と比較.
        if((n = _ZERO_1900_TIMES_LIST[i])[1] >= t) {
            return n;
        }
    }
    // 紀元前の条件は非対応.
    throw new Error("BC dates are not supported.");
}

// デフォルトのタイムゾーン(Dateオブジェクトから拝借).
const _DEF_TIMEZONE = new Date().getTimezoneOffset();

// うるう年判別.
const _checkLeapYear = function(year) {
    // 4年に１度.
    if((year % 4) == 0) {
        // [例外]100で割り切れて400で割り切れない年は平年
        if((year % 100) == 0 && (year % 400) != 0) {
            return false;
        }
        return true;
    }
    return false;
}

// 対象日付累計値から、month, dateを取得.
const _convertMonthDate = function(leapYear, dd) {
    // うるう年/月の日数:  [31,29,31,30,31,30,31,31,30,31,30,31]
    // 非うるう年/月の日数:  [31,28,31,30,31,30,31,31,30,31,30,31]

    // うるう年.
    if(leapYear) {
        if(dd <= 31) { return [1, dd];}
        else if(dd <= 60) { return [2, (dd - 31)];}
        else if(dd <= 91) { return [3, (dd - 60)];}
        else if(dd <= 121) { return [4, (dd - 91)];}
        else if(dd <= 152) { return [5, (dd - 121)];}
        else if(dd <= 182) { return [6, (dd - 152)];}
        else if(dd <= 213) { return [7, (dd - 182)];}
        else if(dd <= 244) { return [8, (dd - 213)];}
        else if(dd <= 274) { return [9, (dd - 244)];}
        else if(dd <= 305) { return [10, (dd - 274)];}
        else if(dd <= 335) { return [11, (dd - 305)];}
        return [12, (dd - 335)];
    }
    // うるう年以外.
    if(dd <= 31) { return [1, dd];}
    else if(dd <= 59) { return [2, (dd - 31)];}
    else if(dd <= 90) { return [3, (dd - 59)];}
    else if(dd <= 120) { return [4, (dd - 90)];}
    else if(dd <= 151) { return [5, (dd - 120)];}
    else if(dd <= 181) { return [6, (dd - 151)];}
    else if(dd <= 212) { return [7, (dd - 181)];}
    else if(dd <= 243) { return [8, (dd - 212)];}
    else if(dd <= 273) { return [9, (dd - 243)];}
    else if(dd <= 304) { return [10, (dd - 273)];}
    else if(dd <= 334) { return [11, (dd - 304)];}
    return [12, (dd - 334)];
}

// 指定月から開始累計日を取得.
const _convMonthToStartAllDate = function(leapYear, mm) {
    // うるう年の場合.
    if(leapYear) {
        switch(mm) {
        case 1: return 0;
        case 2: return 31;
        case 3: return 60;
        case 4: return 91;
        case 5: return 121;
        case 6: return 152;
        case 7: return 182;
        case 8: return 213;
        case 9: return 244;
        case 10: return 274;
        case 11: return 305;
        case 12: return 335;
        }
    }
    switch(mm) {
    case 1: return 0;
    case 2: return 31;
    case 3: return 59;
    case 4: return 90;
    case 5: return 120;
    case 6: return 151;
    case 7: return 181;
    case 8: return 212;
    case 9: return 243;
    case 10: return 273;
    case 11: return 304;
    case 12: return 334;
    }
}

// timeから時分秒ミリ秒を変換.
const _convertHmsSss = function(tm) {
    let H = (tm / 3600000) | 0;
    let n = tm - (H * 3600000);
    let m = (n / 60000) | 0;
    let s = ((n - (m * 60000)) / 1000) | 0;
    let sss = (tm % 1000) | 0;
    return [H, m, s, sss];
}

// 対象UnixTimeをSimeleDate内容に変換.
// out: 結果を書き込むための内容.
// utime: unixTime.
// tmzm: 分ベースのタイムゾーン.
//       指定しない場合は実行時のTimezoneの分情報がセットされる.
const _createUnixTimeToSimpleDate = function(out, utime, tmzm) {
    // utimeが設定されていない場合は out.unixTime を採用する.
    utime = utime || out["unixTime"];
    // 指定してない場合実行時のTimezoneの分情報をセット.
    tmzm = tmzm || out["tzone"] || _DEF_TIMEZONE;
    // 元のunixTimeを保持.
    const srcUtime = utime;
    // timeZoneをプラス.
    utime += (tmzm * _MINUTES_UNIXTIME);
    // 開始年を取得.
    const start = _getStartUnixTime(utime);
    const startYear = start[0];
    // 開始年を加算したUnixTime変換.
    utime = utime + start[1];

    // unixTimeの日数を取得.
    const srcAllDate = (utime / _DATE_UNIXTIME) | 0;
    let allDate = srcAllDate;

    /**
      一旦 allDateを 365で割って年取得をした場合、
      一定年数を超えた場合、本来の年数より１年プラス
      され、さらにその年がうるう年だと、１日ずれてしまう.
      なので、20年に１度の単位で計算するようにする.
    **/

    // allDateから年を取得.
    let year = (allDate / 365) | 0;
    let nowStartYear = startYear;
    // 20年単位でうるう年計算.
    for(let i = 0 ;; i ++) {
        // yearが20年未満の場合.
        if((year - (i * 20)) <= 20) {
            break;
        }
        // 20年なのでうるう年は5回固定.
        let leapCount = 5;
        // 40年の間に次の100年をまたぐ場合.
        const nextYear  = (((nowStartYear / 100) | 0) + 1) * 100;
        if((nowStartYear + 20) >= nextYear) {
            // うるう年例外チェック.
            if(!_checkLeapYear(nextYear)) {
                leapCount --;
            }
        }
        // nowStartYear に次の20年を追加.
        nowStartYear += 20;
        // うるう年を年開始dateから除外.
        allDate = (allDate - leapCount);
        // 365日で年計算のやりなおし.
        year = (allDate / 365) | 0;
    }
    // 残った年数分(１年単位)のうるう年対応.
    for(let i = nowStartYear + 1, end = year + startYear; i <= end; i ++) {
        if(_checkLeapYear(i)) {
            allDate --;
        }
    }
    // 365日で年計算のやりなおし.
    year = (allDate / 365) | 0;

    // そもそも日付が０から始まるので１プラス.
    allDate ++;

    // 対象年がうるう年かチェック.
    const targetYearLeap = _checkLeapYear(year + startYear);

    // 直近の年がうるう年の場合.
    if(targetYearLeap) {
        // 直近のうるう年分日付を足してやる.
        allDate ++;
    }

    // 開始年が400年に一度の例外の場合.
    if(_checkLeapYear(startYear)) {
        // 開始年に関してチェックされないので、ここで反映する必要がある.
        allDate --;
    }

    // 対象年の開始日付を取得.
    let startYearDate = allDate - (year * 365);

    // 対象年の開始日付から月と日を取得.
    const monthDate = _convertMonthDate(targetYearLeap, startYearDate);

    // 時分秒ミリ秒を取得.
    const hms = _convertHmsSss(utime % _DATE_UNIXTIME);

    // 曜日を計算.
    const day = (start[2] + (srcAllDate % 7)) % 7;

    // 生成結果を出力.
    out["unixTime"] = srcUtime;
    out["year"] = year + startYear;
    out["month"] =  monthDate[0];
    out["date"] =  monthDate[1];
    out["hours"] =  hms[0];
    out["minutes"] =  hms[1];
    out["seconds"] =  hms[2];
    out["milliseconds"] =  hms[3];
    out["day"] =  day;
    out["tzone"] = tmzm;
    out["updateFlag"] = true;
}

// 対象SimpleDateの内容をSimeleDate内容に変換.
// out: 結果を書き込むための内容.
// tmzm: 分ベースのタイムゾーン.
//       指定しない場合は実行時のTimezoneの分情報がセットされる.
const _createYmdHmsToCreateTime = function(out, tmzm) {
    // 指定してない場合実行時のTimezoneの分情報をセット.
    tmzm = tmzm || out["tzone"] || _DEF_TIMEZONE;
    // simpleDateを構成する内容を取得.
    let year = (out["year"] || 1970) | 0;
    let month = (out["month"] || 1) | 0;
    let date = (out["date"] || 1) | 0;
    let hours = (out["hours"] || 0) | 0;
    let minutes = (out["minutes"] || 0) | 0;
    let seconds = (out["seconds"] || 0) | 0;
    let milliseconds = (out["milliseconds"] || 0) | 0;

    /////////////////////////
    // 時分秒をunixTime変換.
    /////////////////////////
    let hms = (hours * 3600000) +
        (minutes * 60000) +
        (seconds * 1000) +
        milliseconds;

    /////////////////////////
    // 年月日をunixTime変換.
    /////////////////////////

    // 100年単位の年取得.
    // ただし1900年以降は1900固定.
    let startYear = ((year / 100)|0) * 100;
    startYear = startYear >= 1900 ? 1900 : startYear;
    // 対象の100年単位の年からの年数.
    const remYear = year - startYear;
    let allDate = remYear * 365;

    // remYearに対するうるう年数を取得.
    // (最新年のうるう年を除く.)
    let leapCount = ((remYear / 4) | 0) + 1;
    // 対象月のうるう年計算.
    const leapYear = _checkLeapYear(year);
    if(leapYear) {
        // 最新年がうるう年の場合は、うるう年数を除外.
        leapCount --;
    }

    // 100年単位のうるう年チェック.
    for(let i = startYear; i <= year; i += 100) {
        if(!_checkLeapYear(i)) {
            leapCount --;
        }
    }
    // 年からの日変換のうるう年分プラス.
    allDate += leapCount;

    // うるう年を含めた月を日に変換.
    allDate += _convMonthToStartAllDate(leapYear, month);

    // _ZERO_1900_TIMES_DICTからstartTimeを取得.
    const zero1900Times = _ZERO_1900_TIMES_DICT[startYear];

    // 日をunixTimeに変換.
    let ymd = ((allDate + (date - 1)) * _DATE_UNIXTIME) +
        (zero1900Times * -1);

    // unixTime変換.
    const utime = ymd + hms - (tmzm * _MINUTES_UNIXTIME);
    // outに内容をセット.
    out["unixTime"] = utime;
    out["tzone"] = tmzm;
    return utime;
}

// 詳細内容を更新.
const _updateDetail = function(o) {
    if((o["updateFlag"] || false) == false) {
        // ymdhmsをunixTime変換.
        _createYmdHmsToCreateTime(o);
        // unixTimeをymdhms変換.
        _createUnixTimeToSimpleDate(o);
    }
    return o;
}

// 年を取得.
const getYear = function(o) {
    return _update(o)["year"];
}
// 月を取得.
const getMonth = function(o) {
    return _update(o)["month"];
}
// 日を取得.
const getDate = function(o) {
    return _update(o)["date"];
}
// 曜日を取得(0=日).
const getDay = function(o) {
    return _update(o)["day"];
}
// 曜日内容を文字列で取得.
const getDayToString = function(o, jp) {
    jp = (jp || false) == true;
    if(jp) {
      switch(getDay(o)) {
          case 0: return "日";
          case 1: return "月";
          case 2: return "火";
          case 3: return "水";
          case 4: return "木";
          case 5: return "金";
          case 6: return "土";
      }
      return "？";
    }
    switch(getDay(o)) {
        case 0: return "Sun";
        case 1: return "Mon";
        case 2: return "Tue";
        case 3: return "Wed";
        case 4: return "Thu";
        case 5: return "Fri";
        case 6: return "Sat";
    }
    return "unknown";
}
// 時間を取得.
const getHours = function() {
    return _update(o)["hours"];
}
// 分を取得.
const getMinutes = function(o) {
    return _update(o)["minutes"];
}
// 秒を取得.
const getSeconds = function(o) {
    return _update(o)["seconds"];
}
// ミリ秒を取得.
const getMilliseconds = function(o) {
    return _update(o)["milliseconds"];
}
// unixTimeを取得.
const getTime = function(o) {
    return _update(o)["unixTime"];
}
// 国別野タイムゾーン(分単位)を取得.
const getTimezoneOffset = function(o) {
    return _update(o)["tzone"];
}
// 年を設定.
const setYear = function(o, v) {
    o["year"] = v;
    o["updateFlag"] = false;
}
// 月を設定.
const setMonth = function(o, v) {
    o["month"] = v;
    o["updateFlag"] = false;
}
// 日を設定.
const setDate = function(o, v) {
    o["date"] = v;
    o["updateFlag"] = false;
}
// 時間を設定.
const setHours = function(o, v) {
    o["hours"] = v;
    o["updateFlag"] = false;
}
// 分を設定.
const setMinutes = function(o, v) {
    o["minutes"] = v;
    o["updateFlag"] = false;
}
// 秒を設定.
const setSeconds = function(o, v) {
    o["seconds"] = v;
    o["updateFlag"] = false;
}
// ミリ秒を設定.
const setMilliseconds = function(o, v) {
    o["milliseconds"] = v;
    o["updateFlag"] = false;
}
// タイムゾーンを分単位で設定.
const setTimezoneOffset = function(o, v) {
    o["tzone"] = v;
    o["updateFlag"] = false;
}
// unixTimeを設定.
const setTime = function(o, v) {
    _createUnixTimeToSimpleDate(o, v);
}

})();
