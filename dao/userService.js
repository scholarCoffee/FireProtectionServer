const dbmodel = require('../model/index.js'); // 引入数据模型
const User = dbmodel.model('User'); // 引入用户模型
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

function update(uId, toData, res) {
    console.log('更新数据uId:', uId)
    console.log('更新目标数据：', toData)
    User.findByIdAndUpdate(uId, toData, { new: true }) // 更新用户信息
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
        res.send({
            code: 200,
            msg: '更新成功！',
            data: result // 返回更新后的用户数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('更新失败！'); // 返回失败信息给前端
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