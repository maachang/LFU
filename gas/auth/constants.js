// 定数定義情報.

// (user-setting)[Token生成用]Auth用KeyCode定義.
// 許可されたリクエストのみ利用が可能にするためのToken作成を行う
// KeyCodeを設定します.
// この内容はセンシティブな情報なので、GITにPushはNGです.
const ALLOW_AUTH_KEY_CODE =
    "Note: Do not upload to git";

// (user-setting)[allow mail Domain]許可するメールアドレスのドメイン名群.
const ALLOW_MAIL_DOMAINS = [
    // ここにドメイン名(@除く文字列)を設定します.

];

// (user-setting)[favicon.ico]googleDrive上のfavicon.ico(png形式のみ).
// ここではファイルIDを設定します.
const GDRV_FAVICON_ICO_ID = "";

