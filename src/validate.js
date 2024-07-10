/*-----------------------------------------------------------------------------
HTTPパラメータの検証を行う.
    - validateXXX = function({}...);
        - XXX 設定名.
            - 未定義
                Methodの種類を限定しない.
            - Get
                method=GETのみ有効.
            - Post
                method=POSTのみ有効.
            - Delete
                method=DELETEのみ有効.
            - Put
                method=PUTのみ有効.
            - Patch
                method=PATCHのみ有効.
    - validateパラメータ.
        - name(string)
            [必須]パラメータ名.
        - message or msg(string)
            [必須]検証失敗時の共通エラーメッセージ内容.
        - type(string)
            [任意]対象タイプ.
            未指定の場合は "string" 扱い.
            - string
                文字列.
            - boolean or bool
                true or false.
            - number
                整数及び浮動小数点.
            - float
                浮動小数点のみ.
            - date
                yyyy-MM-ddのような日付情報.
            - time
                HH:mm:sssのような時間情報.
            - timestamp
                yyyy-MM-dd HH:mm:ss のような日付＋時間情報.
        - require(boolean)
            [任意]true の場合、存在しない場合はエラーが発生します.
            指定してない場合は true 扱い.
        - target()
            [任意]
        - pattern
    
------------------------------------------------------------------------------*/
(function() {
'use strict'



})();