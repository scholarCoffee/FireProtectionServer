const dbmodel = require('../model/index.js');
const WhitelistUser = dbmodel.WhitelistUser;
const crypto = require('crypto');
const https = require('https');

// 微信小程序配置
const WECHAT_CONFIG = {
    appId: process.env.WECHAT_APP_ID || 'your_app_id', // 小程序AppID
    appSecret: process.env.WECHAT_APP_SECRET || 'your_app_secret' // 小程序AppSecret
};

// 使用内置http模块发起请求
const makeRequest = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error('解析响应数据失败'));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
};

// 获取微信会话密钥
const getSessionKey = async (code) => {
    try {
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_CONFIG.appId}&secret=${WECHAT_CONFIG.appSecret}&js_code=${code}&grant_type=authorization_code`;
        
        const data = await makeRequest(url);
        
        if (data.errcode) {
            throw new Error(`微信API错误: ${data.errmsg}`);
        }
        
        return {
            sessionKey: data.session_key,
            openId: data.openid,
            unionId: data.unionid
        };
    } catch (error) {
        console.error('获取微信会话密钥失败:', error);
        throw error;
    }
};

// 解密手机号
const decryptPhoneNumber = (sessionKey, encryptedData, iv) => {
    try {
        // 使用AES-128-CBC解密
        const key = Buffer.from(sessionKey, 'base64');
        const encrypted = Buffer.from(encryptedData, 'base64');
        const ivBuffer = Buffer.from(iv, 'base64');
        
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, ivBuffer);
        decipher.setAutoPadding(true);
        
        let decrypted = decipher.update(encrypted, 'binary', 'utf8');
        decrypted += decipher.final('utf8');
        
        const phoneData = JSON.parse(decrypted);
        
        // 验证数据完整性
        if (!phoneData.phoneNumber) {
            throw new Error('解密后的数据格式不正确');
        }
        
        return phoneData.phoneNumber;
    } catch (error) {
        console.error('解密手机号失败:', error);
        throw new Error('手机号解密失败');
    }
};

// 获取手机号（主要接口）
exports.getPhoneNumber = async (req, res) => {
    /**
     * code: 0b1jey1003KmIU12F7100eLJ8p0jey1b
     * iv: 0b1jey1003KmIU12F7100eLJ8p0jey1b
     * encryptedData: 0b1jey1003KmIU12F7100eLJ8p0jey1b
     */
    try {
        const { code, userId, encryptedData, iv } = req.body;
        
        if (!code || !userId) {
            return res.send({
                code: 400,
                msg: '缺少必要参数'
            });
        }
        
        // 获取微信会话密钥
        const { sessionKey, openId } = await getSessionKey(code);
        
        // 查找或创建白名单用户
        let user = await WhitelistUser.findOne({ userId });
        
        if (!user) {
            return res.send({
                code: 404,
                msg: '用户不存在，请先注册'
            });
        }
        
        // 如果有加密数据，进行解密
        let phoneNumber = null;
        if (encryptedData && iv) {
            try {
                phoneNumber = decryptPhoneNumber(sessionKey, encryptedData, iv);
            } catch (error) {
                return res.send({
                    code: 400,
                    msg: '手机号解密失败',
                    error: error.message
                });
            }
        }
        
        // 更新用户信息
        const updateData = {
            code,
            sessionKey,
            lastLoginTime: new Date()
        };
        
        if (phoneNumber) {
            updateData.phoneNumber = phoneNumber;
            updateData.encryptedData = encryptedData;
            updateData.iv = iv;
        }
        
        await WhitelistUser.findOneAndUpdate(
            { userId },
            updateData,
            { new: true }
        );
        
        res.send({
            code: 200,
            msg: '获取成功',
            data: {
                phoneNumber,
                openId,
                sessionKey: sessionKey.substring(0, 10) + '...' // 部分隐藏
            }
        });
    } catch (error) {
        console.error('获取手机号失败:', error);
        res.send({
            code: 500,
            msg: '获取失败',
            error: error.message
        });
    }
};

// 创建白名单用户
exports.createWhitelistUser = async (req, res) => {
    try {
        const { userId, nickName, avatarUrl, code } = req.body;
        
        if (!userId || !nickName) {
            return res.send({
                code: 400,
                msg: '缺少必要参数'
            });
        }
        
        // 检查用户是否已存在
        const existingUser = await WhitelistUser.findOne({ userId });
        if (existingUser) {
            return res.send({
                code: 400,
                msg: '用户已存在'
            });
        }
        
        // 创建新用户
        const newUser = new WhitelistUser({
            userId,
            nickName,
            avatarUrl,
            code,
            createTime: new Date(),
            updateTime: new Date()
        });
        
        const result = await newUser.save();
        
        res.send({
            code: 200,
            msg: '创建成功',
            data: result
        });
    } catch (error) {
        console.error('创建白名单用户失败:', error);
        res.send({
            code: 500,
            msg: '创建失败',
            error: error.message
        });
    }
};

// 更新用户信息
exports.updateUserInfo = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateData = req.body;
        
        // 移除不允许更新的字段
        delete updateData.userId;
        delete updateData.createTime;
        
        updateData.updateTime = new Date();
        
        const result = await WhitelistUser.findOneAndUpdate(
            { userId },
            updateData,
            { new: true }
        );
        
        if (!result) {
            return res.send({
                code: 404,
                msg: '用户不存在'
            });
        }
        
        res.send({
            code: 200,
            msg: '更新成功',
            data: result
        });
    } catch (error) {
        console.error('更新用户信息失败:', error);
        res.send({
            code: 500,
            msg: '更新失败',
            error: error.message
        });
    }
};

// 获取用户列表
exports.getUserList = async (req, res) => {
    try {
        const { page = 1, pageSize = 10, keyword = '', permission = '' } = req.query;
        
        // 构建查询条件
        let query = {};
        
        if (keyword) {
            query.$or = [
                { userId: { $regex: keyword, $options: 'i' } },
                { nickName: { $regex: keyword, $options: 'i' } },
                { phoneNumber: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        if (permission) {
            query.permission = parseInt(permission);
        }
        
        // 计算分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);
        
        // 执行查询
        const [list, total] = await Promise.all([
            WhitelistUser.find(query)
                .sort({ createTime: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            WhitelistUser.countDocuments(query)
        ]);
        
        // 计算分页信息
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                list,
                pagination: {
                    current: parseInt(page),
                    pageSize: limit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.send({
            code: 500,
            msg: '查询失败',
            error: error.message
        });
    }
};

// 获取用户详情
exports.getUserDetail = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await WhitelistUser.findOne({ userId }).lean();
        
        if (!user) {
            return res.send({
                code: 404,
                msg: '用户不存在'
            });
        }
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: user
        });
    } catch (error) {
        console.error('获取用户详情失败:', error);
        res.send({
            code: 500,
            msg: '查询失败',
            error: error.message
        });
    }
};

// 删除用户
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const result = await WhitelistUser.findOneAndDelete({ userId });
        
        if (!result) {
            return res.send({
                code: 404,
                msg: '用户不存在'
            });
        }
        
        res.send({
            code: 200,
            msg: '删除成功'
        });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.send({
            code: 500,
            msg: '删除失败',
            error: error.message
        });
    }
};

// 获取用户统计信息
exports.getUserStats = async (req, res) => {
    try {
        const [totalCount, permissionStats, statusStats] = await Promise.all([
            WhitelistUser.countDocuments(),
            WhitelistUser.aggregate([
                { $group: { _id: '$permission', count: { $sum: 1 } } }
            ]),
            WhitelistUser.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                totalCount,
                permissionStats,
                statusStats
            }
        });
    } catch (error) {
        console.error('获取用户统计失败:', error);
        res.send({
            code: 500,
            msg: '查询失败',
            error: error.message
        });
    }
}; 