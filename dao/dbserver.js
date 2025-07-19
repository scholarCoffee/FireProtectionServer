// 数据库服务主文件 - 整合所有模块化服务
// 引入各个服务模块
const userService = require('./userService.js');
const friendService = require('./friendService.js');
const messageService = require('./messageService.js');
const groupService = require('./groupService.js');
const locationService = require('./locationService.js');

// 导出所有服务方法
module.exports = {
    // 用户相关服务
    buildUser: userService.buildUser,
    countUserValue: userService.countUserValue,
    updateUserPwd: userService.updateUserPwd,
    userMatch: userService.userMatch,
    searchUser: userService.searchUser,
    userDetail: userService.userDetail,
    userUpdate: userService.userUpdate,

    // 好友相关服务
    isFriend: friendService.isFriend,
    updateMarkName: friendService.updateMarkName,
    getMarkName: friendService.getMarkName,
    buildFriend: friendService.buildFriend,
    updateFriendLastTime: friendService.updateFriendLastTime,
    applyFriend: friendService.applyFriend,
    updateFriendState: friendService.updateFriendState,
    deleteFriend: friendService.deleteFriend,
    getOnlyUsers: friendService.getOnlyUsers,

    // 消息相关服务
    insertMsg: messageService.insertMsg,
    getOneMsg: messageService.getOneMsg,
    unreadSelfMsg: messageService.unreadSelfMsg,
    updateMsg: messageService.updateMsg,
    getSelfMsg: messageService.getSelfMsg,

    // 群组相关服务
    searchGroup: groupService.searchGroup,
    isInGroup: groupService.isInGroup,
    isInGroupByFriend: groupService.isInGroupByFriend,
    createGroup: groupService.createGroup,
    getGroupDetail: groupService.getGroupDetail,
    addGroupUser: groupService.addGroupUser,
    deleteGroupUser: groupService.deleteGroupUser,
    deleteGroup: groupService.deleteGroup,
    updateGroup: groupService.updateGroup,
    insertGroupMsg: groupService.insertGroupMsg,
    getOnlyGroup: groupService.getOnlyGroup,
    getOneGroupMsg: groupService.getOneGroupMsg,
    updateGroupMessageLastTime: groupService.updateGroupMessageLastTime,
    updateGroupMsg: groupService.updateGroupMsg,
    unreadGroupMsg: groupService.unreadGroupMsg,
    getGroupMsg: groupService.getGroupMsg,

    // 地址相关服务
    getLocationList: locationService.getLocationList,
    getLocationDetail: locationService.getLocationDetail,
    getLocationById: locationService.getLocationById,
    addLocation: locationService.addLocation,
    updateLocation: locationService.updateLocation,
    deleteLocation: locationService.deleteLocation,
    getLocationStats: locationService.getLocationStats,

    // 复合功能方法
    getFriendsInMsg: async function(data, res) {
        const { uid } = data // 解构获取请求体中的数据
        try {
            let friend = await friendService.getOnlyUsers(data) // 获取用户列表
            // console.log('获取用户列表成功！', friend); // 打印成功信息
            for(let i = 0; i < friend.length; i++) {
                let result = await messageService.getOneMsg({ uid: uid, fid: friend[i].id }) // 获取一对一消息
                // console.log('获取一对一消息成功！', result); // 打印成功信息
                result = result || {}
                if (result.types == 0) {
                    
                } else if (result.types == 1) {
                    result.message = '[图片]'
                } else if (result.types == 2) { 
                    result.message = '[音频]'
                } else if (result.types == 3) {
                    result.message = '[位置]'
                }
                friend[i].msg = result.message || '' // 将消息内容添加到用户列表中
                let readTip = await messageService.unreadSelfMsg({ uid: uid, fid: friend[i].id }) // 获取未读消息数量
                friend[i].tip = readTip // 将未读消息数量添加到用户列表中
            }
            // console.log('获取最终用户信息！', friend); // 打印成功信息
            res.send({
                code: 200,
                msg: '查询成功！',
                data: friend // 返回查询到的用户数据
            }) // 返回成功信息给前端
        } catch (err) {
            console.log(err); // 打印错误信息
            res.send('查询失败！'); // 返回失败信息给前端
        }
    },

    getGroupInMsg: async function(data, res) {
        try {
            let group = await groupService.getOnlyGroup(data) // 获取用户列表
            for(let i = 0; i < group.length; i++) {
                let result = await groupService.getOneGroupMsg({ gid: group[i].id})
                if (result) {
                    if (result.types == 0) {
                    
                    } else if (result.types == 1) {
                        result.message = '[图片]'
                    } else if (result.types == 2) { 
                        result.message = '[音频]'
                    } else if (result.types == 3) {
                        result.message = '[位置]'
                    }
                    group[i].msg = result.message // 将消息内容添加到用户列表中
                    // console.log('result:', result)
                    group[i].username = result.userID && result.userID.name // 将用户名称添加到用户列表中
                    let readGroupTip = await groupService.unreadGroupMsg({  uid: uid, gid: group[i].id })
                    group[i].tip = readGroupTip
                }
            }
            // console.log('获取最终群信息！', group); // 打印成功信息
            res.send({
                code: 200,
                msg: '查询成功！',
                data: group // 返回查询到的用户数据
            }) // 返回成功信息给前端
        } catch (err) {
            console.log(err); // 打印错误信息
            res.send('查询失败！'); // 返回失败信息给前端
        }
    }
};