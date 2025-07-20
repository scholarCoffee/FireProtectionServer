const dbserver = require('../dao/dbServer.js'); // 引入数据操作模块

// 获取群列表
const getGroupList = function (req, res) {
    console.log('群列表请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.getGroupList(data, res); // 调用查询用户函数
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
    updateGroupMsg
}