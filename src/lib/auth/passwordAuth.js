//////////////////////////////////////////////
// パスワード認証を実現するためのモジュール.
//////////////////////////////////////////////
(function() {
'use strict'

// frequireが設定されていない場合.
let frequire = global.frequire;
if(frequire == undefined) {
    // frequire利用可能に設定.
    require("../../freqreg.js");
    frequire = global.frequire;
}

// ログインマネージャー.
const loginMan = frequire("./lib/auth/manager.js");



})();