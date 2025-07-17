const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

// 好友申请
const applyFriend = function (req, res) {
    console.log('好友申请请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.applyFriend(data, res); // 调用查询用户函数
}

// 更新好友状态
const updateFriendState = function (req, res) {
    console.log('好友状态更新请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.updateFriendState(data, res); // 调用查询用户函数
}

// 删除好友状态
const deleteFriend = function (req, res) {
    console.log('删除好友请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.deleteFriend(data, res); // 调用查询用户函数
}

module.exports = {
    applyFriend,
    updateFriendState,
    deleteFriend
}