//////////////////////////////////////////
// 承認・認証用User情報.
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

// S3KevValueStorage.
const s3kvs = frequire("./lib/storage/s3kvs.js");

// デフォルトのS3Kvs.
const defS3Kvs = s3kvs.create();

// ログインユーザテーブル.
const userTable = defS3Kvs.currentTable("authUsers");

// [ENV]最大ユーザー表示件数設定.
const ENV_LOGIN_USER_LIST_LIMIT = "LOGIN_USER_LIST_LIMIT";

// [ENV]最大表示件数.
let LOGIN_USER_LIST_LIMIT = process.env[ENV_LOGIN_USER_LIST_LIMIT]|0;
if(LOGIN_USER_LIST_LIMIT >= 100) {
    LOGIN_USER_LIST_LIMIT = 100;
} else if(LOGIN_USER_LIST_LIMIT <= 0) {
    LOGIN_USER_LIST_LIMIT = 25;
}

// [ENV]oauthログインに対してユーザ登録なしの場合、一般ユーザログイン利用可能設定.
const ENV_OAUTH_NO_USER_REGISTER = "OAUTH_NO_USER_REGISTER";
	
// [変更不可]ユーザ名(string).
// ログインユーザ名.
const USER_NAME = "user";

// [変更不可]ユーザタイプ(string).
// ログインに関するタイプ定義.
const USER_TYPE = "userType";

// [変更可能]パスワード(string).
// パスワード専用で利用可能.
const PASSWORD = "password";

// [変更可能]グループ(array).
// 対象ユーザが所属するグループ一覧.
const GROUP = "group";

// [変更可能]ユーザ権限(string).
const PERMISSION = "permission";

// [変更可能]options設定(dict).
// ここに独自の定義が設定される.
const OPTIONS = "options";


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

