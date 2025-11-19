const user = require('../server/userdetail.js'); // 引入用户详情模块
const group = require('../server/group.js'); // 引入首页模块
const chat = require('../server/chat.js'); // 引入聊天模块
const location = require('../server/location.js'); // 引入地址模块
const fire = require('../server/fire.js'); // 引入消防静态与部署模块
const static = require('../server/static.js'); // 引入静态配置与作战部署素材模块
const fireSafetyScore = require('./fireSafetyScore.js'); // 引入消防安全评分模块
const owner = require('./owner.js'); // 引入户主信息模块
const taskRouter = require('../server/task.js');

module.exports = function (app) {
    // 用户信息修改
    app.post('/user/update', function (req, res) {
        user.userUpdate(req, res); // 调用查询用户函数
    });

    // 登录或更新（微信小程序 code 换 openid 并入库）
    app.post('/user/loginOrUpdate', function (req, res) {
        user.loginOrUpdate(req, res);
    });

    // 绑定手机号（微信解密）
    app.post('/user/getPhoneNumber', function (req, res) {
        user.getPhoneNumber(req, res);
    });

    // 新增：权限管理 - 获取用户列表
    app.get('/user/list', function (req, res) {
        user.getUserList(req, res);
    });

    // 新增：更新单个用户权限
    app.post('/user/updatePermission', function (req, res) {
        user.updateUserPermission(req, res);
    });

    // 新增：更新用户角色
    app.post('/user/updateRole', function (req, res) {
        user.updateUserRole(req, res);
    });

    // 删除用户
    app.post('/user/delete', function (req, res) {
        user.deleteUser(req, res);
    });
    
    // 根据ID获取用户详情（支持 POST 方法）
    app.post('/user/getById', function (req, res) {
        user.getUserById(req, res);
    });

    // 获取群列表
    app.post('/group/getGroupList', function (req, res) {
        group.getGroupList(req, res); // 调用查询用户函数
    });

    // 新增：获取群组详情
    app.get('/group/detail', function (req, res) {
        group.getGroupDetail(req, res); // 调用获取群组详情函数
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
    // 新增：群成员接口
    app.get('/chat/members', function (req, res) {
        group.getMembers(req, res);
    });

    // 新增：群组内新增成员接口
    app.post('/group/addMember', function (req, res) {
        group.addGroupMember(req, res);
    });

    // 新增：群组内删除成员接口
    app.post('/group/removeMember', function (req, res) {
        group.removeGroupMember(req, res);
    });

    // 新增：群组信息更新接口
    app.post('/group/save', function (req, res) {
        group.updateGroup(req, res);
    });

    // 地址列表查询（支持分页和模糊搜索）
    app.get('/location/list', function (req, res) {
        location.getLocationList(req, res); // 调用查询地址列表函数
    });

    // 地址明细查询
    app.get('/location/detail', function (req, res) {
        location.getLocationDetail(req, res); // 调用查询地址明细函数
    });

    // 地址编号校验（地址编号只能填写一个且需唯一）
    app.get('/location/checkAddressId', function (req, res) {
        location.checkAddressId(req, res);
    });

    // 反向地理编码（根据经纬度获取地址信息）
    app.get('/location/reverseGeocode', function (req, res) {
        location.reverseGeocode(req, res);
    });

    // 新增地址信息
    app.post('/location/add', function (req, res) {
        location.addLocation(req, res); // 调用新增地址函数
    });
    
    // 更新地址信息（合同允许 /location/save 或 /location/update）
    app.post('/location/save', function (req, res) {
        location.updateLocation(req, res); // 调用更新地址函数
    });
    
    // 删除地址信息
    app.post('/location/delete', function (req, res) {
        location.deleteLocation(req, res); // 调用删除地址函数
    });

    // 消防安全评分相关路由
    app.use('/fireSafetyScore', fireSafetyScore);

    // 静态配置与作战部署素材
    app.use('/static', static);

    // 静态配置与作战部署素材
    app.use('/fire', fire);

    // 户主信息管理相关路由
    app.use('/owner', owner);

    // 作战任务相关路由
    app.use('/task', taskRouter);
    
}