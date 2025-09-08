const dbServer = require('../dao/dbserver.js'); // 引入数据操作模块

// 用户信息修改
const userUpdate = function (req, res) {
    // console.log('用户信息修改请求接收:', req.body); // 打印请求体
    let data = req.body; // 获取请求体
    dbServer.userUpdate(data, res); // 调用查询用户函数
}

// 登录或更新（前端仅传 code、nickName、avatarUrl 等）
const loginOrUpdate = function (req, res) {
    let data = req.body;
    dbServer.loginOrUpdate(data, res);
}

// 获取并绑定手机号
const getPhoneNumber = function (req, res) {
    // 直接把 req/res 交给服务层以便读取 req.body
    dbServer.getPhoneNumber(req, res);
}

// 新增：获取用户列表（GET /user/list）
const getUserList = function (req, res) {
    dbServer.getUserList(req, res);
}

// 根据ID获取用户详情
const getUserById = function (req, res) {
    dbServer.getUserById(req, res);
}

// 新增：更新单个用户权限
const updateUserPermission = function (req, res) {
    dbServer.updateUserPermission(req, res);
}

// 新增：更新用户角色
const updateUserRole = function (req, res) {
    dbServer.updateUserRole(req, res);
}

// 删除用户
const deleteUser = function (req, res) {
    dbServer.deleteUser(req, res);
}

module.exports = {
    userUpdate,
    loginOrUpdate,
    getPhoneNumber,
    getUserList,
    getUserById,
    updateUserPermission,
    updateUserRole,
    deleteUser
}