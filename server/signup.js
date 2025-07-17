const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

const signUp = function (req, res) {
    console.log('注册请求接收:', req.body); // 打印请求体
    const { name, mail, pwd } = req.body; // 解构获取请求体中的数据
    dbServer.buildUser(name, mail, pwd, res); // 调用插入用户信息函数
}

// 用户或邮箱是否被占用
const judgeValue = function (req, res) {
    const { data, type } = req.body; // 解构获取请求体中的数据
    dbServer.countUserValue(data, type, res); // 调用判断用户或邮箱是否被占用函数
}

// 密码修改
const updatePwd = function (req, res) {
    console.log('密码修改请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbServer.updateUserPwd(data, res); // 调用修改用户密码函数
}

module.exports = {
    signUp,
    judgeValue,
    updatePwd
}