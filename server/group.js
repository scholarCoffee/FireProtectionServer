const dbserver = require('../dao/dbserver.js'); // 引入数据操作模块

// 获取群列表
const getGroupList = function (req, res) {
    console.log('群列表请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.getGroupList(data, res); // 调用查询用户函数
}

// 新增：群成员列表（按合同 /chat/members）
const getMembers = function (req, res) {
    // 由于现有 dao 未提供成员接口，这里基于 GroupUser 直接查询
    const dbmodel = require('../model/index.js');
    const GroupUser = dbmodel.model('GroupUser');
    const User = dbmodel.model('User');
    const { groupId } = req.query;
    if (!groupId) {
        return res.send({ code: 400, msg: '缺少groupId', data: [] });
    }
    GroupUser.find({ groupId })
        .populate('userId')
        .sort({ time: -1 })
        .exec()
        .then(list => {
            const data = list.map(item => ({
                userId: item.userId._id,
                nickName: item.userId.nickName,
                avatarUrl: item.userId.avatarUrl,
                role: 3
            }));
            res.send({ code: 200, msg: 'ok', data });
        })
        .catch(err => {
            console.error('获取群成员失败:', err);
            res.send({ code: 500, msg: '查询失败', error: err.message });
        });
}

// 获取最后一条消息
const getLastGroupMsg = function (req, res) {
    console.log('最后一条群消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.getLastGroupMsg(data, res); // 调用查询用户函数
}

// 群消息标已读
const updateGroupMsg = function (req, res) {
    console.log('已读群消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.updateGroupMsg(data, res); // 调用查询用户函数
}

module.exports = {
    getGroupList,
    getLastGroupMsg,
    updateGroupMsg,
    getMembers
}