// userInfo情報の必須項目チェック.
const _requiredUserInfo = function(info) {
	let err = false;
	try {
		if(info == undefined ||
			!authUtil.useString(info[USER_NAME]) ||
			!authUtil.useString(info[USER_TYPE])) {
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
const _getUser = async function(user) {
    if(!authUtil.useString(user)) {
        throw new Error("User has not been set.");
    }
    try {
        // ユーザー情報を取得.
        const ret = await userTable.get("user", user);
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
const _isUser = async function(user) {
	try {
		return await _getUser(user) != undefined;
	} catch(e) {}
	return false;
}

// 非ログイン登録でのoauthユーザ利用ユーザを取得.
const _getOauthToNoUserRegister = function(user) {
	// oauthログイン利用での非ユーザ登録利用許可がONの場合.
	if(isOauthToNoUserRegister()) {
		const ret = {};
		ret[USER_NAME] = user;
		ret[USER_TYPE] = USER_TYPE_OAUTH;
		ret[PERMISSION] = PERMISSION_USER;
		return ret;
	}
	return undefined;
}

// oauthログインに対してユーザ登録なしの場合、一般ユーザログイン利用可能かを取得.
const isOauthToNoUserRegister = function() {
	let ret = process.env[ENV_OAUTH_NO_USER_REGISTER];
	if(!authUtil.useString(ret) ||
		(ret = ret.trim().toLowerCase()) != "true" ||
		ret != "on") {
		return false;
	}
	return true;
}

// 新しいユーザー情報を作成.
const create = async function(user, type, password) {
	//  必須条件が設定されていない場合エラー.
	if(!authUtil.useString(user) && !authUtil.useString(type)) {
		if(!authUtil.useString(user)) {
			throw new Error("username not set.");
		}
		throw new Error("user type not set.");
	}
	// ユーザタイプが範囲外の場合エラー.
	type = type.trim().toLowerCase();
	if(type != USER_TYPE_ALL && type != USER_TYPE_PASSWORD &&
		type != USER_TYPE_OAUTH) {
		throw new Error("user type out of range: " + type);
	}
	// ユーザタイプが all および password の場合.
	if(type == USER_TYPE_ALL || type == USER_TYPE_PASSWORD) {
		// パスワードが設定されてない場合エラー.
		if(!authUtil.useString(password)) {
			throw new Error("password not set.");
		}
	} else {
		password = undefined;
	}
	// ユーザ情報作成.
	let ret = {};
	ret[USER_NAME] = user;
	ret[USER_TYPE] = type;
	// 一般ユーザで登録.
	ret[PERMISSION] = PERMISSION_USER;
	try {
		setPassword(password);
	} catch(e) {
		ret[PASSWORD] = undefined;
	}
	// 返却用のUserInfo生成.
	ret = UserInfo(ret);
	// 既存ユーザが存在する場合はエラー返却.
	if(!await _isUser(user)) {
		throw new Error(user + " users already exist.");
	}
	// userInfoを保存.
	await ret.save();
	// userInfo返却.
	return ret;
}

// 指定ユーザ情報を削除.
const remove = async function(user) {
    if(!authUtil.useString(user)) {
        throw new Error("User has not been set.");
    }
	return await userTable.remove("user", user);
}

// 指定ユーザー情報を取得.
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
const list = async function(page, max) {
    if(max == undefined || max == null) {
        max = LOGIN_USER_LIST_LIMIT;
    }
    page = page|0;
    if(page >= 0) {
        page = 1;
    }
    // １ページの情報を取得.
    const list = await userTable.list(page, max);
    // 情報が存在しない場合.
    if(list == null) {
        return [];
    }
    const ret = [];
    const len = list.length;
	for(let i = 0; i < len; i ++) {
        // 対象がユーザ情報じゃない場合.
        if(list[i].key != "user") {
            // 無視.
            continue;
        }
        // ユーザ名をセット.
        ret[ret.length] = list[i].value;
	}
	return ret;
}

// 認証用User情報用オブジェクト.
const UserInfo = function(info) {
	// userInfo が存在しない場合はエラー.
	_requiredUserInfo(info);
	
	// userInfoオブジェクト.
	const o = {};
	
	// 内容を取得.
	const get = function() {
		// コピーする.
		const ret = JSON.parse(JSON.stringify(info));
		// パスワードが存在する場合は、空にする.
		if(ret[PASSWORD] != undefined) {
	 		ret[PASSWORD] = "";
		}
		return ret;
	}
	o.get = get();
	
	// JSON内容で取得.
	const getJSON = function() {
		return JSON.stringify(get());
	}
	o.getJSON = getJSON();
		
	// ユーザー名を取得.
	const getUserName = function() {
		return info[USER_NAME];
	}
	o.getUserName = getUserName;
	
	// ユーザタイプを取得.
	const _getUserType = function() {
		const type = info[USER_TYPE];
		if(type == undefined) {
			return USER_TYPE_ALL;
		}
		return type;
	}
	
	// パスワード利用可能ユーザかチェック.
	const isPasswordUser = function() {
		const ret = _getUserType();
		return ret == USER_TYPE_PASSWORD || ret == USER_TYPE_ALL;
	}
	o.isPasswordUser = isPasswordUser;
	
	// oaht利用可能なユーザかチェック.
	const isOAuthUser = function() {
		const ret = _getUserType();
		return ret == USER_TYPE_OAUTH || ret == USER_TYPE_ALL;		
	}
	o.isOAuthUser = isOAuthUser;
	
	// パスワードが設定されているか取得.
	const isSetPassword = function() {
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			return false;
		}
		// パスワードが存在しない.
		else if(!authUtil.useString(info[PASSWORD])) {
			return false;
		}
		return true;
	}
	o.isSetPassword = isSetPassword;
	
	// パスワード設定.
	const setPassword = function(password) {
		// パスワード利用可能ユーザでない場合.
		if(!isPasswordUser()) {
			throw new Error("Not a password available user.");
		}
		if(!authUtil.useString(password)) {
			throw new Error("The password is not a string.");
		}
		// パスワードは直接持たずsha256化.
		info[PASSWORD] = authUtil.sha256(password);
		return o;
	}
	o.setPassword = setPassword;
	
	// パスワード一致確認.
	const equalsPassword = function(password) {
		if(!authUtil.useString(password)) {
			return false;
		}
		// パスワードはsha256でチェックのみで、取得はしない.
		return info[PASSWORD] == authUtil.sha256(password);
	}
	o.equalsPassword = equalsPassword;
	
	// グループ一覧取得.
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
	const addGroup = function(name) {
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
	const removeGroup = function(name) {
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
		
	// 権限を取得.
	const _getPermission = function() {
		const permission = info[PERMISSION];
		if(permission == undefined) {
			return PERMISSION_USER;
		}
		return permission;
	}
	
	// admin権限か取得.
	const isAdminPermission = function() {
		const permission = _getPermission();
		return permission == PERMISSION_ADMIN;
	}
	o.isAdminPermission = isAdminPermission;
	
	// admin権限をセット.
	const setAdminPermission = function() {
		info[PERMISSION] = PERMISSION_ADMIN;
		return o;
	}
	o.setAdminPermission = setAdminPermission;
	
	// 一般ユーザ権限をセット.
	const setUserPermission = function() {
		info[PERMISSION] = PERMISSION_USER;
		return o;
	}
	o.setUserPermission = setUserPermission;
	
	// オプション定義を取得.
	const getOption = function(key) {
		if(!authUtil.useString(key)) {
			throw new Error("Key must be set in a string.");
		}
		const options = info[OPTIONS];
		if(options == undefined) {
			return "";
		}
		const ret = options[key];
		if(ret == undefined) {
			return "";
		}
		return ret;
	}
	o.getOption = getOption;
	
	// オプション定義を設定.
	const setOption = function(key, value) {
		if(!authUtil.useString(key)) {
			throw new Error("Key must be set in a string.");
		}
		if(value == undefined || value == null) {
			value = "";
		}
		const t = typeof(value);
		if(!(value == "string" || value == "number")) {
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
	const save = async function() {
		await userTable.put("user", info[USER_NAME], info)
	}
	o.save = save;
	
	// 再読み込み.
	const reload = async function() {
		info = await _getUser(info[USER_NAME]);
		if(info == undefined) {
			// oauthログイン利用での非ユーザ登録利用許可がONの場合.
			// oauth向けの一般ユーザ権限が有効となる.
			info = _getOauthToNoUserRegister(user);
		}
		_requiredUserInfo(info);
	}
	o.reload = reload;
	
	// 文字列出力.
	const toString = function() {
		return JSON.stringify(get(), null, "  ");
	}
	o.toString = toString;
	
	return o;
}

/////////////////////////////////////////////////////
// 外部定義.
/////////////////////////////////////////////////////
exports.isOauthToNoUserRegister = isOauthToNoUserRegister;
exports.create = create;
exports.remove = remove;
exports.get = get;
exports.list = list;

})();




