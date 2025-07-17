const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

const signIn = function (req, res) {
    console.log('登录请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbServer.userMatch(data, res); // 调用查询用户函数
}

module.exports = {
    signIn
}