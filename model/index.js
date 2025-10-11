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
	permissionStatus: { type: Number, default: 0 }, // 权限状态：0-普通用户，1-管理员，2-超级管理员
	code: { type: String }, // 微信code
	avatarUrl: { type: String }, // 头像地址
	phone: { type: String }, // 手机号
	permissions: {
		groupChat: { type: Boolean, default: false }, // 群聊权限
		settings: { type: Boolean, default: false }, // 设置权限
		admin: { type: Boolean, default: false } // 权限管理权限
	},
	status: { type: String, default: 'active' }, // 用户状态：active-正常，inactive-禁用，pending-待审核
	register: { type: Date, default: Date.now }, // 注册时间
	updateTime: { type: Date, default: Date.now } // 更新时间
});

// 一对一消息表
const MessageSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
	friendId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 好友ID
	message: { type: String, required: true }, // 消息内容
	types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-语音连接 3-位置
	time: { type: Date, default: Date.now }, // 发送时间
	state: { type: Number, default: 1 } // 消息状态 0-已读 1-未读
});

// 群表
const GroupSchema = new Schema({
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 创建者ID
	name: { type: String, required: true }, // 群名称
	imgUrl: { type: String, default: '/group/group.png' }, // 群头像地址
	time: { type: Date, default: Date.now }, // 创建时间
	notice: { type: String, default: '' }, // 群公告
	updateTime: { type: Date, default: Date.now } // 更新时间
});

// 群成员表
const GroupUserSchema = new Schema({
	groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true }, // 群ID
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
	name: { type: String }, // 群内昵称
	time: { type: Date, default: Date.now }, // 加入时间
	lastTime: { type: Date, default: Date.now } // 最后一次聊天时间
});

// 群消息表
const GroupMessageSchema = new Schema({
	groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true }, // 群ID
	userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // 用户ID
	message: { type: String, required: true }, // 消息内容
	types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-语音连接 3-位置
	state: { type: Number, default: 1 }, // 消息状态 0-已读 1-未读
	time: { type: Date, default: Date.now }, // 发送时间
	voiceTime: { type: Number, default: 0 } // 语音时长（秒）
});

// 静态配置表（通用字典/下拉），按 type + key 查询
const StaticDataSchema = new Schema({
	type: { type: String, required: true }, // 例如 fireUnits、xxxConfig
	key: { type: String, required: true },  // 业务键
	description: { type: String, default: '' },
	data1: { type: String, default: '' },
	data2: { type: String, default: '' },
	data3: { type: String, default: '' },
	data4: { type: String, default: '' },
	extraParam: { type: Schema.Types.Mixed, default: '' },
	config: { type: Schema.Types.Mixed, default: null } // 任务配置信息
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
	addressId: { type: String, required: true, unique: true }, // 地址ID
	addressName: { type: String, required: true }, // 地址名称
	addressExt: { type: String, required: true }, // 地址扩展信息
	allSenceLink: { type: String }, // 全景链接
	type: { type: Number, required: true }, // 1-高层小区 2-重点单位 3-沿街商铺
	safeId: { type: String, ref: 'FireSafetyScore', required: true }, // 关联消防安全评分的safeId
	defaultImg: { type: String }, // 默认图片
	description: { type: String, default: '' }, // 地址描述
	imgList: [{ type: String }], // 图片列表
	phoneList: [PhoneSchema],
	enterGateList: [GateSchema],
	// 新增字段（按前端合同）
	fireUnitDeploymentMap: [{
		key: { type: String, required: true },
		value: { type: String, default: '' },
		data: { type: String, default: '' }
	}],
	createTime: { type: Date, default: Date.now },
	updateTime: { type: Date, default: Date.now }
});

// 户主信息表Schema
const OwnerInfoSchema = new Schema({
	addressId: { type: String, ref: 'Location', required: true }, // 关联地址ID
	building: { type: String, default: '' }, // 栋（选填）
	unit: { type: String, default: '' }, // 单元（选填）
	floor: { type: String, default: '' }, // 楼层（选填）
	roomNo: { type: String, required: true }, // 房间号（必填）
	name: { type: String, required: true }, // 住户姓名（必填）
	phone: { type: String, required: true }, // 住户电话（必填）
	status: { type: Number, required: true, enum: [0, 1, 2] }, // 住户情况：0-房间无人 1-房间有人 2-房间不确定
	peopleCount: { type: Number, default: 0 }, // 房间人数（当status=1时必填，1-100）
	area: { type: String, default: '' }, // 房间大小（㎡），支持小数点后两位
	remark: { type: String, default: '' }, // 备注信息
	createTime: { type: Date, default: Date.now },
	updateTime: { type: Date, default: Date.now }
});

// 消防安全评分表Schema - 动态字段设计
const FireSafetyScoreSchema = new mongoose.Schema({
	safeId: { type: String, required: true, unique: true }, // 关联safeId
	addressId: { type: String, ref: 'Location', required: true }, // 关联地址ID
	addressName: { type: String, required: true }, // 地址名称
	
	// 动态评分项目 - 使用Map存储，支持任意评分项
	scoreItems: {
		type: Map,
		of: {
			score: { type: Number, required: true }, // 得分
			option: { type: String, required: true }, // 选择的选项文本
			itemId: { type: String, required: true }, // 评分项ID
			remark: { type: String, default: '' } // 备注信息
		},
		default: new Map()
	},
	
	// 计算结果
	totalScore: { type: Number, required: true }, // 总分
	maxPossibleScore: { type: Number, required: true }, // 最高可能分数
	scorePercentage: { type: Number, required: true }, // 得分百分比
	
	// 安全等级信息
	safeLevelId: { type: Number, required: true, enum: [1, 2, 3] }, // 安全等级ID 1-优秀 2-一般 3-较差
	safeLevelName: { type: String, required: true }, // 安全等级名称
	
	// 时间戳
	createTime: { type: Date, default: Date.now },
	updateTime: { type: Date, default: Date.now }
});

