////////////////////////////////////////////////
// 軽量暗号/符号処理.
////////////////////////////////////////////////
(function(_g) {
"use strict";

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

const nums = frequire("./lib/util/nums.js");
const strs = frequire("./lib/util/strs.js");
const xor128 = frequire("./lib/util/xor128.js");

// undefined定義.
const _u = undefined;

// 乱数生成.
const RAND = xor128.random;

// CustomBase64.
const CBase64 = (function() {
    let o = {};
    let EQ = '=';
    let ENC_CD = "0123456789+abcdefghijklmnopqrstuvwxyz/ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let DEC_CD = (function() {
        let src = ENC_CD;
        let ret = {};
        let len = src.length;
        for(let i = 0; i < len; i ++) {
            ret[src[i]] = i;
        }
        return ret;
    })();
    o.encode = function(bin) {
        let i, j, k;
        let allLen = bin.length;
        let etc = (allLen % 3)|0;
        let len = (allLen / 3)|0;
        let ret = "";
        for (i = 0, j = 0, k = 0; i < len; i++, j += 3, k += 4) {
            ret += ENC_CD[((bin[j] & 0x000000fc) >> 2)] +
                ENC_CD[(((bin[j] & 0x00000003) << 4) | ((bin[j+1] & 0x000000f0) >> 4))] +
                ENC_CD[(((bin[j+1] & 0x0000000f) << 2) | ((bin[j+2] & 0x000000c0) >> 6))] +
                ENC_CD[(bin[j+2] & 0x0000003f)];
            }
            switch (etc) {
                case 1:
                    j = len * 3;
                    k = len * 4;
                    ret += ENC_CD[((bin[j] & 0x000000fc) >> 2)] +
                        ENC_CD[((bin[j] & 0x00000003) << 4)] + EQ + EQ;
                    break;
                case 2:
                    j = len * 3;
                    k = len * 4;
                    ret += ENC_CD[((bin[j] & 0x000000fc) >> 2)] +
                        ENC_CD[(((bin[j] & 0x00000003) << 4) | ((bin[j+1] & 0x000000f0) >> 4))] +
                        ENC_CD[(((bin[j+1] & 0x0000000f) << 2))] + EQ;
                    break;
        }
        return ret;
    }
    o.decode = function(base64) {
        let i, j, k;
        let allLen = base64.length;
        let etc = 0;
        for (i = allLen - 1; i >= 0; i--) {
            if (base64.charAt(i) == EQ) {
                etc++;
            } else {
                break;
            }
        }
        let len = (allLen / 4)|0;
        let ret = new Uint8Array((len * 3) - etc);
        len -= 1;
        for (i = 0, j = 0, k = 0; i < len; i++, j += 4, k += 3) {
            ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
            ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
            ret[k + 2] = (((DEC_CD[base64[j+2]] & 0x00000003) << 6) | (DEC_CD[base64[j+3]] & 0x0000003f));
        }
        switch (etc) {
            case 0:
                j = len * 4;
                k = len * 3;
                ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
                ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
                ret[k + 2] = (((DEC_CD[base64[j+2]] & 0x00000003) << 6) | (DEC_CD[base64[j+3]] & 0x0000003f));
                break;
            case 1:
                j = len * 4;
                k = len * 3;
                ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
                ret[k + 1] = (((DEC_CD[base64[j+1]] & 0x0000000f) << 4) | ((DEC_CD[base64[j+2]] & 0x0000003c) >> 2));
                break;
            case 2:
                j = len * 4;
                k = len * 3;
                ret[k] = (((DEC_CD[base64[j]] & 0x0000003f) << 2) | ((DEC_CD[base64[j+1]] & 0x00000030) >> 4));
                break;
        }
        return ret;
    }
    return o;
})();

