const dbmodel = require('../model/index.js'); // 引入数据模型
const User = dbmodel.model('User'); // 引入用户模型
const https = require('https');
const crypto = require('crypto');

// 微信小程序配置（建议通过环境变量配置）
const WECHAT_CONFIG = {
    appId: 'wxedd2e225d0fbca96',
    appSecret: 'e49d9270c119f7613fed75c64c46d056'
}

// 轻量封装 https GET 请求
function getJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('解析微信响应失败'));
                }
            });
        }).on('error', reject);
    });
}

async function getOpenIdByCode(code) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_CONFIG.appId}&secret=${WECHAT_CONFIG.appSecret}&js_code=${code}&grant_type=authorization_code`;
    const resp = await getJson(url);
    if (resp.errcode) {
        const err = new Error(resp.errmsg || '微信接口错误');
        err.code = resp.errcode;
        throw err;
    }
    return { openId: resp.openid, sessionKey: resp.session_key, unionId: resp.unionid };
}
// 解密手机号
function decryptPhoneNumber(sessionKey, encryptedData, iv) {
    console.log('sessionKey',sessionKey);
    console.log('encryptedData',encryptedData);
    console.log('iv',iv);
    const key = Buffer.from(sessionKey, 'base64');
    const encrypted = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
    decipher.setAutoPadding(true);
    let decoded = decipher.update(encrypted, 'base64', 'utf8');
    decoded += decipher.final('utf8');
    const data = JSON.parse(decoded);
    if (!data.phoneNumber) throw new Error('解密数据不包含手机号');
    return data.phoneNumber;
}
// 用户详情
exports.userDetail = function (uid, res) {
    let wherestr = {
        '_id': uid // 用户ID
    }
    let out = {
        'pwd': 0, // 不返回密码
    }
    User.findOne(wherestr, out)
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '查询成功！',
            data: result // 返回查询到的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 用户信息修改
exports.userUpdate = async function (data, res) {
    try {
        const { id, type, nickName, avatarUrl, code, encryptedData, signature, permissionStatus } = data;
        if (!id) {
            return res.send({ code: 400, msg: '缺少id参数' });
        }
        // 先查找用户
        const user = await User.findOne({ id });
        if (!user) {
            // 新建用户
            if (!nickName || !avatarUrl || !code || !encryptedData || !signature) {
                return res.send({ code: 400, msg: '缺少必要参数' });
            }
            const newUser = new User({
                id,
                nickName,
                avatarUrl,
                code,
                encryptedData,
                signature,
                permissionStatus,
                register: new Date(),
                updateTime: new Date()
            });
            const result = await newUser.save();
            return res.send({ code: 200, msg: '新建用户成功', data: result });
        }
        // 已有用户，更新
        let updateObj = { updateTime: new Date() };
        if (type === 'avatarUrl' && avatarUrl) {
            updateObj.avatarUrl = avatarUrl;
        } else if (type === 'nickName' && nickName) {
            updateObj.nickName = nickName;
        } else {
            return res.send({ code: 400, msg: 'type或参数错误' });
        }
        const result = await User.findOneAndUpdate({ id }, updateObj, { new: true });
        return res.send({ code: 200, msg: '更新成功', data: result });
    } catch (err) {
        console.log(err);
        return res.send({ code: 500, msg: '服务器错误', error: err.message });
    }
} 

// 登录或更新（通过 code 获取 openid，实现幂等登录）
exports.loginOrUpdate = async function (data, res) {
    try {
        const { code, nickName, avatarUrl, encryptedData, signature } = data || {};
        if (!code) {
            return res.send({ code: 400, msg: '缺少code参数' });
        }

        // 1) 通过 code 换取 openid
        let openIdInfo;
        try {
            openIdInfo = await getOpenIdByCode(code);
        } catch (err) {
            return res.send({ code: 500, msg: '获取openid失败', error: err.message });
        }
        const id = openIdInfo.openId;
        if (!id) {
            return res.send({ code: 500, msg: '未获取到openid' });
        }

        // 2) 查找是否已有用户
        let user = await User.findOne({ id });
        if (!user) {
            console.log('创建新用户');
            // 创建新用户（满足当前模型必填字段）
            const createPayload = {
                id,
                nickName: nickName || '微信用户',
                avatarUrl: avatarUrl || '',
                code,
                encryptedData: encryptedData || 'encrypted',
                signature: signature || 'signature',
                permissionStatus: 1,
                register: new Date(),
                updateTime: new Date()
            };
            user = await new User(createPayload).save();
        } else {
            console.log('已有用户');
            // 获取已有用户信息
            user = await User.findOne({ id });
        }

        // 3) 组织前端需要的数据结构
        const respUser = {
            id: user.id,
            nickName: user.nickName,
            avatarUrl: user.avatarUrl,
            permissionStatus: user.permissionStatus || 1
        };

        return res.send({ code: 200, msg: '登录成功', data: respUser });
    } catch (err) {
        console.log(err);
        return res.send({ code: 500, msg: '服务器错误', error: err.message });
    }
}

// 获取并绑定手机号
exports.getPhoneNumber = async function (req, res) {
    try {
        const { code, userId, encryptedData, iv } = req.body || {};
        if (!code || !userId) {
            return res.send({ code: 400, msg: '缺少必要参数' });
        }

        // 通过code获取session_key
        let sessionInfo;
        try {
            sessionInfo = await getOpenIdByCode(code);
        } catch (error) {
            return res.send({ code: 500, msg: '获取微信会话失败', error: error.message });
        }
        console.log('sessionInfo',sessionInfo);

        let phoneNumber = null;
        if (encryptedData && iv) {
            try {
                phoneNumber = decryptPhoneNumber(sessionInfo.sessionKey, encryptedData, iv);
            } catch (e) {
                return res.send({ code: 400, msg: '手机号解密失败', error: e.message });
            }
        }

        // 更新用户表（按 openid 作为 id 存储）
        const user = await User.findOne({ id: userId });
        if (!user) {
            return res.send({ code: 404, msg: '用户不存在' });
        }

        const updateDoc = { updateTime: new Date() };
        console.log('获取手机号码',phoneNumber);
        if (phoneNumber) updateDoc.phone = phoneNumber;

        const updated = await User.findOneAndUpdate({ id: userId }, updateDoc, { new: true });

        return res.send({
            code: 200,
            msg: '绑定成功',
            data: {
                id: updated.id,
                nickName: updated.nickName,
                avatarUrl: updated.avatarUrl,
                phone: updated.phone || phoneNumber || '',
                permissionStatus: updated.permissionStatus || 1
            }
        });
    } catch (err) {
        console.log(err);
        return res.send({ code: 500, msg: '服务器错误', error: err.message });
    }
}

// 新增：权限管理 - 获取用户列表（GET /user/list）
exports.getUserList = async function (req, res) {
    try {
        const list = await User.find({}, { _id: 0, __v: 0 }).lean();
        const data = (list || []).map(u => ({
            id: u.id || '',
            name: u.nickName || '',
            phone: u.phone || '',
            avatar: u.avatarUrl || '',
            role: 'user',
            status: 'active',
            permissionStatus: u.permissionStatus || 1,
            permissions: { groupChat: true, settings: true, admin: false }
        }));
        return res.send({ code: 200, msg: 'ok', data });
    } catch (err) {
        console.log('获取用户列表失败:', err);
        return res.send({ code: 500, msg: '查询失败', error: err.message });
    }
}

// 根据ID获取用户详情
exports.getUserById = async function (req, res) {
    try {
        // 同时支持 GET 和 POST 请求
        const { id } = req.method === 'GET' ? req.query : req.body;
        
        if (!id) {
            return res.send({ code: 400, msg: '缺少id参数' });
        }

        const user = await User.findOne({ id }, { _id: 0, __v: 0 }).lean();
        
        if (!user) {
            return res.send({ code: 404, msg: '用户不存在' });
        }

        // 返回用户信息（不包含敏感字段）
        const userInfo = {
            id: user.id,
            nickName: user.nickName,
            avatarUrl: user.avatarUrl,
            phone: user.phone || '',
            permissionStatus: user.permissionStatus || 1,
            register: user.register,
            updateTime: user.updateTime
        };

        return res.send({ 
            code: 200, 
            msg: '查询成功', 
            data: userInfo 
        });
    } catch (err) {
        console.log('根据ID获取用户详情失败:', err);
        return res.send({ code: 500, msg: '查询失败', error: err.message });
    }
}