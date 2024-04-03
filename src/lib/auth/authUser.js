//////////////////////////////////////////
// 承認・認証用User情報管理.
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

// auth/util.
const authUtil = frequire("./lib/auth/util.js");

// xor128.
const xor128 = frequire("./lib/util/xor128.js");

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// [ENV]authUser情報を出力するS3Prefix.
const ENV_S3_AUM_PREFIX = "S3_AUM_PREFIX";

// デフォルトのauthUser出力先S3Prefix.
const DEFAULT_S3_AUM_PREFIX = "authUsers";

// ログインユーザテーブル.
let _userTable = undefined;
const userTable = function() {
	if(_userTable == undefined) {
		_userTable = s3kvs.create().currentTable(
			authUtil.useString(process.env[ENV_S3_AUM_PREFIX]) ?
				process.env[ENV_S3_AUM_PREFIX] :
				DEFAULT_S3_AUM_PREFIX
		);
	}
	return _userTable;
}

// [ENV]最大AUM表示件数設定.
const ENV_AUM_LIST_LIMIT = "AUM_LIST_LIMIT";

// 最大AUM表示件数を取得.
const MAX_AUM_LIST_LIMIT = 100;

// [ENV]最大表示件数.
let AUM_LIST_LIMIT = process.env[ENV_AUM_LIST_LIMIT]|0;
if(AUM_LIST_LIMIT >= MAX_AUM_LIST_LIMIT) {
    AUM_LIST_LIMIT = MAX_AUM_LIST_LIMIT;
} else if(AUM_LIST_LIMIT <= 0) {
    AUM_LIST_LIMIT = 25;
}

// [ENV]oauthログインに対してユーザ登録なしの場合、一般ユーザログイン利用可能設定.
const ENV_OAUTH_NO_USER_REGISTER = "OAUTH_NO_USER_REGISTER";

// [ENV]仮パスワードの長さ.
const ENV_TENTATIVE_PASSWORD_LENGTH = "TENTATIVE_PASSWORD_LENGTH";

// デフォルト仮パスワードの長さ.
const DEF_TENTATIVE_PASSWORD_LENGTH = 24;
	
// *[変更不可]ユーザ名(string).
// ログインユーザ名.
const USER_NAME = "user";

// *[変更不可]ユーザ作成日.
// -1の場合はUserInfoは読み込み専用モード.
const CREATE_DATE = "createDate";

// [変更時に更新]更新日.
const UPDATE_DATE = "updateDate";

// *[変更不可]ユーザタイプ(string).
// ログインに関するタイプ定義.
const USER_TYPE = "userType";

// [変更可能]パスワード(string).
// パスワード専用で利用可能.
const PASSWORD = "password";

// *[自動更新]パスワード更新日.
// -1の場合、仮パスワード状態.
// 0の場合はパスワードなし.
const UPDATE_PASSWORD_DATE = "updatePasswordDate";

// [変更可能]グループ(array).
// 対象ユーザが所属するグループ一覧.
const GROUP = "group";

// *[変更可能]ユーザ権限(string).
const PERMISSION = "permission";

// [変更可能]options設定(dict).
// ここに独自の定義が設定される.
const OPTIONS = "options";

// [CREATE_DATE] 読み込み専用.
const CREATE_DATE_BY_READONLY = -1;

// [UPDATE_PASSWORD_DATE]パスワードなし.
const UPDATE_PASSWORD_DATE_BY_NO_PASSWORD = 0;

// [UPDATE_PASSWORD_DATE]仮パスワード.
const UPDATE_PASSWORD_DATE_BY_TENTATIVE_PASSWORD = -1;

// [USER_TYPE]全てのユーザタイプ.
const USER_TYPE_ALL = "all";
// [USER_TYPE]パスワード専用ユーザ.
const USER_TYPE_PASSWORD = "password";
// [USER_TYPE]oauth専用ユーザ.
const USER_TYPE_OAUTH = "oauth";

// [PERMISSION]管理者権限.
const PERMISSION_ADMIN = "admin";
// [PERMISSION]一般ユーザ.
const PERMISSION_USER = "user";

// [MFA]パスワードMFAコード.
const PASSWORD_MFA_CODE = "passwordMfa";

