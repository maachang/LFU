// [command]authUser管理.
// 
(function() {
'use strict';

// コマンド引数用.
const args = require("../modules/args.js");

// util.
const util = require("../modules/util/util.js");

// authUser.
const authUser = require("../../src/lib/auth/authUser.js");

// lfu用SecretsManagerコマンド名.
const COMMAND_NAME = "lfuaum";

// プロセス終了
const _exit = function(code) {
    process.on("exit", function() {
        process.exit(code);
    });
}

// 出力.
const p = function() {
    console.log.apply(null, arguments);
}

// エラー出力.
const error = function() {
    console.error.apply(null, arguments);
    _exit(1);
}

// ユーザ名に対するユーザ情報を取得.
// userName 対象のユーザ名を設定します.
// 戻り値: UserInfoが返却されます.
const getUserInfo = async function(userName) {
    try {
        return await authUser.get(userName);
    } catch(e) {
        error("[ERRPR]Target user does not exist.", e);
    }
    return undefined;
}

// user情報を表示.
// userInfo userInfoを設定します.
const getUserView = function(userInfo) {
    p("[SUCCESS]\n" +
        JSON.stringify(userInfo.getView(), null, "  "));
}

// 新しいユーザを作成する.
// userName 新しく作成するユーザ名を設定します.
// userType 対象のユーザタイプを設定します.
// admin Admin権限をONにしたい場合は true を設定します.
// groups 対象ユーザの所属グループを設定する場合は Array(string) で定義します.
// 戻り値: trueの場合、作成に成功しました.
const createUser = async function(userName, userType, admin, groups) {
    let rollbackUserFlag = false;
    let changeUser = false;
    let tempPassword = undefined;
    try {
        // 新しいユーザを作成.
        const userInfo = await authUser.create(userName, userType);
        // 今回の処理でユーザが作成された事を示す.
        rollbackUserFlag = true;
        // 権限付与指定が行われてる場合.
        if(typeof(admin) == "string") {
            admin = admin.trim().toLowerCase();
            admin = admin == "true";
        }
        if(typeof(admin) == "boolean") {
            // 管理者権限.
            if(admin == true) {
                // trueの場合はadmin権限付与.
                userInfo.setAdminPermission();
                changeUser = true;
            // 一般ユーザ権限.
            } else if(admin == false) {
                // falseの場合はユーザ権限付与.
                userInfo.setUserPermission();
                changeUser = true;
            }
        // 権限設定が存在しない.
        } else {
            // falseの場合はユーザ権限付与.
            userInfo.setUserPermission();
            changeUser = true;
        }
        // グループが指定されている場合.
        if(Array.isArray(groups) && groups.length > 0) {
            const len = groups.length;
            for(let i = 0; i < len; i ++) {
                userInfo.addGroup(groups[i]);
                changeUser = true;
            }
        }
        // パスワードユーザの場合.
        if(userInfo.isPasswordUser()) {
            // 仮パスワードを発行.
            tempPassword = userInfo.resetPassword();
            changeUser = true;
        }
        // ユーザ生成後にユーザ情報の変更があった場合.
        if(changeUser) {
            // 変更内容を保存.
            await userInfo.save();
        }
        if(tempPassword != undefined) {
            // 発行された仮パスワードと生成結果を表示.
            p("[SUCCESS]Temporary password: \"" + tempPassword + "\"\n\n" +
                JSON.stringify(userInfo.getView(), null, "  "));
        } else {
            // 生成結果を表示.
            getUserView(userInfo);
        }
        return true;
    } catch(e) {
        // エラーの場合、今回新規作成したユーザは削除(rollback).
        if(rollbackUserFlag) {
            try {
                await authUser.remove(userName);
            } catch(ee) {}
        }
        error(
            "[ERROR]User creation failed.", e);
    }
    return false;
}

// 既存ユーザを編集.
// userName 新しく作成するユーザ名を設定します.
// admin trueの場合、対象ユーザを管理者として設定します.
// addGroup 追加したいグループ名をArrayで設定します.
// removeGroup 削除したいグループ名をArrayで設定します.
// 戻り値: trueの場合、成功しました.
const editUser = async function(userName, admin, addGroups, removeGroups) {
    // ユーザ情報を取得.
    const userInfo = await getUserInfo(userName);
    if(userInfo == undefined) {
        return false;
    }
    try {
        let changeUser = false;
        // 権限付与指定が行われてる場合.
        if(typeof(admin) == "string") {
            admin = admin.trim().toLowerCase();
            admin = admin == "true";
        }
        if(typeof(admin) == "boolean") {
            if(admin == true) {
                // trueの場合はadmin権限付与.
                userInfo.setAdminPermission();
            } else {
                // falseの場合はユーザ権限付与.
                userInfo.setUserPermission();
            }
            changeUser = true;
        }
        // 削除グループが指定されている場合.
        if(Array.isArray(removeGroups) && removeGroups.length > 0) {
            const len = removeGroups.length;
            for(let i = 0; i < len; i ++) {
                userInfo.removeGroup(removeGroups[i]);
                changeUser = true;
            }
        }
        // 追加グループが指定されている場合.
        if(Array.isArray(addGroups) && addGroups.length > 0) {
            const len = addGroups.length;
            for(let i = 0; i < len; i ++) {
                userInfo.addGroup(addGroups[i]);
                changeUser = true;
            }
        }
        // ユーザ生成後にユーザ情報の変更があった場合.
        if(changeUser) {
            // 変更内容を保存.
            await userInfo.save();
        }
        // 編集結果を表示.
        getUserView(userInfo);
        return true;
    } catch(e) {
        error(
            "[ERROR]User edit failed.", e);
    }
    return false;
}

// 指定ユーザに対するパスワードリセット.
// userName パスワードリセットするユーザ名を設定します.
// 戻り値: trueの場合、パスワードリセットに成功しました.
const resetPassword = async function(userName) {
    const userInfo = await getUserInfo(userName);
    if(userInfo == undefined) {
        return false;
    }
    try {
        // パスワードリセット.
        const password = userInfo.resetPassword();
        // 発行された仮パスワードを表示.
        p("[SUCCESS]Temporary password: \"" + password + "\"");
        return true;
    } catch(e) {
        error("[ERROR]Password reset failed.")
    }
    return false;
}

// ユーザの削除.
// userName 対象のユーザ名を設定します.
// 戻り値: trueの場合削除に成功しました.
const remove = async function(userName) {
    try {
        // trueの場合成功.
        if(await authUser.remove(userName)) {
            p("[SUCCESS]Target user Deletion successful.");
            return true;    
        // falseの場合失敗.
        } else {
            console.warn(
                "[WARN]User " + userName + " does not exist.");    
        }
    } catch(e) {
        error(
            "[ERROR]Target user Deletion failed.", e);
    }
    return false;
}

// 対象ユーザ名の情報を表示.
// userName 対象のユーザ名を設定します.
// 戻り値: trueの場合正常に処理されました.
const getUser = async function(userName) {
    try {
        const userInfo = await getUserInfo(userName);
        if(userInfo == undefined) {
            return false;
        }
        getUserView(userInfo);
        return true;
    } catch(e) {
        error(
            "[ERRPR]Target user does not exist.", e);
    }
    return false;
}

// ユーザ名一覧を取得.
// detail trueの場合、ユーザ毎の詳細情報を含めて表示とします.
//        false および指定なしの場合は、ユーザ名だけを表示します.
const list = async function(detail) {
    try {
        let i, len, marker, off = 0, max = 50;
        let list = [];
        while(true) {
            const n = await authUser.list(
                off, max, marker);
            const lst = n.list;
            len = lst.length;
            for(i = 0; i < len; i ++) {
                list[list.length] = lst[i];
            }
            off += len;
            marker = n.marker;
            if(len == 0 || marker == null) {
                break;
            }
        }
        // 詳細を取得.
        if(detail == true) {
            const n = [];
            len = list.length;
            for(i = 0; i < len; i ++) {
                // ユーザ表示用として詳細を取得.
                n[n.length] = (await authUser.get(list[i]))
                    .getView();
            }
            list = n;
        }
        // JSON出力.
        p("[SUCCESS]\n" +
            JSON.stringify(list, null, "  "));
        return true;
    } catch(e) {
        error("[ERROR]Failed to get user list.", e);
    }
    return false;
}

// ヘルプ.
const help = function() {
    p("Usage: %s [OPTION]...", COMMAND_NAME);
    p("It is a command that manages user information for authentication and")
    p(" approval with LFU.");
    p("");
    p("  --profile Set the Profile name you want to use in ~/.lfu.env.json.")
    p("");
    p("Set execution subcommand [generate] [edit] [password] [remove] [get] [list].")
    p("> " + COMMAND_NAME + " [Set execution subcommand]")
    p(" generate: Create new authentication and approval users.")
    p("   -u or --user:       [Required]Set the target user name.")
    p("   -m or --mode:       [Optional]\"password\" dedicated to password,")
    p("                                 \"oauth\" GAS authentication.")
    p("                       If you do not set anything, it will be \"oauth\".")
    p("                       For password users, a temporary password is registered.")
    p("   -a or --admin:      [Optional]For Admin users, define this content.")
    p("   -g or --group:      [Optional]Define a group addition, for example,")
    p("                                 when doing multiple ABC, Xyz.")
    p("                       > -g ABC -g xyz")
    p(" edit: Edit to existing users.")
    p("   -u or --user:       [Required]Set the target user name.")
    p("   -a or --admin:      [Optional]Set to 'true' if you want to grant administrator")
    p("                                 privileges, or 'false' if you are a general user.")
    p("                                 Do not set anything else.")
    p("   -p or --put:        [Optional]Set the group you want to add. The addition of")
    p("                                 multiple groups is as follows.")
    p("                       > -p ABC -p xyz")
    p("   -r or --remove:     [Optional]Set the group you want to delete. The addition")
    p("                                 of multiple groups is as follows.")
    p("                       > -r ABC -r xyz")
    p(" password: Reset the password of the target password user.")
    p("           For password users, a temporary password is registered.")
    p("   -u or --user:       [Required]Set the target user name.")
    p(" remove: Delete the specified user.")
    p("   -u or --user:       [Required]Set the target user name.")
    p(" get: Displays the setting information of the specified user.")
    p("   -u or --user:       [Required]Set the target user name.")
    p(" list: Display the registered user list.")
    p("   -d or --detail:     [Optional]If this content is defined, output user")
    p("                                 detailed information.")
    p();
}

// コマンド実行.
const command = async function() {
    try {
        // ヘルプ呼び出し.
        if(args.isValue("-h", "--help")) {
            help();
            _exit(0);
            return;
        }

        // 実行副コマンドを取得.
        let type = args.get(0);
        if(type == null || type == "") {
            // 設定されてない場合.
            //error("[ERROR]Execution subcommand not set.");
            // エラー+helpを出力.
            help()
            _exit(1);
            return;
        }
        type = type.trim().toLowerCase();

        // ${HOME}/.lfu.env.json を反映する.
        require("../lfuEnv.js").reflection(args.get("--profile"));

        // 必須環境変数が定義されているかチェック.
        if(!util.requireEnv(["MAIN_S3_BUCKET"])) {
            _exit(1);
            return;
        }
        
        // create処理.
        if(type == "generate" || type == "create") {
            const user = args.get("-u", "--user");
            const mode = args.get("-m", "--mode");
            const admin = args.isValue("-a", "--admin");
            const group = args.getArray("-g", "-group");
            const result = await createUser(user, mode, admin, group);
            if(result) {
                _exit(0);
            }
            return;
        }
        // edit処理.
        else if(type == "edit" || type == "update") {
            const user = args.get("-u", "--user");
            const admin = args.get("-a", "--admin");
            const put = args.getArray("-p", "-put");
            const remove = args.getArray("-r", "-remove");
            const result = await editUser(user, admin, put, remove);
            if(result) {
                _exit(0);
            }
            return;
        }
        // passwordリセット処理.
        else if(type == "password" || type == "change") {
            const user = args.get("-u", "--user");
            const result = await resetPassword(user);
            if(result) {
                _exit(0);
            }
            return;
        }
        // remove処理.
        else if(type == "remove" || type == "delete") {
            const user = args.get("-u", "--user");
            const result = await remove(user);
            if(result) {
                _exit(0);
            }
            return;
        }
        // get処理.
        else if(type == "get") {
            const user = args.get("-u", "--user");
            const result = await getUser(user);
            if(result) {
                _exit(0);
            }
            return;
        }
        // list処理.
        else if(type == "list" || type == "ls") {
            const detail = args.isValue("-d", "--detail");
            const result = await list(detail);
            if(result) {
                _exit(0);
            }
            return;
        }

        // バージョン呼び出し.
        if(args.isValue("-v", "--version")) {
            const pkg = require("../package.json");
            p(pkg.version);
            _exit(0);
            return;
        }
        
        // それ以外.
        error("[ERROR]Execution subcommand not set: " + type);

    } catch(e) {
        // エラー出力.
        error("[ERROR]", e);
    }
}

// コマンド実行.
command();

})();
