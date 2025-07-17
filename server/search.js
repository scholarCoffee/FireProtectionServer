const dbServer = require('../dao/dbServer.js'); // 引入数据操作模块

// 用户搜索
const searchUser = function (req, res) {
    console.log('搜索请求接收:', req.body); // 打印请求体
    dbServer.searchUser(req.body, res); // 调用查询用户函数
}

// 判断是否为好友
const isFriend = function (req, res) {
    console.log('好友判断请求接收:', req.body); // 打印请求体
    const { uid, fid } = req.body; // 解构获取请求体中的数据
    dbServer.isFriend(uid, fid, res); // 调用查询好友函数
}

// 用户群
const searchGroup = function (req, res) {
    console.log('用户群请求接收:', req.body); // 打印请求体
    const { name } = req.body; // 解构获取请求体中的数据
    dbServer.searchGroup(name, res); // 调用查询用户群函数
}

// 判断是否在群里面
const isInGroup = function (req, res) {
    console.log('群判断请求接收:', req.body); // 打印请求体
    const { uid, gid } = req.body; // 解构获取请求体中的数据
    dbServer.isInGroup(uid, gid, res); // 调用查询群函数
}


// 判断是否是好友，如果是好友则判断是否在群里面
const isInGroupByFriend = function (req, res) {
    console.log('好友群判断请求接收:', req.body); // 打印请求体
    const { uid, fid, gid } = req.body; // 解构获取请求体中的数据
    dbServer.isInGroupByFriend(uid, fid, gid, res); // 调用查询群函数
}

module.exports = {
    searchUser,
    isFriend,
    searchGroup,
    isInGroup,
    isInGroupByFriend
}