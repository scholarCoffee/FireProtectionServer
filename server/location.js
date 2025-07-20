const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

// 查询所有地址信息
const getLocationList = function (req, res) {
    dbServer.getLocationList(req, res); // 调用查询用户函数
}

// 查询地址信息
const getLocationDetail = function (req, res) {
    dbServer.getLocationDetail(req, res); // 调用查询用户函数
}

module.exports = {
    getLocationList,
    getLocationDetail
}