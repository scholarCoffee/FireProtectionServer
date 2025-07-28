const dbServer = require('./dbServer')

module.exports = function(io) {
    const users = {}
    io.on('connection', socket => {
        socket.on('login', id => {
            console.log('用户登录：', id)
            socket.name = id
            if (!users[id]) {
                users[id] = socket.id // 将用户id和socket.id存储在users对象中
            }
        })

        socket.on('msgServer', ({messageInfo, fromId, toId}) => {
            console.log('发送消息：', messageInfo)
            console.log('发送用户：', fromId)
            console.log('接收用户：', toId)
            dbServer.updateFriendLastTime({ uid: fromId, fid: toId })
            dbServer.insertMsg(fromId, toId, messageInfo.message, messageInfo.types)
            if (users[toId]) {
                socket.to(users[toId]).emit('msgFront', messageInfo, fromId) // 发送给其他客户端
            }
            socket.emit('msgFront', messageInfo, toId) // 发送给自己
        })

        socket.on('disconnecting', () => {
            console.log('用户断开连接:', socket.id) // 打印断开连接的socket.id
            if (users.hasOwnProperty(socket.name)) {
                // 从users对象中删除断开连接的用户
                delete users[socket.name]

            }
            console.log('当前在线用户:', users) // 打印当前在线用户
        })

        socket.on('groupServer', id => {
            console.log('准备加入群组:', id)
            // 当前已经加入无需加入
            if (socket.rooms.has(id)) {
                console.log('已经加入该群组:', id)
                return
            }
            socket.join(id) // 加入群组
        })

        socket.on('groupMsgServer', data => {
            console.log('发送群组消息：', JSON.stringify(data))
            const { messageInfo, userId, userName, userAvatar, groupId, nickName, avatarUrl, time } = data
            // 插入群组消息
            dbServer.insertGroupMsg({
                groupId: groupId,
                userId: userId,
                message: messageInfo.message,
                types: messageInfo.types,
                time: time,
                state: 1
            })
            dbServer.updateGroupMessageLastTime({ 
                groupId: groupId,
                userId: userId,
                name: nickName,
                time: time
            }) // 更新最后一条消息时间
            socket.to(groupId).emit('groupMsgFront', {
                messageInfo: messageInfo,
                userId: userId,
                groupId: groupId,
                nickName: nickName,
                avatarUrl: avatarUrl,
                userName: userName,
                userAvatar: userAvatar
            }) // 发送给其他客户端
            socket.emit('groupMsgFront', {
                messageInfo: messageInfo,
                userId: userId,
                groupId: groupId,
                nickName: nickName,
                avatarUrl: avatarUrl,
                userName: userName,
                userAvatar: userAvatar
            }) // 发送给自己
        })

        /**
         * 离开聊天室
         * @param {*} userId 用户ID
         * @param {*} fromId 发送者ID
         * @param {*} type 聊天类型 0-好友 1-群组
         */
        socket.on('leaveChatRoomServer', async (userId, fromId, type) => {
            // 离开聊天室
            console.log('离开聊天室：', userId, fromId, type)
            let tip = {}
            // 统计未读消息数量
            if (type == 1) {
                tip = await dbServer.updateGroupMsg({ userId: userId, groupId: fromId })
                console.log('更新群消息状态成功！', tip)
            }
            socket.emit('leaveChatRoomFront', userId, fromId, type, tip.matchedCount) // 发送离开聊天室的消息
        })
    })
}