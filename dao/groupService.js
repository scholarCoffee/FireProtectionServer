const dbmodel = require('../model/index.js'); // 引入数据模型
const Group = dbmodel.model('Group'); // 引入群模型
const GroupUser = dbmodel.model('GroupUser'); // 引入群成员模型
const GroupMessage = dbmodel.model('GroupMessage'); // 引入群消息模型

// 检查是否在群内
const checkInGroup = function(data, userId) {
    return new Promise((resolve, reject) => {
        console.log('检查是否在群内', data, userId); // 打印成功信息
        const { _id } = data // 解构获取请求体中的数据
        GroupUser.find({
            'groupId': _id, // 群ID
            'userId': userId // 用户ID
        })
        .then(result => {
            if (result.length > 0) {
                console.log('检查是否在群内成功'); // 打印成功信息
                resolve()
            } else {
                console.log('不在群内'); // 打印成功信息
                return GroupUser.create({
                    'groupId': _id, // 群ID
                    'userId': userId // 用户ID
                })
            }
        })
        .then(result => {
            console.log('创建群成员成功'); // 打印成功信息
            resolve()
        })
        .catch(err => {
            console.log('检查是否在群内失败', err); // 打印错误信息
            reject(err)
        })
    })
}

// 获取单个群消息
const getOneGroupMsg = async function(data) {
    return new Promise((resolve, reject) => {
        const { _id, name, imgUrl } = data // 解构获取请求体中的数据
        let query = GroupMessage.findOne({})
        query.where({
            'groupId': _id // 群ID
        })
        .populate('userId')
        .populate('groupId')
        .sort({ 'time': -1 }) // 按时间排序
        .exec()
        .then(result => {
            console.log('查询群消息成功:', result); // 打印成功信息
            if (result) {
                if (result.types == 0) {
                    result.message = result.message
                } else if (result.types == 1) {
                    result.message = '[图片]'
                } else if (result.types == 2) {
                    result.message = '[音频]'
                } else if (result.types == 3) {
                    result.message = '[位置]'
                }
            }
            if (result) {
                resolve({
                    groupMessageInfo: {
                        message: result.message,
                        sendMsgName: result.userId.nickName,
                        sendMsgAvatar: result.userId.avatarUrl,
                        sendMsgId: result.userId._id,
                        groupId: result.groupId._id,
                        groupName: result.groupId.name,
                        groupAvatar: result.groupId.imgUrl,
                        types: result.types,
                        lastTime: result.time
                    }
                })
            } else {
                resolve({
                    groupMessageInfo: {
                        message: '',
                        sendMsgName: '',
                        sendMsgAvatar: '',
                        sendMsgId: '',
                        groupId: _id,
                        groupName: name,
                        groupAvatar: '/group/group.png',
                        types: 0,
                        lastTime: new Date()
                    }
                })
            }
        })
    })
}   

