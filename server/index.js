const dbserver = require('../dao/dbServer.js'); // 引入数据操作模块

const getFriend = function (req, res) {
    // console.log('好友请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    if (data.state == 0) {
        dbserver.getFriendsInMsg(data, res); // 调用查询用户函数
    } else {
        dbserver.getOnlyUsers(data, res); 
    }
}

// 获取群列表
const getGroup = function (req, res) {
    // console.log('群组请求接收:', req.body); // 打印请求体
    const { state } = req.body; // 解构获取请求体中的数据
    if (state == 0) {
        dbserver.getGroupInMsg(req.body, res); // 查询群用户信息
    } else {
        dbserver.getOnlyGroup(req.body, res); // 调用查询用户函数
    }
}

// 获取最后一条消息
const getLastMsg = function (req, res) {
    console.log('最后一条消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.getOneMsg(data, res); // 调用查询用户函数
}

// 获取未读消息
const unreadSelfMsg = function (req, res) {
    console.log('未读消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.unreadSelfMsg(data, res); // 调用查询用户函数
}

// 更新已读消息
const updateMsg = function (req, res) {
    console.log('已读消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.updateMsg(data, res); // 调用查询用户函数
}

// 新建群
const createGroup = function (req, res) {
    console.log('新建群请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.createGroup(data, res); // 调用查询用户函数
}

// 获取最后一条消息
const getLastGroupMsg = function (req, res) {
    console.log('最后一条群消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.getOneGroupMsg(data, res); // 调用查询用户函数
}

// 群消息标已读
const updateGroupMsg = function (req, res) {
    console.log('已读群消息请求接收:', req.body); // 打印请求体
    const data = req.body; // 解构获取请求体中的数据
    dbserver.updateGroupMsg(data, res); // 调用查询用户函数
}

module.exports = {
    getFriend,
    getGroup,
    getLastMsg,
    unreadSelfMsg,
    updateMsg,
    createGroup,
    getLastGroupMsg,
    updateGroupMsg
}