// コードフリップ.
const _flip = function(pause, step) {
    switch (step & 0x00000007) {
    case 1:
        return ((((pause & 0x00000003) << 6) & 0x000000c0) | (((pause & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff;
    case 2:
        return ((((pause & 0x0000003f) << 2) & 0x000000fc) | (((pause & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff;
    case 3:
        return ((((pause & 0x00000001) << 7) & 0x00000080) | (((pause & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff;
    case 4:
        return ((((pause & 0x0000000f) << 4) & 0x000000f0) | (((pause & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff;
    case 5:
        return ((((pause & 0x0000007f) << 1) & 0x000000fe) | (((pause & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff;
    case 6:
        return ((((pause & 0x00000007) << 5) & 0x000000e0) | (((pause & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff;
    case 7:
        return ((((pause & 0x0000001f) << 3) & 0x000000f8) | (((pause & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff;
    }
    return pause & 0x000000ff;
}

// コードnフリップ.
const _nflip = function(pause, step) {
    switch (step & 0x00000007) {
    case 1:
        return ((((pause & 0x0000003f) << 2) & 0x000000fc) | (((pause & 0x000000c0) >> 6) & 0x00000003)) & 0x000000ff;
    case 2:
        return ((((pause & 0x00000003) << 6) & 0x000000c0) | (((pause & 0x000000fc) >> 2) & 0x0000003f)) & 0x000000ff;
    case 3:
        return ((((pause & 0x0000007f) << 1) & 0x000000fe) | (((pause & 0x00000080) >> 7) & 0x00000001)) & 0x000000ff;
    case 4:
        return ((((pause & 0x0000000f) << 4) & 0x000000f0) | (((pause & 0x000000f0) >> 4) & 0x0000000f)) & 0x000000ff;
    case 5:
        return ((((pause & 0x00000001) << 7) & 0x00000080) | (((pause & 0x000000fe) >> 1) & 0x0000007f)) & 0x000000ff;
    case 6:
        return ((((pause & 0x0000001f) << 3) & 0x000000f8) | (((pause & 0x000000e0) >> 5) & 0x00000007)) & 0x000000ff;
    case 7:
        return ((((pause & 0x00000007) << 5) & 0x000000e0) | (((pause & 0x000000f8) >> 3) & 0x0000001f)) & 0x000000ff;
    }
    return pause & 0x000000ff;
}

// ハッシュ計算.
const fhash = function(code, uuidFlg) {
    let o = null;
    let n = [0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6];
    if(typeof(code) == "string") {
        code = strs.utf8ToBinary(code, 0, code.length);
    }
    let len = code.length;
    for(let i = 0; i < len; i ++) {
        o = (code[i] & 0x000000ff);
        if((o & 1) == 1) {
            o = _flip(o, o);
        } else {
            o = _nflip(o, o);
        }
        if((i & 1) == 1) {
            n[0] = n[0] + o;
            n[1] = n[1] - (o << 8);
            n[2] = n[2] + (o << 16);
            n[3] = n[3] - (o << 24);
            n[3] = n[3] ^ (o);
            n[2] = n[2] ^ (o << 8);
            n[1] = n[1] ^ (o << 16);
            n[0] = n[0] ^ (o << 24);
            n[0] = (n[3]+1) + (n[0]);
            n[1] = (n[2]-1) + (n[1]);
            n[2] = (n[1]+1) + (n[2]);
            n[3] = (n[0]-1) + (n[3]);
        } else {
            n[3] = n[3] + o;
            n[2] = n[2] - (o << 8);
            n[1] = n[1] + (o << 16);
            n[0] = n[0] - (o << 24);
            n[0] = n[0] ^ (o);
            n[1] = n[1] ^ (o << 8);
            n[2] = n[2] ^ (o << 16);
            n[3] = n[3] ^ (o << 24);
            n[0] = (n[3]+1) - (n[0]);
            n[1] = (n[2]-1) - (n[1]);
            n[2] = (n[1]+1) - (n[2]);
            n[3] = (n[0]-1) - (n[3]);
        }
        n[3] = (n[0]+1) ^ (~n[3]);
        n[2] = (n[1]-1) ^ (~n[2]);
        n[1] = (n[2]+1) ^ (~n[1]);
        n[0] = (n[3]-1) ^ (~n[0]);
    }

    // UUIDで返却.
    if(uuidFlg != false) {
        return nums.byte16ToUUID(n);
    }
    // バイナリで返却.
    return [
        (n[0] & 0x000000ff),
        ((n[0] & 0x0000ff00) >> 8),
        ((n[0] & 0x00ff0000) >> 16),
        (((n[0] & 0xff000000) >> 24) & 0x00ff),
        (n[1] & 0x000000ff),
        ((n[1] & 0x0000ff00) >> 8),
        ((n[1] & 0x00ff0000) >> 16),
        (((n[1] & 0xff000000) >> 24) & 0x00ff),  
        (n[2] & 0x000000ff),
        ((n[2] & 0x0000ff00) >> 8),
        ((n[2] & 0x00ff0000) >> 16),
        (((n[2] & 0xff000000) >> 24) & 0x00ff),  
        (n[3] & 0x000000ff),
        ((n[3] & 0x0000ff00) >> 8),
        ((n[3] & 0x00ff0000) >> 16),
        (((n[3] & 0xff000000) >> 24) & 0x00ff)
    ]
}

// 割符コード.
const tally = (function() {
    let _CODE = [59, 95, 36, 58, 37, 47, 38, 46, 61, 42, 44, 45, 126, 35, 94, 64];
    let _HEAD = 64;
    let _CHECK = 33;
    let _APPEND_CHECK = 124;
    (function() {
        let n = "";
        let _x = function(a) {return String.fromCharCode(a);}
        for(let i = 0;i < _CODE.length; i ++) {
            n += _x(_CODE[i]);
        }
        _CODE = n;
        _HEAD = _x(_HEAD);
        _CHECK = _x(_CHECK);
        _APPEND_CHECK = _x(_APPEND_CHECK);
    })();
    const o = {};
    
    // エンコード.
    o.enc = function(value, check) {
        if(typeof(check) == "string" && check.length > 0) {
            value += _CHECK + fhash(check);
        }
        value = strs.utf8ToBinary(value, 0, value.length);
        let i,j,n,m,c,t;
        let len = value.length;
        let allLen = (len << 1) + 2;
        let v = new Array(allLen);

        m = 255;
        v[0] = RAND.nextInt() & m;
        
        for(i = 0 ; i < len ; i ++) {
            v[1 + (i << 1)] = value[i];
            v[2 + (i << 1)] = RAND.nextInt() & m;
        }
        v[allLen-1] = RAND.nextInt() & m;
        
        len = allLen - 1;
        for(i = 0,t = 0 ; i < len ; i += 2) {
            n = v[i];
            if((t ++) & 1 == 0) {
            n = ~n;
            }
            for(j = i+1 ; j < len ; j += 2) {
            v[j] = (v[j] ^ n) & m;
            }
        }
        n = v[0];
        for(i = 1 ; i < len ; i ++) {
            v[i] = ((i & 1 == 0) ?
            v[i] ^ n :
            v[i] ^ (~n))
            & m;
        }
        n = v[len];
        for(i = len-1 ; i >= 0 ; i --) {
            v[i] = ((i & 1 == 0) ?
            v[i] ^ (~n) :
            v[i] ^ n)
            & m;
        }
        c = _CODE;
        let buf = "";
        for(i = 0 ; i < allLen ; i ++) {
            n = v[i];
            for(j = 0 ; j < 2 ; j ++) {
            buf += (c.charAt((n & (0x0f << (j << 2))) >> (j << 2)));
            }
        }
        if(typeof(check) == "string" && check.length > 0) {
            return _HEAD + buf + _APPEND_CHECK;
        }
        return _HEAD + buf;
    }
    
    // デコード.
    o.dec = function(value, check) {
        let useCheck = false;
        let ret = null;
        try {
            if(!(typeof(value) == "string" && value.length > 0) ||
                value.charAt(0) != _HEAD ||
                value.length & 1 == 0) {
                return null;
            }
            if(value[value.length-1] == _APPEND_CHECK) {
                useCheck = true;
                value = value.substring(0,value.length-1);
            }
            let i,j,k,a,b,c,m,n,t;
            let len = value.length;
            let v = new Array((len-1) >> 1);
            m = 255;
            c = _CODE;
            for(i = 1,k = 0 ; i < len ; i += 2) {
                a = c.indexOf(value.charAt(i));
                b = c.indexOf(value.charAt(i+1));
                if(a == -1 || b == -1) {
                return null;
                }
                v[k ++] = (a | (b << 4)) & m;
            }
            len = v.length - 1;
            n = v[len];
            for(i = len-1 ; i >= 0 ; i --) {
                v[i] = ((i & 1 == 0) ?
                v[i] ^ (~n) :
                v[i] ^ n)
                & m;
            }
            n = v[0];
            for(i = 1 ; i < len ; i ++) {
                v[i] = ((i & 1 == 0) ?
                v[i] ^ n :
                v[i] ^ (~n))
                & m;
            }
            for(i = 0,t = 0 ; i < len ; i += 2) {
                n = v[i];
                if((t ++) & 1 == 0) {
                n = ~n;
                }
                for(j = i+1 ; j < len ; j += 2) {
                v[j] = (v[j] ^ n) & m;
                }
            }
            let cnt = 0;
            let vv = new Array((len>>1)-1);
            for(i = 1 ; i < len ; i += 2) {
                vv[cnt++] = v[i];
            }
            ret = strs.binaryToUTF8(vv, 0, vv.length);
        } catch(e) {
            throw new Error("Analysis failed.");
        }
        
        if(typeof(check) == "string" && check.length > 0) {
            check = fhash(check);
            let p = ret.lastIndexOf(_CHECK + check);
            if(p == -1 || (ret.length - p) != check.length + 1) {
                throw new Error("Check codes do not match.");
            }
            return ret.substring(0,ret.length-(check.length + 1));
        } else if(useCheck) {
            throw new Error("Analysis failed.");
        }
        return ret;
    }
    return o;
})();

const o = {};
const DEF_HEAD = "";
//o.CBase64 = CBase64;
o.tally = tally;
o.fhash = fhash;

// 指定文字列を保証するキーを生成.
o.key = function(word, src) {
    if(src == _u || src == null) {
        src = "un$634126$3rC";
    }
    let srcBin = code16(src, 1);
    let wordBin = code16(word, 1);
    let ret = srcBin.concat(wordBin);
    for(let i = 0 ; i < 16 ; i ++) {
        ret[i] = _convert(ret, i, wordBin[i]);
    }
    for(let i = 15,j = 0 ; i >= 0 ; i --,j ++) {
        ret[i+16] = _convert(ret, i+16, srcBin[j]);
    }
    return ret;
}

// エンコード.
o.enc = function(value, pKey, head) {
    value = "" + value;
    return o.benc(strs.utf8ToBinary(value, 0, value.length), pKey, head);
}

// バイナリエンコード.
o.benc = function(bin, pKey, head) {
    head = head == null || head == _u ? DEF_HEAD : head;
    // 第一引数がバイナリ.
    let pubKey = _randKey();
    let key32 = _convertKey(pKey, pubKey);
    let key256 = _key256(key32);
    key32 = null;
    let stepNo = _getStepNo(pKey, bin) & 0x0000007f;
    let nowStep = _convert256To(key256, pubKey, stepNo);
    _ed(true, bin, key256, nowStep);
    let eb = new Uint8Array(34+bin.length);
    eb[0] = RAND.nextInt() & 0x000000ff;
    eb[1] = (~(stepNo^eb[0]));
    arraycopy(pubKey, 0, eb, 2, 32);
    arraycopy(bin, 0, eb, 34, bin.length);
    return head + CBase64.encode(eb);
}

// デコード.
o.dec = function(value, pKey, head) {
    value = o.bdec(value, pKey, head);
    return strs.binaryToUTF8(value, 0, value.length);
}

// バイナリデコード.
o.bdec = function(value, pKey, head) {
    head = head == null || head == _u ? DEF_HEAD : head;
    let bin = CBase64.decode(value.substring(""+head.length));
    if(bin.length <= 34) {
        throw new Error("decode:Invalid binary length.");
    }
    let stepNo = ((~(bin[1]^bin[0]))&0x0000007f);
    let pubKey = new Uint8Array(32);
    arraycopy(bin, 2, pubKey, 0, 32);
    let bodyLen = bin.length - 34;
    let body = new Uint8Array(bodyLen);
    arraycopy(bin, 34, body, 0, bodyLen);
    bin = null;
    let key32 = _convertKey(pKey, pubKey);
    let key256 = _key256(key32);
    key32 = null;
    let nowStep = _convert256To(key256, pubKey, stepNo);
    _ed(false, body, key256, nowStep);
    let destStepNo = _getStepNo(pKey, body) & 0x0000007f;
    if(destStepNo != stepNo) {
        throw new Error("decode:Decryption process failed.");
    }
    return body;
}

// ランダムキーを生成.
const _randKey = function() {
    let bin = new Uint8Array(32);
    for(let i = 0 ; i < 32 ; i ++) {
        bin[i] = (RAND.nextInt() & 0x000000ff);
    }
    return bin;
}

// コード16データを作成.
// s 処理対象情報.
// mode
//   1 : string
//   それ以外: 配列.
const code16 = function(s, mode) {
    let ret = mode == 1 ?
        [177, 75, 163, 143, 73, 49, 207, 40, 87, 41, 169, 91, 184, 67, 254, 89] :
        [87, 41, 169, 91, 184, 67, 254, 89, 177, 75, 163, 143, 73, 49, 207, 40];
    let n, type;
    let len = s.length;
    mode = mode|0;
    type = typeof(s) == "string";
    for(let i = 0; i < len; i ++) {
        n = type ? (s.charCodeAt(i)|0) & 0x00ffffff:
        (s[i]|0) & 0x00ffffff;
        if((i&0x00000001) == 0) {
            for(let j = 0; j < 16; j+= 2) {
                ret[j] = ret[j] ^ (n-(i+j));
            }
            for(let j = 1; j < 16; j+= 1) {
                ret[j] = ret[j] ^ ~(n-(i+j));
            }
        }
        else {
            for(let j = 1; j < 16; j+= 1) {
                ret[j] = ret[j] ^ (n-(i+j));
            }
            for(let j = 0; j < 16; j+= 2) {
                ret[j] = ret[j] ^ ~(n-(i+j));
            }
        }
    }
    for(let i = 0; i < 16; i++) {
        ret[i] = ret[i] & 0x000000ff;
    }
    return ret;
}

/// 変換処理.
const _convert = function(key, no, pause) {
    switch ((no & 0x00000001)) {
        case 0:
        return (((pause ^ key[no])) & 0x000000ff);
        case 1:
        return (~(pause ^ key[no]) & 0x000000ff);
    }
    return 0;
}

const _convertKey = function(pKey, key) {
    let low = code16(pKey,0);
    let hight = code16(key,0);
    let ret = new Uint8Array(32);
    for (let i = 0,j = 0,k = 15; i < 16; i++, j += 2, k--) {
        ret[j] = _convert(low, i, key[j]);
        ret[j + 1] = _convert(hight, i, low[k]);
    }
    return ret;
}

const _key256 = function(key32) {
    let ret = new Uint8Array(256);
    let b = new Uint8Array(4);
    let o;
    let n = 0;
    let s,e;
    for(let i = 0,j = 0 ; i < 31 ; i += 2,j += 16) {
        s = (key32[i] & 0x000000ff);
        e = (key32[i+1] & 0x000000ff);
        if((n & 0x00000001) != 0) {
            n += s ^ (~ e);
        }
        else {
            n -= (~s) ^ e;
        }
        b[0] = (n & 0x000000ff);
        b[1] = (((n & 0x0000ff00)>>8)&0x000000ff);
        b[2] = (((n & 0x00ff0000)>>16)&0x000000ff);
        b[3] = (((n & 0xff000000)>>24)&0x000000ff);
        o = code16(b,0);
        arraycopy(o,0,ret,j,16);
    }
    return ret;
}

const _getStepNo = function(pubKey, binary) {
    let i, j;
    let bin;
    let ret = 0;
    let len = binary.length;
    let addCd = (pubKey[(binary[len>>1] & 0x0000001f)] & 0x00000003) + 1;
    for (i = 0, j = 0; i < len; i += addCd, j += addCd) {
        bin = ((~binary[i]) & 0x000000ff);
        ret = ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
            + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
            + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
            + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7))
            + (j & 0x000000ff) + ret;
    }
    if ((ret & 0x00000001) == 0) {
        for (i = 0; i <32; i++) {
        bin = (((pubKey[i] & 0x00000001) == 0) ? ((~pubKey[i]) & 0x000000ff)
            : (pubKey[i] & 0x000000ff));
        ret += ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
            + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
            + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
            + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7));
        }
    } else {
        for (i = 0; i < 32; i++) {
        bin = (((pubKey[i] & 0x00000001) == 0) ? ((~pubKey[i]) & 0x000000ff)
            : (pubKey[i] & 0x000000ff));
        ret -= ((bin & 0x00000001) + ((bin & 0x00000002) >> 1)
            + ((bin & 0x00000004) >> 2) + ((bin & 0x00000008) >> 3)
            + ((bin & 0x00000010) >> 4) + ((bin & 0x00000020) >> 5)
            + ((bin & 0x00000040) >> 6) + ((bin & 0x00000080) >> 7));
        }
    }
    return ((~ret) & 0x000000ff);
}

const _convert256To = function(key256, pKey, step) {
    let ns = step;
    for (let i = 0, j = 0; i < 256; i++, j = ((j + 1) & 0x0000001f)) {
        if(((ns = (ns ^ (~(key256[i])))) & 0x00000001) == 0) {
            ns = ~ns;
        }
        key256[i] = _convert(pKey, j, key256[i]);
        key256[i] = _flip(key256[i], ns);
    }
    return ns;
}

const _ed = function(mode, binary, key256, step) {
    let len = binary.length;
    let ns = step;
    if(mode) {
        for (let i = 0, j = 0; i < len; i++, j = ((j + 1) & 0x000000ff)) {
            ns = (ns ^ (~(key256[j])));
            if((ns & 0x00000001) != 0) {
                ns = ~ns;
            }
            binary[i] = _convert(key256, j, binary[i]);
            binary[i] = _flip(binary[i], ns);
        }
    }
    else {
        for (let i = 0, j = 0; i < len; i++, j = ((j + 1) & 0x000000ff)) {
            ns = (ns ^ (~(key256[j])));
            if((ns & 0x00000001) != 0) {
                ns = ~ns;
            }
            binary[i] = _nflip(binary[i], ns);
            binary[i] = _convert(key256, j, binary[i]);
        }
    }
}

const arraycopy = function(s, sp, d, dp, len) {
    len = len|0;
    sp = sp|0;
    dp = dp|0;
    for(let i = 0 ; i < len ; i ++) {
        d[(dp+i)] = s[(sp+i)];
    }
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
for(let k in o) {
    exports[k] = o[k];
}

})(global);
