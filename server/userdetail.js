const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

// 用户信息修改
const userUpdate = function (req, res) {
    // console.log('用户信息修改请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.userUpdate(data, res); // 调用查询用户函数
}

module.exports = {
    userUpdate
}