// userInfo情報の必須項目チェック.
// info UserInfoを設定します.
const _requiredUserInfo = function(info) {
	let err = false;
	try {
		// ユーザー必須項目の存在チェック.
		if(info == undefined ||
			!authUtil.useString(info[USER_NAME]) ||
			!authUtil.useString(info[USER_TYPE]) ||
			!authUtil.useString(info[PERMISSION]) ||
			!authUtil.isNumeric(info[CREATE_DATE]) ||
			!authUtil.isNumeric(info[UPDATE_DATE]) ||
			!authUtil.isNumeric(info[UPDATE_PASSWORD_DATE])) {
			err = true;
			throw new Error("User info does not exist.");
		}
	} catch(e) {
		if(err) {
			throw e;
		}
		throw new Error("User info does not exist.");			
	}
}

// ユーザ情報を取得.
// user ユーザ名を設定します.
// 戻り値: UserInfoが返却されます.
const _getUser = async function(user) {
    if(!authUtil.useString(user)) {
        throw new Error("User has not been set.");
    }
    try {
        // ユーザー情報を取得.
        const ret = await userTable().get("user", user);
        if(ret != undefined && ret != null) {
            // 取得成功.
            return ret;
        }
    } catch(e) {
        // 例外.
        throw new Error("The user ("
            + user + ") does not exist.", e);
    }
	// 取得失敗の場合、空返却.
	return undefined;
}

// 指定名のユーザが既に存在するかチェック.
// user ユーザ名を設定します.
// trueの場合、指定ユーザは存在します.
const _isUser = async function(user) {
	try {
		return await _getUser(user) != undefined;
	} catch(e) {}
	return false;
}

// 生のパスワードをsha256変換.
// password パスワードを設定します.
// 戻り値: sha256変換された文字列が返却されます.
const _passwordSha256 = function(password) {
	return authUtil.sha256(password);
}

// 非ログイン登録でのoauthユーザ利用ユーザを取得.
// user 対象のユーザー名を設定します.
// 戻り値 UserInfoが返却されます.
//       oauthログインが認められてない場合、エラーとなります.
const _getOauthToNoUserRegister = function(user) {
	// oauthログイン利用での非ユーザ登録利用許可がONの場合.
	if(isOauthToNoUserRegister()) {
		const ret = {};
		ret[USER_NAME] = user;
		ret[USER_TYPE] = USER_TYPE_OAUTH; // oauthユーザ.
		ret[PERMISSION] = PERMISSION_USER; // ユーザ権限.
		ret[CREATE_DATE] = CREATE_DATE_BY_READONLY; // 読み込み専用.
		ret[UPDATE_DATE] = CREATE_DATE_BY_READONLY; // 読み込み専用.
		ret[UPDATE_PASSWORD_DATE] = UPDATE_PASSWORD_DATE_BY_NO_PASSWORD; // パスワードなし.
		return ret;
	}
	return undefined;
}

// 仮パスワードを生成処理.
// 戻り値: 仮パスワードが返却されます.
const _generateTentativePassword = function() {
    // 環境変数から仮パスワード長を取得.
    let len = process.env[ENV_TENTATIVE_PASSWORD_LENGTH]|0;
    if(len == 0) {
        // 存在しない場合はデフォルトパスワード長.
        len = DEF_TENTATIVE_PASSWORD_LENGTH;
    }
    // 仮パスワード返却.
    return xor128.random.getBytes(len).toString("base64").substring(0, len);
}

// ナノ時間を取得.
const _getNanoTime = function() {
	const ret = process.hrtime()
	return parseInt(((ret[0] * 10000000000) + ret[1]) / 1000);
}

// oauthログインに対してユーザ登録なしの場合、一般ユーザログイン利用可能かを取得.
// 戻り値: trueの場合、ユーザ登録なしでoauthログインが利用できます.
const isOauthToNoUserRegister = function() {
	let ret = process.env[ENV_OAUTH_NO_USER_REGISTER];
	// 環境変数でOFF設定されている場合.
	if(authUtil.useString(ret) &&
		((ret = ret.trim().toLowerCase()) == "false" ||
		ret == "off")) {
		// ユーザ登録なしでoauthログイン不許可.
		return false;
	}
	return true;
}

