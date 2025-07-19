var dbmodel = require('../model/index.js'); // 引入数据模型
var Group = dbmodel.model('Group'); // 引入群模型
var GroupUser = dbmodel.model('GroupUser'); // 引入群成员模型
var GroupMessage = dbmodel.model('GroupMessage'); // 引入群消息模型
// 判断是否在群内
exports.isInGroup = function (uid, gid, res) {
    GroupUser.findOne({ 'userID': uid, 'groupID': gid }) // 用户ID和群ID
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        console.log('查询结果:', result); // 打印查询结果
        if (result) {
            res.send({
                code: 400,
                msg: '不在群内！'
            }); // 返回失败信息给前端
        } else {
            res.send({
                code: 200,
                msg: '已在群内！',
                data: result // 返回查询到的群成员数据
            }); // 返回成功信息给前端
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 更新群信息
exports.updateGroup = function (data, res) {
    const { gid, value, type } = data || {}// 解构获取请求体中的数据
    let wherestr = {
        '_id': gid // 群ID
    }
    let updatestr = {}
    updatestr[type] = value
    Group.findOneAndUpdate(wherestr, updatestr, { new: true }) // 更新群信息
    .then(result => {
        console.log('更新群信息成功！', result); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '更新群信息成功！',
                data: result // 返回更新后的群数据
            }); // 返回成功信息给前端
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('更新群信息失败！'); // 返回失败信息给前端
        }
    });
}

// 添加群消息
exports.insertGroupMsg = function(data, res) {
    let groupMessage = new GroupMessage(data) // 创建群消息模型
    groupMessage.save()
    .then(result => {
        // console.log('添加群消息成功！', result); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '添加群消息成功！',
                data: result // 返回添加成功的群消息数据
            }); // 返回成功信息给前端
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('添加群消息失败！'); // 返回失败信息给前端
        }
    });
}

// 按要求获取群列表
exports.getOnlyGroup = function(data, res) {
    const { permissionStatus, uid } = data // 解构获取请求体中的数据
    const id = permissionStatus == 1 ? '507f1f77bcf86cd799439012' : uid
    return new Promise((resolve, reject) => {
        let query = Group.find({})
        query.where({
            'userID': id // 用户ID
        })
        .sort({ 'time': -1 }) // 按时间排序
        .exec()
        .then(async result => {
            console.log('查询群列表成功！', result); // 打印成功信息
            let data = result.map(item => {
                return {
                    id: item._id, // 群ID
                    userID: item.userID, // 用户ID
                    name: item.name, // 群名称
                    imgUrl: item.imgUrl, // 群头像
                    time: item.time, // 创建时间
                }
            })
            
            // 为每个群查询最后聊天信息
            for (let i = 0; i < data.length; i++) {
                try {
                    const lastMsg = await GroupMessage.findOne({ groupID: data[i].id })
                        .sort({ time: -1 })
                        .populate('userID')
                        .exec();
                    
                    if (lastMsg) {
                        data[i].lastMessage = lastMsg.message;
                        data[i].lastMessageTime = lastMsg.time;
                        data[i].lastMessageUser = lastMsg.userID ? lastMsg.userID.nickName : '';
                    }
                } catch (err) {
                    console.log('查询群最后消息失败:', err);
                }
            }
            
            resolve(data) // 返回查询到的群数据
            if (res) {
                res.send({
                    code: 200,
                    msg: '查询成功！',
                    data: data // 返回查询到的群数据
                })
            }
        })
        .catch(err => {
            console.log(err); // 打印错误信息
            reject(err)
            if (res) {
                res.send('查询失败！'); // 返回失败信息给前端
            }
        });
    })
}

