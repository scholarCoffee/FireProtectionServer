var dbmodel = require('../model/index.js'); // 引入数据模型
var Friend = dbmodel.model('Friend'); // 引入好友模型
var Message = dbmodel.model('Message'); // 引入消息模型

// 判断是否为好友
exports.isFriend = function (uid, fid, res) {
    Friend.findOne({
        $or: [
            { 'userId': uid, 'friendID': fid, 'state': 0 }, // 用户ID和好友ID
        ]
    })
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        console.log('查询结果:', result); // 打印查询结果
        if (result) {
            res.send({
                code: 200,
                msg: '已是好友！',
                data: result // 返回查询到的好友数据
            }); // 返回成功信息给前端
        } else {
            res.send({
                code: 400,
                msg: '不是好友！'
            }); // 返回失败信息给前端
        }
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 修改好友昵称
exports.updateMarkName = function (data, res) {
    const { uid, fid, name } = data // 解构获取请求体中的数据
    let wherestr = {
        'userId': uid, // 用户ID
        'friendID': fid // 好友ID
    }
    let updatestr = {
        'markname': name
    }
    Friend.findOneAndUpdate(wherestr, updatestr, { new: true }) // 更新好友昵称
    .then(result => {
        console.log('好友昵称更新成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '好友昵称更新成功！',
            data: result // 返回更新后的好友数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('好友昵称更新失败！'); // 返回失败信息给前端
    });
}

// 获取好友昵称
exports.getMarkName = function (data, res) {
    const { uid, fid } = data // 解构获取请求体中的数据
    let wherestr = {
        'userId': uid, // 用户ID
        'friendID': fid // 好友ID
    }
    let out = {
        'markname': 1 // 只查询好友昵称
    }
    Friend.findOne(wherestr, out) // 查询好友昵称
    .then(result => {
        console.log('查询成功！'); // 打印成功信息
        res.send({
            code: 200,
            msg: '查询成功！',
            data: result // 返回查询到的好友数据
        }); // 返回成功信息给前端
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 添加好友表
exports.buildFriend = function (uid, fid, state, res) {
    let data = {
        'userId': uid, // 用户ID
        'friendID': fid, // 好友ID
        'state': state, // 好友状态
        'time': new Date(), // 添加时间
        'lastTime': new Date(), // 最后聊天时间
    }
    let friend = new Friend(data) // 创建好友模型
    friend.save()
    .then(result => {
        console.log('添加好友成功！', result); // 打印成功信息
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('添加好友失败！'); // 返回失败信息给前端
    });
}

// 好友最后通讯时间
exports.updateFriendLastTime = function (data, res) {
    const { uid, fid } = data // 解构获取请求体中的数据
    let wherestr = {
        $or: [{
            'userId': uid, // 用户ID
            'friendID': fid // 好友ID
        }, {
            'userId': fid, // 用户ID
            'friendID': uid // 好友ID 
        }]
    }
    let updatestr = {
        'lastTime': new Date() // 更新最后通讯时间
    }
    console.log(Friend)
    Friend.updateMany(wherestr, updatestr) // 更新好友最后通讯时间
    .then(result => {
        // console.log('好友最后通讯时间更新成功！', result); // 打印成功信息
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('更新失败！'); // 返回失败信息给前端
    });
}

// 好友申请
exports.applyFriend = function (data, res) {
    // 判断是否已经申请过
    let wherestr = {
        'userId': data.uid, // 用户ID
        'friendID': data.fid, // 好友ID
    }
    Friend.countDocuments(wherestr) // 查询好友申请表是否有记录
    .then(count => {
        console.log('查询成功！'); // 打印成功信息
        if (count === 0) {
            this.buildFriend(data.uid, data.fid, 2, res) // 调用添加好友函数
            this.buildFriend(data.fid, data.uid, 1, res) // 调用添加好友函数
        } else {
            console.log('已申请过！'); // 打印失败信息
            this.updateFriendLastTime(data) // 更新最后通讯时间
        }
        // 需要引入消息服务
        const messageService = require('./messageService.js');
        messageService.insertMsg(data.uid, data.fid, data.msg, data.type, res) // 调用添加消息函数
    })
    .catch(err => {
        console.log(err); // 打印错误信息
        res.send('查询失败！'); // 返回失败信息给前端
    });
}

// 更新好友状态
exports.updateFriendState = function (data, res) {
    const { uid, fid } = data // 解构获取请求体中的数据
    let wherestr = {
        $or: [{
            'userId': uid, // 用户ID
            'friendID': fid // 好友ID
        }, {
            'userId': fid, // 用户ID
            'friendID': uid // 好友ID
        }]
    }
    Friend.updateMany(wherestr, {'state': 0 }) // 更新好友状态
    .then(result => {
        console.log('好友状态更新成功！', result); // 打印成功信息
        res.send({
            code: 200,
            msg: '好友状态更新成功！',
            data: result // 返回更新后的好友数据
        }); // 返回成功信息给前端
    })
}

// 拒绝或者删除好友
exports.deleteFriend = function (data, res) {
    const { uid, fid } = data // 解构获取请求体中的数据
    let wherestr = {
        $or: [{
            'userId': uid, // 用户ID
            'friendID': fid // 好友ID
        }, {
            'userId': fid, // 用户ID
            'friendID': uid // 好友ID
        }]
    }
    Friend.deleteMany(wherestr) // 删除好友
    .then(result => {
        console.log('删除好友成功！', result); // 打印成功信息
        res.send({
            code: 200,
            msg: '删除好友成功！',
            data: result // 返回删除后的好友数据
        }); // 返回成功信息给前端
    })
}

// 按要求获取用户列表
exports.getOnlyUsers = function(data, res) {
    return new Promise((resolve) => {
        const { uid, state } = data // 解构获取请求体中的数据
        return resolve(Friend.find({}).where({
            'userId': uid, // 用户ID
            'state': state // 好友状态
        })
        .populate('friendID')
        .sort({ 'lastTime': -1 }) // 按时间排序
        .exec())
    })
    .then(result => {
        let data = result.map(item => {
            return {
                id: item.friendID._id, // 好友ID
                name: item.friendID.name, // 好友名称
                imgurl: item.friendID.imgurl, // 好友头像
                markname: item.markname, // 好友备注名
                time: item.time, // 
                lastTime: item.lastTime, // 最后通讯时间
                chatType: 0 // 代表私聊
            }
        })
        if (res) {
            res.send({
                code: 200,
                msg: '查询成功！',
                data: data // 返回查询到的用户数据
            }) // 返回成功信息给前端
        }
        return Promise.resolve(data)
    })
    .catch(err => {
        if (res) {
            res.send('查询失败！'); // 返回失败信息给前端
        }
       return Promise.reject(err) // 返回错误信息
    });
} 