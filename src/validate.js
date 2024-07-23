/*-----------------------------------------------------------------------------
HTTPパラメータの検証を行う.
    使い方:
        // validate定義.
        const VALIDATE = validateGet({name: "hoge"}, {name: "moge"});
        // validate実行.
        VALIDATE();
    説明:
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
            - message(string)
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
                    HH:mm:ssのような時間情報.
                - timestamp
                    yyyy-MM-dd HH:mm:ss のような日付＋時間情報.
            - require(boolean)
                [任意]true の場合、存在しない場合はエラーが発生します.
                指定してない場合は true 扱い.
            - target(*)
                [任意]対象変数に対して入力状況の検証を行います.
                <設定パターン>
                    1. １つの検証設定.
                        (v) => (v > 0)
                    2. １つの検証と検証失敗に対する固有メッセージ設定.
                        {validate: (v) => (v > 0), message: "xxは0以上を設定"}
                    3. 複数の検証設定.
                        [(v) => (v > 0), (v) => (typeof(v) == "number")]
                    4. 複数の検証と検証失敗に対する固有メッセージ設定.
                        {validate: [(v) => (v > 0), (v) => (typeof(v) == "number")], message: "xxは0以上の数字を設定"}
                固有メッセージ設定がされていない場合は validateパラメータの message が対象となります.
                targetのvalidate結果がfalseの場合はvalidate失敗となります.
                validateパラメータの type条件で変換された結果を検証対象とします.
            - pattern(*)
                [任意]正規表現を設定して入力状況の検証を行います.
                <設定パターン>
                    1. １つの正規表現設定.
                        /https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/
                    2. １つの正規表現と検証失敗に対する固有メッセージ設定.
                        {validate: /https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/, message: "xxはURLではありません"}
                    3. 複数の正規表現設定
                        [(v) => /https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/]
                    4. 複数の正規表現と検証失敗に対する固有メッセージ設定.
                        {validate: [/https?:\/\/[\w/:%#\$&\?\(\)~\.=\+\-]+/], message: "xxはURLではありません"}
                固有メッセージ設定がされていない場合は validateパラメータの message が対象となります.
                targetと併用の場合は先にpatternが対象となります.
                validateパラメータの type条件変換前の文字列を検証対象とします.
                また、予約された正規表現は以下の文字列設定での利用が可能となります.
                    - "url": http or httpsから始まるURLかをチェックします.
                    - "email": メールアドレス形式かチェックします.
                    - "zip": 郵便番号形式(ハイフン区切り)かチェックします.
                    - "tel": 電話番号形式(ハイフン区切り)かチェックします.
------------------------------------------------------------------------------*/
(function() {
'use strict'

// validate基本処理.
const validateXXX = function() {
    // 対象HTTPメソッドを取得.
    const method = arguments[0].trim().toLowerCase();
    // パラメータ検証条件を取得.
    const valudateList = [];
    const len = arguemnts.length;
    for(let i = 1; i < len; i ++) {
        // １つのパラメータに対する検証条件を生成.
        valudateList[valudateList.length] = createValidate(arguemnts[i]);
    }
    // 検証実行functionを返却.
    return function() {
        return executeValidate(method, validateList);
    };
}

// １つのパラメータに対する検証条件を生成.
const createValidate = function(oneValidate) {



}

// validate実行.
const executeValidate = function(method, valudateList) {

}


})();