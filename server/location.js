const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

// 查询所有地址信息
const getLocationList = function (req, res) {
    dbServer.getLocationList(req, res); // 调用查询用户函数
}

// 查询地址信息
const getLocationDetail = function (req, res) {
    dbServer.getLocationDetail(req, res); // 调用查询用户函数
}

// 新增地址信息
const addLocation = function (req, res) {
    dbServer.addLocation(req, res); // 调用新增地址函数
}

// 更新地址信息
const updateLocation = function (req, res) {
    dbServer.updateLocation(req, res); // 调用更新地址函数
}

// 删除地址信息
const deleteLocation = function (req, res) {
    dbServer.deleteLocation(req, res); // 调用删除地址函数
}

module.exports = {
    getLocationList,
    getLocationDetail,
    addLocation,
    updateLocation,
    deleteLocation
}