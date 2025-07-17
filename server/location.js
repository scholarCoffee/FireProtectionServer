const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

// 查询所有地址信息
const getLocationList = function (req, res) {
    console.log('地址信息请求接收:', req); // 打印请求体
    dbServer.getLocationList(req, res); // 调用查询用户函数
}

// 查询地址信息
const getLocationDetail = function (req, res) {
    console.log('选择地址信息请求接收:', req); // 打印请求体
    dbServer.getLocationDetail(req, res); // 调用查询用户函数
}

module.exports = {
    getLocationList,
    getLocationDetail
}