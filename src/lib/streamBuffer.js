// stream読み込みに対するBuffer.
// streamの場合、対象streamの読み込みはchunked(塊単位)のデータが
// 提供されます.
// これに対してたとえば `改行単位でデータを取得` したい場合だと
// streamデータ取得の場合、結構面倒な実装となります.
// 
// これらを解決するのが、このストリームバッファです.
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../freqreg.js");
    frequire = global.frequire;
}

// java風のarraycopy(Buffer専用).
// src コピー元のarray.
// srcPos コピー元の開始位置.
// dest コピー先のarray.
// destPos コピー先の開始位置.
// len コピーする配列の長さ.
const arraycopy = function(src, srcPos, dest, destPos, len) {
    //src.copy(dest, destPos, srcPos, len);
    for(let i = 0; i < len; i ++) {
        dest[destPos + i] = src[srcPos + i];
    }
}

// streamBufferを生成.
// bufferSize 初期バッファサイズを設定します.
//            1024未満の場合は1024になります.
// 戻り値: streamBufferを操作するためのfunction群が返却されます.
exports.create = function(bufferSize) {
    bufferSize = bufferSize|0;
    // 最低サイズ(1kByte).
    if(bufferSize < 1024) {
        bufferSize = 1024;
    // 最大サイズ(1MByte).
    } else if(bufferSize >= 0x0100000) {
        bufferSize = 0x0100000;
    }
    const o = {};
    // メモリバッファ.
    let buffer = Buffer.allocUnsafe(bufferSize);
    // 現在有効なバッファ位置.
    let validPosition = 0;

    // バッファ情報を破棄.
    o.destroy = function() {
        buffer = null;
        validPosition = -1;
    }

    // バッファ内容をクリア.
    o.clear = function() {
        buffer = Buffer.allocUnsafe(bufferSize);
        validPosition = 0;
    }

    // バッファ情報を追加.
    // addBuf 追加対象のバッファを設定します.
    o.push = function(addBuf) {
        const t = typeof(addBuf);
        if(t == "string" || t == "number") {
            // Buffer変換.
            addBuf = Buffer.from(addBuf);
        }
        const addBufLen = addBuf.length;
        const bufLimit = buffer.length - validPosition;
        // 書き込むバッファ領域より大きなデータ設定されている場合.
        if(bufLimit < addBufLen) {
            // バッファを拡大.
            const newBufLen = (buffer.length * 2) + addBufLen;
            let newBuf = Buffer.allocUnsafe(newBufLen);
            arraycopy(buffer, 0, newBuf, 0, validPosition);
            buffer = newBuf;
        }
        // バッファに追加.
        arraycopy(addBuf, 0, buffer, validPosition, addBufLen);
        // 有効バッファ位置に追加バッファを反映.
        validPosition += addBufLen;
    }

    // bufferに対して、check内容と一致する内容を検索.
    // check 指定位置を取得するための文字列やバイナリを設定します.
    // offset チェックするための開始位置を設定します.
    // 戻り値: 位置情報が返却されます.
    //         見つからない場合は-1.
    o.indexOf = function(check, offset) {
        offset = offset|0;
        const t = typeof(check);
        if(t == "string" || t == "number") {
            // Buffer変換.
            check = Buffer.from(check);
        }
        let i, j, k, jLen, retPos;
        const top = check[0];
        const checkLen = check.length;
        const len = validPosition - (checkLen - 1);
        for(i = offset; i < len; i ++) {
            if(buffer[i] == top) {
                retPos = i;
                jLen = i + checkLen;
                for(j = i + 1, k = 1; j < jLen; j ++, k ++) {
                    if(buffer[j] != check[k]) {
                        retPos = -1;
                    }
                }
                if(retPos != -1) {
                    return retPos;
                }
            }
        }
        return -1;
    }

    // バッファ内容から指定位置までの情報を取得.
    // 取得された内容は削除されます.
    // len 読み込み対象の長さを設定します.
    // 戻り値: Bufferが返却されます.
    o.get = function(len) {
        if(len > validPosition) {
            throw new Error(
                "A position (" + len +
                ") has been set that exceeds the length (" +
                validPosition + ").")
        }
        const ret = Buffer.allocUnsafe(len);
        arraycopy(buffer, 0, ret, 0, len);
        arraycopy(buffer, len, buffer, 0, validPosition - len);
        validPosition -= len;
        return ret;
    }

    // 指定位置のbyte情報を取得.
    // no 対象の位置を設定します.
    // 戻り値: byte情報が返却されます.
    o.getByte = function(no) {
        if(no >= validPosition) {
            throw new Error(
                "Specified position " + no +
                " is out of range " + validPosition);
        }
        return buffer[no] & 0x0ff;
    }

    // 指定位置のbyte情報を取得.
    // この処理は `getByte` と違って length の範囲の確認をしません.
    // `length` の範囲内で取得する場合はこちらを利用してください.
    // no 対象の位置を設定します.
    // 戻り値: byte情報が返却されます.
    o.getByteUnsafe = function(no) {
        return buffer[no] & 0x0ff;
    }

    // 現在の有効な長さを取得.
    // 戻り値: 有効な長さが返却されます.
    o.length = function() {
        return validPosition;
    }

    // バッファ自体の長さを取得.
    // 戻り値: バッファ自体の長さが返却されます.
    o.bufferLength = function() {
        return buffer.length;
    }

    // buffer全体を取得.
    // 戻り値: buffer全体が返却されます.
    o.buffer = function() {
        const ret = Buffer.allocUnsafe(validPosition);
        arraycopy(buffer, 0, ret, 0, validPosition);
        return ret;
    }
    return o;
}

})();