// 新しいユーザー情報を作成.
// このユーザは一旦一般ユーザとして登録されます.
// user 対象のユーザ名を設定します.
// type ログインユーザタイプを設定します.
//      "all": 全てのログインタイプを許可します.
//      "passsword": パスワードログインのみ許可します.
//      "oauth": oauthログインのみ許可します.
//      指定しない場合は "oauth" が設定されます.
// 戻り値: UserInfoが返却されます.
const create = async function(user, type) {
	//  必須条件が設定されていない場合エラー.
	if(!authUtil.useString(user)) {
		throw new Error("username not set.");
	}
	if(!authUtil.useString(type)) {
		// oauthユーザを設定.
		type = USER_TYPE_OAUTH;
	}
	// ユーザタイプが範囲外の場合はエラー.
	type = type.trim().toLowerCase();
	if(type != USER_TYPE_ALL && type != USER_TYPE_PASSWORD &&
		type != USER_TYPE_OAUTH) {
		throw new Error("Type content is unknown: " + type);
	}
	// ユーザ情報作成.
	let info = {};
	info[USER_NAME] = user;
	info[CREATE_DATE] = Date.now();
	info[UPDATE_DATE] = info[CREATE_DATE];
	info[USER_TYPE] = type;
	info[PERMISSION] = PERMISSION_USER;
	// 一般ユーザで登録.
	// ユーザタイプが all および password の場合.
	if(type == USER_TYPE_ALL || type == USER_TYPE_PASSWORD) {
		// 空パスワードを設定.
		info[PASSWORD] = _passwordSha256("");
		// 仮パスワード判別.
		info[UPDATE_PASSWORD_DATE] = UPDATE_PASSWORD_DATE_BY_TENTATIVE_PASSWORD;
		// mfa(2段階認証用)のコード(パスワード以上に表示隠蔽).
		// このコードを元になんちゃってMFAコードとして２段階認証で使う.
		info[PASSWORD_MFA_CODE] = _getNanoTime();
	} else {
		// パスワードなし.
		info[PASSWORD] = undefined;
		// パスワードなし.
		info[UPDATE_PASSWORD_DATE] = UPDATE_PASSWORD_DATE_BY_NO_PASSWORD;
	}
	// 返却用のUserInfo生成.
	info = UserInfo(info);
	// 既存ユーザが存在する場合はエラー返却.
	if(await _isUser(user)) {
		throw new Error(user + " users already exist.");
	}
	// userInfoを保存.
	await info.save();
	// userInfo返却.
	return info;
}

// 指定ユーザ情報を削除.
// user 対象のユーザ名を設定します.
// 戻り値: trueの場合、削除に成功しました.
const remove = async function(user) {
	let info = await _getUser(user);
	if(info == undefined) {
        throw new Error("The user ("
            + user + ") does not exist.");
	}
	return await userTable().remove("user", user);
}

// 指定ユーザー情報を取得.
// user 対象のユーザ名を設定します.
// 戻り値: UserInfoが返却されます.
//        ※ この情報にはパスワードが入ってるので、扱いを注意.
const get = async function(user) {
	let info = await _getUser(user);
	if(info == undefined) {
		// oauthログイン利用での非ユーザ登録利用許可がONの場合.
		// oauth向けの一般ユーザ権限が有効となる.
		info = _getOauthToNoUserRegister(user);
	}
	return UserInfo(info);
}

// 登録ユーザ情報のユーザ名一覧を取得.
// page ページ数を設定します.
//      呼び出しに毎回先頭から取得するので、ページ数が多いと「速度低下」に
//      繋がるので注意が必要です.
// max １ページの最大表示数を設定.
//     100件を超える設定はできません.
// marker 読み取り開始位置のマーカーを設定します.
//        これを設定する事で、page読み込みじゃなく、このmarkerからの
//        読み込みとなります.
// 戻り値: {page, max, marker, list}
//         page: 返却対象のページ番号が設定されます.
//         max: 1ページの最大表示数が設定されます.
//         nextMarker: 次のページに遷移するMarkerが設定されます.
//                     nullの場合、次のページは存在しません.
//         list: [user1, user2, ... ]が返却されます.
const list = async function(page, max, marker) {
	max = max|0;
    if(max <= 0) {
        max = AUM_LIST_LIMIT;
    } else if(max >= MAX_AUM_LIST_LIMIT) {
		max = MAX_AUM_LIST_LIMIT;
	}
    page = page|0;
    if(page <= 0) {
        page = 0;
    }
    // １ページの情報を取得.
    const result = await userTable()
		.list(page, max, marker);
	const list = result.list;
    const ret = [];
    const len = list.length;
	for(let i = 0; i < len; i ++) {
        // 対象Keyでない場合.
        if(list[i].key != "user") {
            // 無視.
            continue;
        }
        // ユーザ名をセット.
        ret[ret.length] = list[i].value;
	}
	return {
		page: page,
		max: max,
		marker: result.nextMarker,
		list: ret
	};
}

