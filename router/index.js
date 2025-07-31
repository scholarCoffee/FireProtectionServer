const user = require('../server/userdetail.js'); // 引入用户详情模块
const group = require('../server/group.js'); // 引入首页模块
const chat = require('../server/chat.js'); // 引入聊天模块
const location = require('../server/location.js'); // 引入地址模块
const fireSafetyScore = require('./fireSafetyScore.js'); // 引入消防安全评分模块
const whitelistUser = require('./whitelistUser.js'); // 引入白名单用户模块

module.exports = function (app) {
    // 用户信息修改
    app.post('/user/update', function (req, res) {
        user.userUpdate(req, res); // 调用查询用户函数
    });

    // 获取群列表
    app.post('/group/getGroupList', function (req, res) {
        group.getGroupList(req, res); // 调用查询用户函数
    });

    // 获取最后一条群消息
    app.post('/group/getLastGroupMsg', function (req, res) {
        group.getLastGroupMsg(req, res); // 调用查询用户函数
    });

    // 群消息标已读
    app.post('/group/updateGroupMsg', function (req, res) {
        group.updateGroupMsg(req, res); // 调用查询用户函数
    });

    // 聊天页面 - 群消息
    app.post('/chat/getGroupMsg', function (req, res) {
        chat.getGroupMsg(req, res); // 调用聊天函数
    });

    // 地址列表查询（支持分页和模糊搜索）
    app.get('/location/list', function (req, res) {
        location.getLocationList(req, res); // 调用查询地址列表函数
    });

    // 地址明细查询
    app.get('/location/detail', function (req, res) {
        location.getLocationDetail(req, res); // 调用查询地址明细函数
    });

    // 消防安全评分相关路由
    app.use('/fireSafetyScore', fireSafetyScore);
    
    // 白名单用户相关路由
    app.use('/whitelistUser', whitelistUser);
}