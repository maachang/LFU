//////////////////////////////////////////
// xor128.
//////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// unix時間を取得.
exports.getTime = function() {
  return Date.now();
}

// ナノ時間を取得.
exports.getNanoTime = function() {
  const ret = process.hrtime()
  return (((ret[0] * 1000000000) + ret[1]) / 1000);
}

// xor128演算乱数装置.
// seed 乱数初期値(number)を設定します.
exports.create = function(seed) {
    let _a = 123456789;
    let _b = 362436069;
    let _c = 521288629;
    let _d = 88675123;
    // シードセット.
    const setSeed = function(s) {
        if (typeof(s) == "number") {
			let hs = ((s / 1812433253)|0) + 1;
			let ls = ((s % 1812433253)|0) - 1;
			if((ls & 0x01) == 0) {
				hs = (~hs)|0;
			}
            _a=hs=((_a*(~ls))+hs+1)|0;
			hs += 1;
            _b=ls=((_b*hs)-ls+2)|0;
			ls += 1;
            _c=hs=((_c*ls)+hs+3)|0;
			hs += 1;
            _d=((_d*(~hs))-ls+4)|0;
        }
    }
    // 乱数取得.
    const next = function() {
        let t = _a;
        let r = t;
        t = (t << 11);
        t = (t ^ r);
        r = t;
        r = (r >> 8);
        t = (t ^ r);
        r = _b;
        _a = r;
        r = _c;
        _b = r;
        r = _d;
        _c = r;
        t = (t ^ r);
        r = (r >> 19);
        r = (r ^ t);
        _d = r;
        return r;
    }
    // Byteリストの乱数を生成.
    const outByteList = function(out, cnt, len) {
        let n, i;
        const len4 = len >> 2;
        const lenEtc = len & 0x03;
        for(i = 0; i < len4; i ++) {
            n = next();
            out[cnt ++] = n & 0x0ff;
            out[cnt ++] = (n & 0x0ff00) >> 8;
            out[cnt ++] = (n & 0x0ff0000) >> 16;
            out[cnt ++] = ((n & 0xff000000) >> 24) & 0x0ff;
        }
        for(i = 0; i < lenEtc; i ++) {
            out[cnt ++] = next() & 0x0ff;
        }
    }
    // ランダムバイナリを指定数取得.
    const getBytes = function(len) {
        const ret = Buffer.alloc(len);
        outByteList(ret, 0, len);
        return ret;
    }
    // ランダムバイナリをout(Array)に格納.
    const getArray = function(out, len) {
        outByteList(out, out.length, len);
    }
    // 初期乱数のコードをセット.
    if(seed != undefined) {
        setSeed(seed);
    }
    return {
        setSeed: setSeed,
        next: next,
        getBytes: getBytes,
        getArray: getArray
    }
};

})();