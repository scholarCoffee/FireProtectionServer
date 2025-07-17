const dbserver = require('../dao/dbServer.js'); // 引入数据操作模块

// 新建群
const createGroup = function (req, res) {
    console.log('新建群请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbserver.createGroup(data, res); // 调用查询用户函数
}

// 获取群详情
const getGroupDetail = function (req, res) {
    console.log('群详情请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbserver.getGroupDetail(data, res); // 调用查询用户函数
}

// 新增群成员
const addGroupUser = function (req, res) {
    console.log('新增群成员请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbserver.addGroupUser(data, res); // 调用查询用户函数
}

// 删除群成员或者删群
const deleteGroup = function (req, res) {
    console.log('删除群成员请求接收:', req.body); // 打印请求体
    const { type } = req.body; // 获取请求体
    if (['exit', 'remove'].includes(type)) {
        console.log('删除群成员请求接收:', req.body); // 打印请求体
        dbserver.deleteGroupUser(req.body, res); // 调用查询用户函数
    } else if (type === 'delete') {
        console.log('删除群请求接收:', req.body); // 打印请求体
        dbserver.deleteGroup(req.body, res); // 调用查询用户函数
    }
}

// 更新群信息
const updateGroup = function (req, res) {
    console.log('更新群信息请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbserver.updateGroup(data, res); // 调用查询用户函数
    }

module.exports = {
    createGroup,
    getGroupDetail,
    addGroupUser,
    deleteGroup,
    updateGroup
}