// 火灾情况表Schema
const FireSituationSchema = new mongoose.Schema({
    situationId: { type: String, required: true, unique: true }, // 火灾情况唯一ID
    addressId: { type: String, required: true }, // 地址ID
    addressName: { type: String, required: true }, // 地址名称
    locationType: { type: Number, required: true }, // 位置类型
    taskStatus: { type: Number, enum: [1, 2, 3, 4], default: 2 }, // 任务状态：1-已完成 2-救援中 3-需要支援 4-正在支援
    remark: { type: String, default: '' }, // 备注
    assignedUnits: [{
        unitId: { type: String, required: true }, // 单位ID
        unitName: { type: String, required: true }, // 单位名称
        rescueFloor: { type: String, default: '' }, // 救援楼层（可选）
        direction: { type: Number, default: 0 }, // 方向（枚举数字，前端定义）
        taskType: { type: String, default: '' }, // 任务类型（字符串/枚举编码）
        taskExtra: { type: Schema.Types.Mixed, default: {} }, // 任务额外信息（根据任务类型动态存储）
        // 单位状态：rescue-首次救援单位，support-支援单位
        unitStatus: { type: String, enum: ['rescue', 'support'], default: 'rescue' },
        // 救援时间
        rescueTime: { type: Date, default: Date.now },
		// taskId
		taskId: { type: String, default: '' }, // 任务ID
        carInfo: [{
            label: { type: String, required: true },
            value: { type: String, required: true },
            index: { type: Number, required: true }
        }]
    }],
    issuePersonId: { type: String, required: true }, // 下达人ID
    issuePersonName: { type: String, required: true }, // 下达人姓名
    issueTime: { type: Date, required: true }, // 下达时间
    updateTime: { type: Date, required: true } // 更新时间
});

// 作战任务表Schema（与FireSituationSchema保持一致）
const TaskAssignSchema = new mongoose.Schema({
	taskId: { type: String, required: true, unique: true }, // 任务唯一ID
	// 关联火情
	situationId: { type: String, required: true }, // 关联的火灾情况ID
	status: { type: Number, enum: [1, 2], default: 1 }, // 任务状态：1-未接收, 2-已接收
	remark: { type: String, default: '' }, // 备注
	feedbackPersonId: { type: String, required: true }, // 下达人ID
    feedbackPersonName: { type: String, required: true }, // 下达人姓名
    feedbackTime: { type: Date, required: true }, // 下达时间
	updateTime: { type: Date, required: true } // 更新时间
});

// 消防单位占用状态表Schema
const FireUnitStatusSchema = new mongoose.Schema({
	unitId: { type: String, required: true, unique: true }, // 单位ID
	unitName: { type: String, required: true }, // 单位名称
	status: { type: String, required: true, enum: ['idle', 'occupied'], default: 'idle' }, // 占用状态：idle-空闲，occupied-占用中
	currentTaskId: { type: String, default: '' }, // 当前任务ID
	currentSituationId: { type: String, default: '' }, // 当前火情ID
	occupyTime: { type: Date }, // 占用时间
	releaseTime: { type: Date }, // 释放时间
	remark: { type: String, default: '' }, // 备注
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

OwnerInfoSchema.pre('save', function(next) {
	this.updateTime = new Date();
	next();
});

FireSafetyScoreSchema.pre('save', function(next) {
	this.updateTime = new Date();
	next();
});

FireSituationSchema.pre('save', function(next) {
	this.updateTime = new Date();
	next();
});

TaskAssignSchema.pre('save', function(next) {
	this.updateTime = new Date();
	next();
});

FireUnitStatusSchema.pre('save', function(next) {
	this.updateTime = new Date();
	next();
});

// 创建模型
const User = db.model('User', UserSchema, 'userInfo');
const Message = db.model('Message', MessageSchema, 'message');
const Group = db.model('Group', GroupSchema, 'group');
const GroupUser = db.model('GroupUser', GroupUserSchema, 'groupUser');
const GroupMessage = db.model('GroupMessage', GroupMessageSchema, 'groupMessage');
const Location = db.model('Location', LocationSchema, 'location');
const OwnerInfo = db.model('OwnerInfo', OwnerInfoSchema, 'ownerInfo');
const FireSafetyScore = db.model('FireSafetyScore', FireSafetyScoreSchema, 'fireSafetyScore');
const StaticData = db.model('StaticData', StaticDataSchema, 'staticData');
const FireSituation = db.model('FireSituation', FireSituationSchema, 'fireSituation');
const TaskAssign = db.model('TaskAssign', TaskAssignSchema, 'taskAssign');
const FireUnitStatus = db.model('FireUnitStatus', FireUnitStatusSchema, 'fireUnitStatus');

// 统一导出模型
module.exports = {
	User,
	Message,
	Group,
	GroupUser,
	GroupMessage,
	Location,
	OwnerInfo,
	FireSafetyScore,
	StaticData,
	FireSituation,
	TaskAssign,
	FireUnitStatus,
};