// 获取群列表
exports.getGroupList = function(data, res) {
    const { isAll, userId } = data || {}; // 合同：Body { isAll, userId }
    Group.find({})
        .sort({ time: -1 })
        .exec()
        .then(async result => {
            // 确保当前用户在群成员表中存在一条记录
            if (userId && !isAll) {
                const ensureList = result.map(item => checkInGroup(item, userId));
                await Promise.all(ensureList);
            }
            
            // 获取每个群的成员数量
            const dataList = await Promise.all(result.map(async item => {
                // 查询群成员数量
                const memberCount = await GroupUser.countDocuments({ groupId: item._id });
                
                return {
                    groupId: item._id,
                    groupName: item.name,
                    description: item.notice || '',
                    ownerName: '',
                    createTime: item.time,
                    groupAvatar: item.imgUrl,
                    memberCount: memberCount // 新增：群成员数量
                };
            }));
            
            if (res) {
                res.send({ code: 200, msg: 'ok', data: dataList });
            }
        })
        .catch(err => {
            console.log('查询群列表失败！', err);
            if (res) {
                res.send({ code: 500, msg: '查询失败', error: err.message });
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
    const { groupInfo, userId } = data // 解构获取请求体中的数据
    const result = await getOneGroupMsg(groupInfo)
    const unreadCount = await unreadGroupMsg({ groupId: groupInfo._id, userId: userId })
    result.groupMessageInfo.tip = unreadCount
    console.log('最终群消息成功：', result); // 打印成功信息
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
    const { groupId, userId, name, time } = data // 解构获取请求体中的数据
    let wherestr = {
        'groupId': groupId, // 群ID
        'userId': userId // 用户ID
    }
    let updatestr = {
        'lastTime': time // 更新最后聊天时间
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
    return new Promise((resolve, reject) => {
        const { groupId, userId } = data // 解构获取请求体中的数据
        let wherestr = {
            'groupId': groupId, // 群ID
            'userId': { $ne: userId }, // 非当前用户
            'state': 1 // 消息状态 
        }
        let updatestr = {
            'state': 0 // 修改消息状态为已读
        }
        resolve(GroupMessage.updateMany(wherestr, updatestr)) // 更新消息状态
    })

}
const unreadGroupMsg = function(data, res) {
    return new Promise((resolve) => {
        const { groupId, userId } = data // 解构获取请求体中的数据
        console.log('汇总群未读消息', groupId, userId)
        // 统计该群组中未读消息数量，非当前用户
        let wherestr = {
            'groupId': groupId, // 群组ID
            'userId': { $ne: userId }, // 非当前用户
            'state': 1 // 消息状态 
        }
        // console.log('汇总群未读消息', wherestr)
        return resolve(GroupMessage.countDocuments(wherestr)) // 查询未读消息数量
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
    const { nowPage, pageSize, userId, groupId } = data // 解构获取请求体中的数据
    const skipNum = (nowPage - 1) * pageSize // 计算跳过的数量
    GroupMessage.find({})
    .where({
        'groupId': groupId // 群ID
    })
    .sort({ 'time': -1 }) // 按时间排序
    .skip(skipNum) // 跳过指定数量
    .populate('userId') // 关联查询用户信息
    .limit(pageSize) // 限制返回数量
    .exec()
    .then(result => {
        console.log('聊天消息', result)
        const data = result.map(item => {
            return {
                id: item._id, // 消息ID
                message: item.message, // 消息内容
                time: item.time, // 消息时间
                types: item.types, // 消息类型
                fromId: item.userId._id, // 发送者ID - 修复：使用实际发送者的ID
                groupId: item.groupId, // 群ID
                nickName: item.userId.nickName, // 发送者名称 - 修复：使用 User Schema 中的 nickName 字段
                avatarUrl: item.userId.avatarUrl, // 发送者头像 - 修复：使用 User Schema 中的 avatarUrl 字段
            }
        })
        res.send({
            code: 200,
            msg: '查询成功！',
            data: data // 返回查询到的消息数据
        }) // 返回成功信息给前端
        // 更新消息状态为已读
        this.updateGroupMsg({ uid: userId, gid: groupId }) // 修复：使用正确的参数名
    })
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
} 


// 新增：获取群组详情
exports.getGroupDetail = async function(data, res) {
    try {
        const { groupId } = data; // 群组ID
        
        if (!groupId) {
            return res.send({ code: 400, msg: '缺少群组ID参数' });
        }

        // 查找群组信息
        const group = await Group.findById(groupId);
        if (!group) {
            return res.send({ code: 404, msg: '群组不存在' });
        }

        // 获取群成员列表
        const groupUsers = await GroupUser.find({ groupId: groupId })
            .populate('userId', 'id nickName avatarUrl') // 关联查询用户信息
            .sort({ time: 1 }); // 按加入时间排序

        // 获取群成员数量
        const memberCount = groupUsers.length;

        // 获取群最后一条消息
        const lastMessage = await GroupMessage.findOne({ groupId: groupId })
            .populate('userId', 'nickName avatarUrl')
            .sort({ time: -1 });

        // 构建群成员信息
        console.log('群成员信息', groupUsers)
        const members = groupUsers.map(member => ({
            userId: member.userId?._id || '',
            nickName: member.userId?.nickName || '',
            avatarUrl: member.userId?.avatarUrl || '',
            time: member.time,
            lastChatTime: member.lastTime
        }));

        // 构建群详情数据
        const groupDetail = {
            groupId: group._id,
            groupName: group.name,
            groupAvatar: group.imgUrl,
            description: group.notice || '',
            createTime: group.time,
            updateTime: group.updateTime,
            memberCount: memberCount,
            members: members,
            lastMessage: lastMessage ? {
                message: lastMessage.message,
                messageType: lastMessage.types,
                sendTime: lastMessage.time,
                sender: {
                    userId: lastMessage.userId?._id || '',
                    nickName: lastMessage.userId?.nickName || '',
                    avatarUrl: lastMessage.userId?.avatarUrl || ''
                }
            } : null
        };

        res.send({
            code: 200,
            msg: '获取群组详情成功',
            data: groupDetail
        });

    } catch (err) {
        console.log('获取群组详情失败:', err);
        res.send({ code: 500, msg: '获取群组详情失败', error: err.message });
    }
}

// 新增：添加群组成员（支持批量添加）
exports.addGroupMember = async function(data, res) {
    try {
        const { groupId, userInfo } = data; // 群组ID和用户信息数组
        
        if (!groupId || !userInfo || !Array.isArray(userInfo)) {
            return res.send({ code: 400, msg: '缺少必要参数：groupId 或 userInfo' });
        }

        // 检查群组是否存在
        const group = await Group.findById(groupId);
        if (!group) {
            return res.send({ code: 404, msg: '群组不存在' });
        }

        const results = [];
        const errors = [];

        // 批量处理用户
        for (const user of userInfo) {
            try {
                const userId = user.userId;
                
                if (!userId) {
                    errors.push({ userId: user.userId || 'unknown', error: '缺少userId' });
                    continue;
                }

                // 检查用户是否已经在群组中
                const existingMember = await GroupUser.findOne({ groupId: groupId, userId: userId });
                if (existingMember) {
                    errors.push({ userId: userId, error: '用户已经是群组成员' });
                    continue;
                }

                // 添加用户到群组
                const newMember = new GroupUser({
                    groupId: groupId,
                    name: user.nickName,
                    userId: userId,
                    time: new Date()
                });

                await newMember.save();
                results.push({
                    userId: userId,
                    nickName: user.nickName,
                    time: newMember.time
                });

            } catch (userErr) {
                console.log(`添加用户 ${user.userId} 失败:`, userErr);
                errors.push({ userId: user.userId, error: userErr.message });
            }
        }

        res.send({
            code: 200,
            msg: `批量添加群组成员完成，成功: ${results.length}，失败: ${errors.length}`,
            data: {
                groupId: groupId,
                success: results,
                errors: errors
            }
        });

    } catch (err) {
        console.log('添加群组成员失败:', err);
        res.send({ code: 500, msg: '添加群组成员失败', error: err.message });
    }
}

// 新增：删除群组成员（支持批量删除）
exports.removeGroupMember = async function(data, res) {
    try {
        const { groupId, userInfo } = data; // 群组ID和用户信息数组
        
        if (!groupId || !userInfo || !Array.isArray(userInfo)) {
            return res.send({ code: 400, msg: '缺少必要参数：groupId 或 userInfo' });
        }

        // 检查群组是否存在
        const group = await Group.findById(groupId);
        if (!group) {
            return res.send({ code: 404, msg: '群组不存在' });
        }

        const results = [];
        const errors = [];

        // 批量处理用户
        for (const user of userInfo) {
            try {
                const userId = user.userId;
                
                if (!userId) {
                    errors.push({ userId: user.userId || 'unknown', error: '缺少userId' });
                    continue;
                }

                // 检查用户是否在群组中
                const existingMember = await GroupUser.findOne({ groupId: groupId, userId: userId });
                if (!existingMember) {
                    errors.push({ userId: userId, error: '用户不是群组成员' });
                    continue;
                }

                // 从群组中删除用户
                await GroupUser.deleteOne({ groupId: groupId, userId: userId });
                results.push({
                    userId: userId,
                    nickName: user.nickName
                });

            } catch (userErr) {
                console.log(`删除用户 ${user.userId} 失败:`, userErr);
                errors.push({ userId: user.userId, error: userErr.message });
            }
        }

        res.send({
            code: 200,
            msg: `批量删除群组成员完成，成功: ${results.length}，失败: ${errors.length}`,
            data: {
                groupId: groupId,
                success: results,
                errors: errors
            }
        });

    } catch (err) {
        console.log('删除群组成员失败:', err);
        res.send({ code: 500, msg: '删除群组成员失败', error: err.message });
    }
}

// 新增：更新群组信息
exports.updateGroup = async function(data, res) {
    try {
        const { groupId, groupName, description, groupAvatar } = data; // 群组ID和更新信息
        
        if (!groupId) {
            return res.send({ code: 400, msg: '缺少必要参数：groupId' });
        }

        // 检查群组是否存在
        const group = await Group.findById(groupId);
        if (!group) {
            return res.send({ code: 404, msg: '群组不存在' });
        }

        // 构建更新数据
        const updateData = {
            updateTime: new Date()
        };

        // 只更新提供的字段
        if (groupName !== undefined) {
            updateData.name = groupName;
        }
        if (description !== undefined) {
            updateData.notice = description;
        }
        if (groupAvatar !== undefined) {
            updateData.imgUrl = groupAvatar;
        }

        // 更新群组信息
        const updatedGroup = await Group.findByIdAndUpdate(
            groupId, 
            updateData, 
            { new: true, runValidators: true }
        );

        res.send({
            code: 200,
            msg: '更新群组信息成功',
            data: {
                groupId: updatedGroup._id,
                groupName: updatedGroup.name,
                groupAvatar: updatedGroup.imgUrl,
                description: updatedGroup.notice,
                updateTime: updatedGroup.updateTime
            }
        });

    } catch (err) {
        console.log('更新群组信息失败:', err);
        res.send({ code: 500, msg: '更新群组信息失败', error: err.message });
    }
}

// 汇总群消息未读取
exports.unreadGroupMsg = unreadGroupMsg
exports.getOneGroupMsg = getOneGroupMsg