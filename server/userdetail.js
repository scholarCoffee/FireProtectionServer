const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

// 用户详情
const userDetail = function (req, res) {
    console.log('用户详情请求接收:', req.body); // 打印请求体
    const { id } = req.body; // 解构获取请求体中的数据
    dbServer.userDetail(id, res); // 调用查询用户函数
}

// 用户信息修改
const userUpdate = function (req, res) {
    // console.log('用户信息修改请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.userUpdate(data, res); // 调用查询用户函数
}

// 修改好友昵称
const updateMarkName = function (req, res) {
    // console.log('好友昵称修改请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.updateMarkName(data, res); // 调用查询用户函数
}

// 好友昵称获取
const getMarkName = function (req, res) {
    // console.log('好友昵称获取请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.getMarkName(data, res); // 调用查询用户函数
}

module.exports = {
    userDetail,
    userUpdate,
    updateMarkName,
    getMarkName
}