// 登録されている全てのUser一覧を取得.
// detail trueの場合、User毎の詳細情報を含めて表示とします.
//        false および指定なしの場合は、User名だけを表示します.
// 戻り値: [user1, user2, ... ] が返却されます. 
const listAll = async function(detail) {
    try {
        let i, len, marker, off = 0, max = 50;
        let ret = [];
        while(true) {
            const n = await list(off, max, marker);
            const lst = n.list;
            len = lst.length;
            for(i = 0; i < len; i ++) {
                ret[ret.length] = lst[i];
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
            len = ret.length;
            for(i = 0; i < len; i ++) {
                // Secret表示用として詳細を取得.
                n[n.length] = await get(ret[i]);
            }
            ret = n;
        }
        return ret;
    } catch(e) {
        throw new Error("Failed to get user list.", e);
    }
}

// 認証用User情報用オブジェクト.
// info  S3に管理されてるログインユーザ情報を設定します.
const UserInfo = function(info) {
	// userInfo が存在しない場合はエラー.
	_requiredUserInfo(info);
	
	// 読み込み専用UserInfoの場合.
	const readOnly = info[CREATE_DATE] == CREATE_DATE_BY_READONLY;
	
	// userInfoオブジェクト.
	const o = {};

	// 読み込み専用のUserInfoか取得.
	// 戻り値: trueの場合、読み込み専用です. 
	const isReadOnly = function() {
		return readOnly;
	}
	o.isReadOnly = isReadOnly;

	// readOnlyの場合エラー.
	const _checkReadOnly = function() {
		if(readOnly) {
			throw new Error("It is read-only and cannot be used.");
		}
	}
	
	// UserInfo情報をObject(dict)変換.
	// ※ ここで取得された内容には passwordが除外されます.
	// 戻り値: {} 形式の内容が返却されます.
	const get = function() {
		// コピーする.
		const ret = JSON.parse(JSON.stringify(info));
		// パスワードが存在する場合は、空にする.
		if(ret[PASSWORD] != undefined) {
			ret[PASSWORD] = "";
			delete ret[PASSWORD_MFA_CODE];
		}
		ret[CREATE_DATE] = CREATE_DATE_BY_READONLY; // 読み込み専用.
		ret[UPDATE_DATE] = CREATE_DATE_BY_READONLY; // 読み込み専用.
		return ret;
	}
	o.get = get;

	// UserInfo情報をJSON.stringifyで閲覧できる内容で変換.
	// ※ ここで取得された内容には passwordが除外されます.
	// 戻り値: {} 形式の内容が返却されます.
	const getView = function() {
		// コピーする.
		const ret = JSON.parse(JSON.stringify(info));
		// パスワードが存在する場合は伏せ文字にする.
		if(ret[PASSWORD] != undefined) {
			ret[PASSWORD] = "**********";
			delete ret[PASSWORD_MFA_CODE];
		}
		// パスワード更新日が無効な場合.
		if(ret[UPDATE_PASSWORD_DATE] <= UPDATE_PASSWORD_DATE_BY_NO_PASSWORD) {
			ret[UPDATE_PASSWORD_DATE] = undefined;
		// パスワード更新日が有効な場合.
		} else {
			ret[UPDATE_PASSWORD_DATE] = new Date(ret[UPDATE_PASSWORD_DATE]);
		}
		// ユーザ生成時間を日付に変換.
		ret[CREATE_DATE] = new Date(ret[CREATE_DATE]);
		ret[UPDATE_DATE] = new Date(ret[UPDATE_DATE]);
		// グループをリスト変換.
		ret[GROUP] = getGroups();
		return ret;
	}
	o.getView = getView;
	
	// JSON内容で取得.
	// ※ ここで取得された内容には passwordが除外されます.
	// 戻り値: JSON形式の内容が返却されます.
	const getJSON = function() {
		return JSON.stringify(get());
	}
	o.getJSON = getJSON;

	// ユーザ作成日を取得.
	// 戻り値: ユーザ作成日(Date)が返却されます.
	//        読み込み専用の場合は null返却されます.
	const getCreateDate = function() {
		if(info[CREATE_DATE] != CREATE_DATE_BY_READONLY) {
			return new Date(info[CREATE_DATE])
		}
		return null;
	}
	o.getCreateDate = getCreateDate;

	// ユーザ更新日を取得.
	// 戻り値: ユーザ更新日(Date)が返却されます.
	//        読み込み専用の場合は null返却されます.
	const getUpdateDate = function() {
		if(info[UPDATE_DATE] != CREATE_DATE_BY_READONLY) {
			return new Date(info[UPDATE_DATE])
		}
		return null;
	}
	o.getUpdateDate = getUpdateDate;
		
	// ユーザー名を取得.
	// 戻り値: ユーザ名が返却されます.
	const getUserName = function() {
		return info[USER_NAME];
	}
	o.getUserName = getUserName;
	
	// ユーザタイプを取得.
	// 戻り値: ユーザタイプが返却されます.
	//        "all": 全てを許可するユーザータイプ.
	//        "password": パスワード専用ユーザタイプ.
	//        "oauth": oauth専用ユーザタイプ.
	const getUserType = function() {
		const type = info[USER_TYPE];
		if(type == undefined) {
			return USER_TYPE_ALL;
		}
		return type;
	}
	o.getUserType = getUserType;
	
	// パスワード利用可能ユーザかチェック.
	// 戻り値: trueの場合はパスワード利用可能ユーザです.
	const isPasswordUser = function() {
		const ret = getUserType();
		return ret == USER_TYPE_PASSWORD || ret == USER_TYPE_ALL;
	}
	o.isPasswordUser = isPasswordUser;
	
	// oauth利用可能なユーザかチェック.
	// 戻り値: trueの場合はoauth利用可能ユーザです.
	const isOAuthUser = function() {
		const ret = getUserType();
		return ret == USER_TYPE_OAUTH || ret == USER_TYPE_ALL;		
	}
	o.isOAuthUser = isOAuthUser;

	// パスワード最終更新日を取得.
	// 戻り値: パスワード最終更新日(Date)が返却されます.
	//        非パスワードユーザの場合は null返却されます.
	const getUpdatePasswordDate = function() {
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			return null;
		}
		// 有効なパスワード更新日が設定されている.
		if(info[UPDATE_PASSWORD_DATE] > UPDATE_PASSWORD_DATE_BY_NO_PASSWORD) {
			return new Date(info[UPDATE_PASSWORD_DATE]); 
		}
		return null;
	}
	o.getUpdatePasswordDate = getUpdatePasswordDate;

	// 仮パスワード状態かチェック.
	// 戻り値: trueの場合、仮パスワードです.
	const isTentativePassword = function() {
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			return false;
		}
		return info[UPDATE_PASSWORD_DATE] ==
			UPDATE_PASSWORD_DATE_BY_TENTATIVE_PASSWORD;
	}
	o.isTentativePassword = isTentativePassword;
	
	// パスワード設定.
	// ※ isReadOnky() == true の場合、実行されません.
	// oldPassword 前のパスワードを設定します.
	//             仮パスワードの場合は空文字("")を指定します.
	// password パスワードを設定します.
	const setPassword = function(oldPassword, password) {
		_checkReadOnly();
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			throw new Error("Not a password available user.");
		}
		// 前のパスワード引数が設定なし.
		else if(!authUtil.useString(oldPassword)) {
			// ただし「仮パスワード」の場合はエラーとしない.
			if(!isTentativePassword()) {
				throw new Error("The oldPassword is not a string.");
			}
		}
		// パスワード引数が設定なし.
		else if(!authUtil.useString(password)) {
			throw new Error("The password is not a string.");
		}
		// 変更前のパスワードが一致しない場合はエラー.
		else if(_passwordSha256(oldPassword) != info[PASSWORD]) {
			// ただし「仮パスワード」の場合はエラーとしない.
			if(!isTentativePassword()) {
				throw new Error("Does not match current password.");
			}
		}
		// パスワードは直接持たずsha256化.
		info[PASSWORD] = _passwordSha256(password);
		// パスワード更新日を最新にする.
		info[UPDATE_PASSWORD_DATE] = Date.now();
		return o;
	}
	o.setPassword = setPassword;

	// 仮パスワードの変更.
	// ※ isReadOnky() == true の場合、実行されません.
	// password パスワードを設定します.
	const changeTentativePassword = function(password) {
		return setPassword("", password);
	}
	o.changeTentativePassword = changeTentativePassword;

	// パスワードをリセット.
	// リセットされた場合、仮パスワードモードになります.
	// ※ isReadOnky() == true の場合、実行されません.
	// 戻り値: 仮パスワードが返却されます.
	const resetPassword = function() {
		_checkReadOnly();
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			throw new Error("Not a password available user.");
		}
		const tentativePassword = _generateTentativePassword();
		// 仮パスワードセット.
		info[PASSWORD] = _passwordSha256(tentativePassword);
		// 仮パスワード判別.
		info[UPDATE_PASSWORD_DATE] = UPDATE_PASSWORD_DATE_BY_TENTATIVE_PASSWORD;
		// 仮パスワードを返却.
		return tentativePassword;
	}
	o.resetPassword = resetPassword;
	
	// パスワード一致確認.
	// ※ 読み込み専用の場合エラーとなります.
	// password 対象のパスワードを設定します.
	// 戻り値: trueの場合、パスワードが一致しています.
	const equalsPassword = function(password) {
		_checkReadOnly();
		if(!isPasswordUser() || !authUtil.useString(password)) {
			return false;
		}
		// パスワードはsha256でチェックのみで、取得はしない.
		return info[PASSWORD] == _passwordSha256(password);
	}
	o.equalsPassword = equalsPassword;
	
	// グループ一覧取得.
	// 戻り値: [group1, group2, ...] が返却されます.
	const getGroups = function() {
		const group = info[GROUP];
		if(group == undefined) {
			return [];
		}
		let cnt = 0;
		const ret = [];
		for(let k in group) {
			ret[cnt ++] = k;
		}
		return ret;
	}
	o.getGroups = getGroups;
	
	// グループ追加.
	// ※ 読み込み専用の場合エラーとなります.
	// name 追加対象グループ名を設定します.
	const addGroup = function(name) {
		_checkReadOnly();
		if(!authUtil.useString(name)) {
			throw new Error("The group name is not a string.");
		}
		name = name.trim();
		if(name.length == 0) {
			throw new Error("The group name does not have a string.");
		}
		let group = info[GROUP];
		if(group == undefined) {
			group = {};
			info[GROUP] = group;
		}
		group[name] = true;
		return o;
	}
	o.addGroup = addGroup;
	
	// グループ削除.
	// ※ 読み込み専用の場合エラーとなります.
	// name 削除対象のグループを設定します.
	// 戻り値: trueの場合、削除されました.
	const removeGroup = function(name) {
		_checkReadOnly();
		if(!authUtil.useString(name)) {
			return false;
		}
		name = name.trim();
		if(name.length == 0) {
			throw new Error("The group name does not have a string.");
		}
		const group = info[GROUP];
		if(group == undefined) {
			return false;
		}
		const ret = group[name];
		if(ret) {
			delete group[name];
			return true;
		}		
		return false;
	}
	o.removeGroup = removeGroup;
	
	// 指定グループが存在するかチェック.
	// name チェック対象のグループ名を設定します.
	// 戻り値: trueの場合、存在します.
	const isGroup = function(name) {
		if(!authUtil.useString(name)) {
			return false;
		}
		name = name.trim();
		if(name.length == 0) {
			return false;
		}
		const group = info[GROUP];
		if(group == undefined) {
			return false;
		}
		const ret = group[name];
		if(ret) {
			return true;
		}		
		return false;
	}
	o.isGroup = isGroup;

	// グループ数を取得.
	// 戻り値: 登録グループ数を設定します.
	const groupSize = function() {
		return info[GROUP] == undefined ?
			0 : info[GROUP].length;
	}
	o.groupSize = groupSize;
		
	// 権限を取得.
	// 戻り値: 設定されている権限が返却されます.
	//        "user": 一般ユーザ権限.
	//        "admin": 管理者ユーザ.
	const getPermission = function() {
		const permission = info[PERMISSION];
		if(permission == undefined) {
			return PERMISSION_USER;
		}
		return permission;
	}
	o.getPermission = getPermission;
	
	// admin権限か取得.
	// 戻り値: trueの場合、管理者権限を有します.
	const isAdminPermission = function() {
		const permission = getPermission();
		return permission == PERMISSION_ADMIN;
	}
	o.isAdminPermission = isAdminPermission;
	
	// admin権限をセット.
	// ※ isReadOnky() == true の場合、実行されません.
	const setAdminPermission = function() {
		_checkReadOnly();
		info[PERMISSION] = PERMISSION_ADMIN;
		return o;
	}
	o.setAdminPermission = setAdminPermission;
	
	// 一般ユーザ権限をセット.
	// ※ isReadOnky() == true の場合、実行されません.
	const setUserPermission = function() {
		_checkReadOnly();
		info[PERMISSION] = PERMISSION_USER;
		return o;
	}
	o.setUserPermission = setUserPermission;
	
	// オプション定義を取得.
	// key 取得オプションKey名を設定します.
	// 戻り値: オプショnvalueが返却されます.
	const getOption = function(key) {
		if(!authUtil.useString(key)) {
			throw new Error("Key must be set in a string.");
		}
		const options = info[OPTIONS];
		if(options == undefined) {
			return {};
		}
		const ret = options[key];
		if(ret == undefined) {
			return {};
		}
		return ret;
	}
	o.getOption = getOption;
	
	// オプション定義を設定.
	// ※ 読み込み専用の場合エラーとなります.
	// key オプションKey名を設定します.
	// value オプションValueを設定します.
	//       この値は文字列, 数字, Boolean型である必要があります.
	const setOption = function(key, value) {
		_checkReadOnly();
		if(!authUtil.useString(key)) {
			throw new Error("Key must be set in a string.");
		}
		if(value == undefined || value == null) {
			value = "";
		}
		const t = typeof(value);
		if(!(t == "string" || t == "number" || t == "boolean")) {
			// valueは文字列か数字以外は禁止.
			throw new Error("Value must be set by string or numbers.");
		}
		let options = info[OPTIONS];
		if(options == undefined) {
			options = {};
			info[OPTIONS] = options;
		}
		options[key] = value;
		return o;
	}
	o.setOption = setOption;
	
	// オプションキー名一覧を取得.
	// 戻り値: [key1, key2, ...] が返却されます.
	const getOptionKeys = function() {
		const options = info[OPTIONS];
		if(options == undefined) {
			return [];
		}
		const ret = [];
		for(let k in options) {
			ret[ret.length] = k;
		}
		return ret;
	}
	o.getOptionKeys = getOptionKeys;
	
	// 現在の内容を保存する.
	// ※ 読み込み専用の場合エラーとなります.
	const save = async function() {
		_checkReadOnly();
		info[UPDATE_DATE] = Date.now();
		await userTable().put("user", info[USER_NAME], info)
		return o;
	}
	o.save = save;
	
	// 再読み込み.
	// ※ 読み込み専用の場合エラーとなります.
	const reload = async function() {
		_checkReadOnly();
		info = await _getUser(info[USER_NAME]);
		if(info == undefined) {
			// oauthログイン利用での非ユーザ登録利用許可がONの場合.
			// oauth向けの一般ユーザ権限が有効となる.
			info = _getOauthToNoUserRegister(user);
		}
		_requiredUserInfo(info);
		return o;
	}
	o.reload = reload;
	
	// 文字列出力.
	// ※ password等が含まれている場合、それらも表示されるので注意してください.
	// 戻り値: JSON情報が返却されます.
	const toString = function() {
		return JSON.stringify(get(), null, "  ");
	}
	o.toString = toString;
	
	return o;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.USER_TYPE_ALL = USER_TYPE_ALL;
exports.USER_TYPE_PASSWORD = USER_TYPE_PASSWORD;
exports.USER_TYPE_OAUTH = USER_TYPE_OAUTH;
exports.isOauthToNoUserRegister = isOauthToNoUserRegister;
exports.create = create;
exports.remove = remove;
exports.get = get;
exports.list = list;
exports.listAll = listAll;
exports.UserInfo = UserInfo;

})();