// 按要求获取群消息
exports.getOneGroupMsg = function(data, res) {
    return new Promise((resolve, reject) => {
        const { gid } = data // 解构获取请求体中的数据
        let query = GroupMessage.findOne({})
        query.where({
            'groupID': gid // 群ID
        })
        .populate('groupID')
        .populate('userID') // 关联用户ID
        .sort({ 'time': -1 }) // 按时间排序
        .exec()
        .then(result => {
            // console.log('群消息：', result)
            if (res) {
                res.send({
                    code: 200,
                    msg: '查询成功！',
                    data: result // 返回查询到的群消息数据
                })
            }
            resolve(result)
        })
        .catch(err => {
            console.log(err); // 打印错误信息
            reject(err)
            if (res) {
                res.send('查询失败！'); // 返回失败信息给前端
            }
        });
    })
}

// 更新群消息时间
exports.updateGroupMessageLastTime = function(data, res) {
    const { groupID } = data // 解构获取请求体中的数据
    let wherestr = {
        'groupID': groupID // 群ID
    }
    let updatestr = {
        'lastTime': new Date() // 更新最后聊天时间
    }
    GroupUser.updateMany(wherestr, updatestr) // 更新群消息时间
    .then(result => {
        // console.log('群消息时间更新成功！', result); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '群消息时间更新成功！',
                data: result // 返回更新后的群消息数据
            })
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('更新失败！'); // 返回失败信息给前端
        }
    });
}

// 群消息状态修改
exports.updateGroupMsg = function(data, res) {
    const { gid, uid } = data // 解构获取请求体中的数据
    let wherestr = {
        'groupID': gid, // 群ID
        'userID': uid, // 用户ID
        'state': 1 // 消息状态 
    }
    let updatestr = {
        'state': 0 // 修改消息状态为已读
    }
    GroupUser.updateMany(wherestr, updatestr) // 更新消息状态
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '更新成功！',
                data: result // 返回更新后的消息数据
            })
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('更新失败！'); // 返回失败信息给前端
        }
    });
}

// 汇总群消息未读取
exports.unreadGroupMsg = function(data, res) {
    return new Promise((resolve) => {
        const { gid, uid } = data // 解构获取请求体中的数据
        let wherestr = {
            'groupID': gid, // 群组ID
            'userID': uid, // 用户ID
            'state': 1 // 消息状态 
        }
        // console.log('汇总群未读消息', wherestr)
        return resolve(GroupUser.countDocuments(wherestr)) // 查询未读消息数量
    })
    .then(count => {
        // console.log('查询群汇总消息数量：', count); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '查询成功！',
                data: count // 返回查询到的未读消息数量
            })
        }
        return Promise.resolve(count)
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('查询失败！'); // 返回失败信息给前端
        }
        return Promise.reject(err)
    });
}

// 分页获取群聊天数据
exports.getGroupMsg = function (data, res) {
    const { nowPage, pageSize, uid, gid } = data // 解构获取请求体中的数据
    const skipNum = (nowPage - 1) * pageSize // 计算跳过的数量
    GroupMessage.find({})
    .where({
        'groupID': gid // 群ID
    })
    .sort({ 'time': -1 }) // 按时间排序
    .skip(skipNum) // 跳过指定数量
    .populate('userID') // 关联查询用户信息
    .limit(pageSize) // 限制返回数量
    .exec()
    .then(result => {
        // console.log('聊天消息', result)
        const data = result.map(item => {
            return {
                id: item._id, // 消息ID
                message: item.message, // 消息内容
                time: item.time, // 消息时间
                types: item.types, // 消息类型
                fromId: item.userID._id, // 发送者ID
                groupId: item.groupID, // 群ID
                name: item.userID.name, // 发送者名称
                imgurl: item.userID.imgurl, // 发送者头像
            }
        })
        res.send({
            code: 200,
            msg: '查询成功！',
            data: data // 返回查询到的消息数据
        }) // 返回成功信息给前端
        // 更新消息状态为已读
        this.updateGroupMsg({ uid: uid, gid: gid }) // 调用更新消息状态函数
    })
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
} 