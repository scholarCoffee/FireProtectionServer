const dbmodel = require('../model/index.js'); // 引入数据模型
const Group = dbmodel.model('Group'); // 引入群模型
const GroupUser = dbmodel.model('GroupUser'); // 引入群成员模型
const GroupMessage = dbmodel.model('GroupMessage'); // 引入群消息模型

// 检查是否在群内
const checkInGroup = function(data, uid) {
    return new Promise((resolve, reject) => {
        console.log('检查是否在群内', data, uid); // 打印成功信息
        const { _id } = data // 解构获取请求体中的数据
        GroupUser.find({
            'groupId': _id, // 群ID
            'userId': uid // 用户ID
        })
        .then(result => {
            if (result.length > 0) {
                console.log('检查是否在群内成功'); // 打印成功信息
                resolve()
            } else {
                console.log('不在群内'); // 打印成功信息
                return GroupUser.create({
                    'groupId': _id, // 群ID
                    'userId': uid, // 用户ID
                    'state': 1 // 消息状态
                })
            }
        })
        .then(result => {
            console.log('创建群成员成功', result); // 打印成功信息
            resolve()
        })
        .catch(err => {
            console.log('检查是否在群内失败', err); // 打印错误信息
            reject(err)
        })
    })
}

// 获取单个群消息
const getOneGroupMsg = async function(data, res) {
    return new Promise((resolve, reject) => {
        const { groupId } = data // 解构获取请求体中的数据
        let query = GroupMessage.findOne({})
        query.where({
            'groupId': groupId // 群ID
        })
        .populate('groupId')
        .populate('userId') // 关联用户ID
        .sort({ 'time': -1 }) // 按时间排序
        .exec()
        .then(result => {
            console.log('查询群消息成功！', result); // 打印成功信息
            if (result) {
                if (result.types == 1) {
                    result.message = '[图片]'
                } else if (result.types == 2) {
                    result.message = '[音频]'
                } else if (result.types == 3) {
                    result.message = '[位置]'
                }
            } else {
                result ? result : result = {
                    message: '暂无消息',
                    types: 0,
                    lastTime: new Date(),
                    tip: 0
                }
            }
            resolve({
                ...data,
                groupMessageInfo: result
            })
        })
    })
}   

exports.getOneGroupMsg = getOneGroupMsg
// 获取群列表
exports.getGroupList = function(data, res) {
    const { permissionStatus, uid } = data // 解构获取请求体中的数据
    const id = permissionStatus == 1 ? '687a6f59e83419906c0699e0' : uid
    let query = Group.find({})
    query.where({
        'userId': id // 用户ID
    })
    .sort({ 'time': -1 }) // 按时间排序
    .exec()
    .then(async result => {
        console.log('查询群列表成功', result); // 打印成功信息
        // 判断当前群聊表数组中每个群里是否存在当前用户
        const query = result.map(item => {
            return checkInGroup(item, uid)
        })
        await Promise.all(query)
        if (res) {
            res.send({
                code: 200,
                msg: '查询成功！',
                data: result // 返回查询到的群列表和群成员列表
            })
        }
    })
    .catch(err => {
        console.log('查询群列表失败！', err); // 打印错误信息
        if (res) {
            res.send({
                code: 400,
                msg: '查询失败！',
                data: err // 返回查询到的群列表和群成员列表
            }); // 返回失败信息给前端
        }
    })
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
            'userId': id // 用户ID
        })
        .sort({ 'time': -1 }) // 按时间排序
        .exec()
        .then(async result => {
            console.log('查询群列表成功！', result); // 打印成功信息
            let data = result.map(item => {
                return {
                    id: item._id, // 群ID
                    userId: item.userId, // 用户ID
                    name: item.name, // 群名称
                    imgUrl: item.imgUrl, // 群头像
                    time: item.time, // 创建时间
                }
            })
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
exports.getLastGroupMsg = async function(data, res) {
    const { groupList } = data // 解构获取请求体中的数据
    const result = await Promise.all(groupList.map(async item => {
        return await getOneGroupMsg(item)    
    }))
    console.log('查询群消息成功！', result); // 打印成功信息
    try {
        if (res) {
            res.send({
                code: 200,
                msg: '查询成功！',
                data: result // 返回查询到的群消息数据
            })
        }
    } catch (err) {
        console.log('查询群消息失败！', err); // 打印错误信息
        if (res) {
            res.send({
                code: 400,
                msg: '查询失败！',
                data: err // 返回查询到的群消息数据
            }); // 返回失败信息给前端
        }
    }
}
// 更新群消息时间
exports.updateGroupMessageLastTime = function(data, res) {
    const { groupId } = data // 解构获取请求体中的数据
    let wherestr = {
        'groupId': groupId // 群ID
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
        'groupId': gid, // 群ID
        'userId': uid, // 用户ID
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
            'groupId': gid, // 群组ID
            'userId': uid, // 用户ID
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
        'groupId': gid // 群ID
    })
    .sort({ 'time': -1 }) // 按时间排序
    .skip(skipNum) // 跳过指定数量
    .populate('userId') // 关联查询用户信息
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
                fromId: item.userId._id, // 发送者ID
                groupId: item.groupId, // 群ID
                name: item.userId.name, // 发送者名称
                imgurl: item.userId.imgurl, // 发送者头像
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