// 数据库模型统一管理文件
const mongoose = require('mongoose');
const db = require('../config/db.js');
const Schema = mongoose.Schema;

// 定义 UserInfo 的 Schema
const UserSchema = new Schema({
    nickName: { type: String, required: true }, // 昵称
    signature: { type: String, required: true }, // 签名
    id: { type: String, require: true }, // id标签
    encryptedData: { type: String, required: true }, // 微信加密数据
    permissionStatus:{ type: Number, default: 1 }, // 权限实体
    code: { type: String }, // 微信code
    avatarUrl: { type: String }, // 头像地址
    register: { type: Date, default: Date.now }, // 注册时间
    updateTime: { type: Date, default: Date.now } // 更新时间
});

// 好友表
const FriendSchema = new Schema({
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
    friendID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 好友ID
    markname: { type: String }, // 好友昵称
    state: { type: Number, required: true }, // 好友状态 0-已为好友 1-申请中 2-申请发送对方，对方未同意
    time: { type: Date, default: Date.now }, // 生成时间
    lastTime: { type: Date, default: Date.now } // 最后一次聊天时间
});

// 一对一消息表
const MessageSchema = new Schema({
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
    friendID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 好友ID
    message: { type: String, required: true }, // 消息内容
    types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-音频连接 3-位置
    time: { type: Date, default: Date.now }, // 发送时间
    state: { type: Number, default: 1 } // 消息状态 0-已读 1-未读
});

// 群表
const GroupSchema = new Schema({
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 创建者ID
    name: { type: String, required: true }, // 群名称
    markname: { type: String, default: '' }, // 群备注名
    imgurl: { type: String, default: '/group/group.png' }, // 群头像地址
    time: { type: Date, default: Date.now }, // 创建时间
    notice: { type: String, default: '' }, // 群公告
    updateTime: { type: Date, default: Date.now } // 更新时间
});

// 群成员表
const GroupUserSchema = new Schema({
    groupID: { type: Schema.Types.ObjectId, ref: 'Group', required: true }, // 群ID
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
    name: { type: String }, // 群内昵称
    state: { type: Number, default: 1 }, // 消息状态 0-已读 1-未读
    time: { type: Date, default: Date.now }, // 加入时间
    lastTime: { type: Date, default: Date.now }, // 最后一次聊天时间
    shield: { type: Number, default: 0 } // 是否屏蔽 0-不屏蔽 1-屏蔽
});

// 群消息表
const GroupMessageSchema = new Schema({
    groupID: { type: Schema.Types.ObjectId, ref: 'Group', required: true }, // 群ID
    userID: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
    message: { type: String, required: true }, // 消息内容
    types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-音频连接 3-位置
    time: { type: Date, default: Date.now } // 发送时间
});

// 地址信息相关 Schema
// 联系电话子模型
const PhoneSchema = new Schema({
    phone: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: Number, required: true } // 1-单位负责人 2-消防负责人
}, { _id: false });

// 进出口子模型
const GateSchema = new Schema({
    name: { type: String, required: true },
    type: { type: Number, required: true } // 1-东门 2-南门 3-西门 4-北门
}, { _id: false });

// 地址信息主模型
const LocationSchema = new Schema({
    addressId: { type: String, required: true, unique: true },
    addressName: { type: String, required: true },
    addressExt: { type: String, required: true },
    allSenceLink: { type: String },
    type: { type: Number, required: true }, // 1-高层小区 2-重点单位 3-沿街商铺
    safeLevelId: { type: Number, required: true }, // 1-优秀 2-良好 3-一般 4-较差
    safeLevelName: { type: String, required: true },
    safeLevelDesc: { type: String, required: true },
    phoneList: [PhoneSchema],
    enterGateList: [GateSchema],
    createTime: { type: Date, default: Date.now },
    updateTime: { type: Date, default: Date.now }
});

// 添加中间件
UserSchema.pre('save', function(next) {
    this.updateTime = new Date();
    next();
});

GroupSchema.pre('save', function(next) {
    this.updateTime = new Date();
    next();
});

LocationSchema.pre('save', function(next) {
    this.updateTime = new Date();
    next();
});

// 创建模型
const User = db.model('User', UserSchema, 'userInfo');
const Friend = db.model('Friend', FriendSchema, 'friend');
const Message = db.model('Message', MessageSchema, 'message');
const Group = db.model('Group', GroupSchema, 'group');
const GroupUser = db.model('GroupUser', GroupUserSchema, 'groupUser');
const GroupMessage = db.model('GroupMessage', GroupMessageSchema, 'groupMessage');
const Location = db.model('Location', LocationSchema, 'location');

// 统一导出模型
module.exports = {
    model: function(modelName) {
        const models = {
            'User': User,
            'Friend': Friend,
            'Message': Message,
            'Group': Group,
            'GroupUser': GroupUser,
            'GroupMessage': GroupMessage,
            'Location': Location
        };
        return models[modelName];
    },
    // 直接导出模型
    User,
    Friend,
    Message,
    Group,
    GroupUser,
    GroupMessage,
    Location
};
