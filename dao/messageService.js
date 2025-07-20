var dbmodel = require('../model/index.js'); // 引入数据模型
var Message = dbmodel.model('Message'); // 引入消息模型

// 添加一对一消息
exports.insertMsg = function(uid, fid, msg, type, res) {
    let data = {
        'userId': uid, // 用户ID
        'friendID': fid, // 好友ID
        'message': msg, // 消息内容
        'types': type, // 消息类型
        'time': new Date(), // 消息时间
        'state': 1 // 消息状态  0已读 1未读
    }
    // console.log('添加消息数据:', data); // 打印添加消息数据
    let message = new Message(data) // 创建消息模型
    message.save()
    .then(result => {
        // console.log('添加消息成功！'); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '添加消息成功！',
                data: result // 返回添加成功的消息数据
            }); // 返回成功信息给前端
        }

    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('添加消息失败！'); // 返回失败信息给前端
        }
    });
}

// 按要求获取一对一消息
exports.getOneMsg = function(data, res) {
    return new Promise((resolve) => {
        const { uid, fid } = data // 解构获取请求体中的数据
        return resolve(Message.findOne({}).where({
            $or: [{
                'userId': uid, // 用户ID
                'friendID': fid // 好友ID
            }, {
                'userId': fid, // 用户ID
                'friendID': uid // 好友ID
            }]
        }).sort({ 'time': -1 }) // 按时间排序
        .exec())
    })
    .then(result => {
        if(res) {
            res.send({
                code: 200,
                msg: '查询成功！',
                data: result // 返回查询到的用户数据
            })
        }

        return Promise.resolve(result)
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        if (res) {
            res.send('查询失败！'); // 返回失败信息给前端
        }
        return Promise.reject(err)
    });
}

// 汇总一对一消息未读取
exports.unreadSelfMsg = function(data, res) {
    return new Promise((resolve) => {
        const { uid, fid } = data // 解构获取请求体中的数据
        let wherestr = {
            'userId': fid, // 用户ID
            'friendID': uid, // 好友ID
            'state': 1 // 消息状态 
        }
        return resolve(Message.countDocuments(wherestr)) // 查询未读消息数量
    })
    .then(count => {
        // console.log('查询一对一汇总消息数量：', count); // 打印成功信息
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

// 一对一消息状态修改
exports.updateMsg = function(data, res) {
    const { uid, fid } = data // 解构获取请求体中的数据
    let wherestr = {
        'userId': fid, // 用户ID
        'friendID': uid, // 好友ID
        'state': 1 // 消息状态 
    }
    let updatestr = {
        'state': 0 // 修改消息状态为已读
    }
    Message.updateMany(wherestr, updatestr) // 更新消息状态
    .then(result => {
        console.log('更新成功！', result); // 打印成功信息
        if (res) {
            res.send({
                code: 200,
                msg: '更新成功！',
                data: result // 返回更新后的消息数据
            })
        }

    })
    .catch(err => {
        console.log('更新失败！', err); // 打印错误信息
        if (res) {
            res.send('更新失败！'); // 返回失败信息给前端
        }
        
    });
}

// 消息操作
// 分页获取数据一对一聊天数据
exports.getSelfMsg = function (data, res) {
    const { nowPage, pageSize, uid, fid } = data // 解构获取请求体中的数据
    const skipNum = (nowPage - 1) * pageSize // 计算跳过的数量
    Message.find({})
    .where({
        $or: [{
            'userId': uid, // 用户ID
            'friendID': fid // 好友ID
        }, {
            'userId': fid, // 用户ID
            'friendID': uid // 好友ID
        }]
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
                userId: item.friendID, // 用户ID
                imgurl: item.userId.imgurl, // 发送者头像
            }
        })
        res.send({
            code: 200,
            msg: '查询成功！',
            data: data // 返回查询到的消息数据
        }) // 返回成功信息给前端
        // 更新消息状态为已读
        this.updateMsg({ uid: uid, fid: fid }) // 调用更新消息状态函数
    })
    .then(result => {
        // console.log('更新成功！', result); // 打印成功信息
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
} 