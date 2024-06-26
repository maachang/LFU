// 数値系ユーティリティ.
//
(function (_g) {
'use strict';
const o = {};
const _u = undefined;

// 指定文字の数を取得.
const targetCharCount = function(off,src,value) {
  let p;
  let ret = 0;
  while ((p = src.indexOf(value,off)) != -1) {
    ret ++;
    off = p + value.length;
  }
  return ret;
}

// 数値チェック.
// num : チェック対象の情報を設定します.
// 戻り値 : [true]の場合、文字列情報です.
o.isNumeric = (function() {
  const _IS_NUMERIC_REG = /[^0-9.0-9]/g;
  return function(num){
    let n = "" + num;
    if (num == null || num == _u) {
      return false;
    } else if(typeof(num) == "number") {
      return true;
    } else if(n.indexOf("-") == 0) {
      n = n.substring(1);
    }
    return !(n.length == 0 || n.match(_IS_NUMERIC_REG)) && !(targetCharCount(0,n,".")>1);
  }
})();

// 小数点変換処理.
// mode : 四捨五入の場合は[true]を設定します.
//        設定しない場合は四捨五入で処理されます.
// n : 変換対象の情報を設定します.
// nn : 桁数を設定します.
// 戻り値 : 対象の数値が返却されます.
o.parseDecimal = function(mode, n, nn) {
  if (!o.isNumeric(n)) {
    return n;
  }
  let i;
  nn = nn|0
  n = parseFloat(n);
  mode = !(mode == false || mode == "false");
  if(mode) {
    let c = 0.5;
    for(i = 0; i < nn; i ++) {
      c *= 0.1;
    }
    n += c;
  }
  let cc = 1;
  for(i = 0; i < nn; i ++) {
    cc *= 10;
  }
  n = parseInt(n * cc);
  return n / cc;
}

// 小数点表示用.
// ※四捨五入.
// val : 変換対象の情報を設定します.
// no : 桁数を設定します.
o.halfUp = function(val, no) {
  return o.parseDecimal(true, val, no);
}

// 小数点表示用.
// ※切捨て.
// val : 変換対象の情報を設定します.
// no : 桁数を設定します.
o.halfDown = function(val,no) {
  return parseDecimal(false, val, no);
}

// 直近の小数点を切り下げて取得.
// no 対象の番号を設定します.
// 戻り値 : 直近の小数点が切り下げられた値が返却されます.
o.floor = function(no) {
  return parseInt(no);
}

// 直近の小数点を切り上げて取得.
// no 対象の番号を設定します.
// 戻り値 : 直近の小数点が切り上げされた値が返却されます.
o.round = function(no) {
  return parseInt(no + 0.5);
}

// 絶対値を求める.
// no 対象の番号を設定します.
// 戻り値 : 絶対値が返却されます.
o.abs = function(no) {
  return parseInt((no < 0) ? (no * -1) : no);
}

// unix時間を取得.
o.getTime = function() {
  return Date.now();
}

// ナノ時間を取得.
o.getNanoTime = function() {
  const ret = process.hrtime()
  return parseInt((ret[0] * 10000000000) + ret[1]);
}

// xor128演算乱数装置.
o.Xor128 = function(seet) {
  const r = {v:{a:123456789,b:362436069,c:521288629,d:88675123}};
  
  // シートセット.
  r.setSeet = function(s) {
    if (typeof(s) == "number") {
      let hs = ((s / 1812433253)|0) + 1;
      let ls = ((s % 1812433253)|0) - 1;
      if((ls & 0x01) == 0) {
        hs = (~hs)|0;
      }
      this.v.a=hs=(((this.v.a*(~ls))*hs)+1)|0;
      if((this.v.a & 0x01) == 1) {
        this.v.c=(((this.v.c*(~ls))*hs)-1)|0;
      }
    }
  }  
  // 乱数取得.
  r.next = function() {
    const n = this.v;
    let t=n.a;
    let r=t;
    t = (t << 11);
    t = (t ^ r);
    r = t;
    r = (r >> 8);
    t = (t ^ r);
    r = n.b;
    n.a = r;
    r = n.c;
    n.b = r;
    r = n.d;
    n.c = r;
    t = (t ^ r);
    r = (r >> 19);
    r = (r ^ t);
    n.d = r;
    return r;
  }
  // 乱数取得.
  r.nextInt = function() {
    return this.next();
  }
  // Byteリストの乱数を生成.
  r.outByteList = function(out, cnt, len) {
    let n, i;
    const len4 = len >> 2;
    const lenEtc = len & 0x03;
    for(i = 0; i < len4; i ++) {
        n = r.next();
        out[cnt ++] = n & 0x0ff;
        out[cnt ++] = (n & 0x0ff00) >> 8;
        out[cnt ++] = (n & 0x0ff0000) >> 16;
        out[cnt ++] = ((n & 0xff000000) >> 24) & 0x0ff;
    }
    for(i = 0; i < lenEtc; i ++) {
        out[cnt ++] = r.next() & 0x0ff;
    }
  }
  // ランダムバイナリを指定数取得.
  r.getBytes = function(len) {
      const ret = Buffer.alloc(len);
      r.outByteList(ret, 0, len);
      return ret;
  }
  // ランダムバイナリをout(Array)に格納.
  r.getArray = function(out, len) {
      r.outByteList(out, out.length, len);
  }
  // 初期乱数のコードをセット.
  r.setSeet(seet);
  return r;
}

// ゼロサプレス.
var _z2 = function(n) {
  return "00".substring(n.length) + n;
}

// 16バイトデータ(4バイト配列４つ)をUUIDに変換.
// UUIDに変換.
o.byte16ToUUID = function(n) {
  const a = n[0];
  const b = n[1];
  const c = n[2];
  const d = n[3];

  return _z2((((a & 0xff000000) >> 24) & 0x00ff).toString(16)) +
    _z2(((a & 0x00ff0000) >> 16).toString(16)) +
    _z2(((a & 0x0000ff00) >> 8).toString(16)) +
    _z2(((a & 0x000000ff)).toString(16)) +
    "-" +
    _z2((((b & 0xff000000) >> 24) & 0x00ff).toString(16)) +
    _z2(((b & 0x00ff0000) >> 16).toString(16)) +
    "-" +
    _z2(((b & 0x0000ff00) >> 8).toString(16)) +
    _z2(((b & 0x000000ff)).toString(16)) +
    "-" +
    _z2((((c & 0xff000000) >> 24) & 0x00ff).toString(16)) +
    _z2(((c & 0x00ff0000) >> 16).toString(16)) +
    "-" +
    _z2(((c & 0x0000ff00) >> 8).toString(16)) +
    _z2(((c & 0x000000ff)).toString(16)) +
    _z2((((d & 0xff000000) >> 24) & 0x00ff).toString(16)) +
    _z2(((d & 0x00ff0000) >> 16).toString(16)) +
    _z2(((d & 0x0000ff00) >> 8).toString(16)) +
    _z2(((d & 0x000000ff)).toString(16));
}

// UUIDを16バイトデータ(4バイト配列４つ)に変換.
o.uuidToByte16 = function(n) {
  return [
    ("0x" + n.substring(0,8))|0,
    ("0x" + n.substring(9,13) + n.substring(14,18))|0,
    ("0x" + n.substring(19,23) + n.substring(24,28))|0,
    ("0x" + n.substring(28))|0
  ];
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
for(let k in o) {
  exports[k] = o[k];
}

})(global);

