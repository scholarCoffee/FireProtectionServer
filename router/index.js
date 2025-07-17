const signUp = require('../server/signUp.js'); // 引入注册模块
const signIn = require('../server/signIn.js'); // 引入登录模块
const search = require('../server/search.js'); // 引入搜索模块
const user = require('../server/userDetail.js'); // 引入用户详情模块
const friend = require('../server/friend.js'); // 引入好友模块
const index = require('../server/index.js'); // 引入首页模块
const chat = require('../server/chat.js'); // 引入聊天模块
const group = require('../server/group.js'); // 引入群模块
const location = require('../server/location.js'); // 引入地址模块

module.exports = function (app) {
    // 注册页面
    app.post('/signUp/register', function (req, res) {
        signUp.signUp(req, res); // 调用注册函数
    });

    // 用户是否被占用
    app.post('/signUp/judge', function (req, res) {
        signUp.judgeValue(req, res); // 调用判断函数
    });

    // 密码修改
    app.post('/signUp/updatePwd', function (req, res) {
        signUp.updatePwd(req, res); // 调用修改密码函数
    });
    
    // 登录页面
    app.post('/signIn/login', function (req, res) {
        signIn.signIn(req, res); // 调用登录函数
    });

    // 搜索用户
    app.post('/search/user', function (req, res) {
        search.searchUser(req, res); // 调用搜索用户函数
    });

    // 判断是否为好友
    app.post('/search/isFriend', function (req, res) {
        search.isFriend(req, res); // 调用判断好友函数
    });

    // 用户群
    app.post('/search/group', function (req, res) {
        search.searchGroup(req, res); // 调用搜索群函数
    });

    // 判断是否在群里面
    app.post('/search/isInGroup', function (req, res) {
        search.isInGroup(req, res); // 调用判断群函数
    });

    // 判断是否在群里面
    app.post('/search/isInGroupByFriend', function (req, res) {
        search.isInGroupByFriend(req, res); // 调用判断群函数
    });

    // 用户详情
    app.post('/user/detail', function (req, res) {
        user.userDetail(req, res); // 调用查询用户函数
    });

    // 用户信息修改
    app.post('/user/update', function (req, res) {
        user.userUpdate(req, res); // 调用查询用户函数
    });

    // 修改好友昵称
    app.post('/user/updateMarkName', function (req, res) {
        user.updateMarkName(req, res); // 调用查询用户函数
    });

    // 好友昵称获取
    app.post('/user/getMarkName', function (req, res) {
        user.getMarkName(req, res); // 调用查询用户函数
    });

    // 申请好友
    app.post('/friend/applyFriend', function (req, res) {
        friend.applyFriend(req, res); // 调用查询用户函数
    });

    // 更新好友状态
    app.post('/friend/updateFriendState', function (req, res) {
        friend.updateFriendState(req, res); // 调用查询用户函数
    });

    // 删除好友
    app.post('/friend/deleteFriend', function (req, res) {
        friend.deleteFriend(req, res); // 调用查询用户函数
    });

    // 获取好友列表
    app.post('/index/getFriend', function (req, res) {
        index.getFriend(req, res); // 调用查询用户函数
    });

    // 获取最后一条消息
    app.post('/index/getLastMsg', function (req, res) {
        index.getLastMsg(req, res); // 调用查询用户函数
    });

    // 获取好友未读消息数
    app.post('/index/unreadSelfMsg', function (req, res) {
        index.unreadSelfMsg(req, res); // 调用查询用户函数
    });

    // 更新已读消息
    app.post('/index/updateMsg', function (req, res) {
        index.updateMsg(req, res); // 调用查询用户函数
    });

    // 获取群列表
    app.post('/index/getGroup', function (req, res) {
        index.getGroup(req, res); // 调用查询用户函数
    });

    // 获取最后一条群消息
    app.post('/index/getLastGroupMsg', function (req, res) {
        index.getLastGroupMsg(req, res); // 调用查询用户函数
    });

    // 群消息标已读
    app.post('/index/updateGroupMsg', function (req, res) {
        index.updateGroupMsg(req, res); // 调用查询用户函数
    });

    // 聊天页面
    app.post('/chat/getSelfMsg', function (req, res) {
        chat.getSelfMsg(req, res); // 调用聊天函数
    });

    // 聊天页面
    app.post('/chat/getGroupMsg', function (req, res) {
        chat.getGroupMsg(req, res); // 调用聊天函数
    });

    // 新建群
    app.post('/group/createGroup', function (req, res) {
        group.createGroup(req, res); // 调用新建群函数
    });

    // 查询群详情
    app.post('/group/getGroupDetail', function (req, res) {
        group.getGroupDetail(req, res); // 调用查询群详情函数
    });

    // 新增群成员
    app.post('/group/addGroupUser', function (req, res) {
        group.addGroupUser(req, res); // 调用新增群成员函数
    });

    // 删除群成员
    app.post('/group/deleteGroup', function (req, res) {
        group.deleteGroup(req, res); // 调用删除群成员函数
    });

    // 修改群信息
    app.post('/group/updateGroup', function (req, res) {
        group.updateGroup(req, res); // 调用修改群信息函数
    });

    // 地址列表查询（支持分页和模糊搜索）
    app.get('/location/list', function (req, res) {
        location.getLocationList(req, res); // 调用查询地址列表函数
    });

    // 地址明细查询
    app.get('/location/detail', function (req, res) {
        location.getLocationDetail(req, res); // 调用查询地址明细函数
    });
}