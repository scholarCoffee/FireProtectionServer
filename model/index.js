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
	types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-音频连接 3-位置
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
	types: { type: Number, default: 0 }, // 消息类型 0-文本 1-图片 2-音频连接 3-位置
	state: { type: Number, default: 1 }, // 消息状态 0-已读 1-未读
	time: { type: Date, default: Date.now } // 发送时间
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
	extraParam: { type: Schema.Types.Mixed, default: '' }
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
	safeId: { type: String, ref: 'FireSafetyScore', required: true }, // 关联消防安全评分的safeId
	defaultImg: { type: String }, // 默认图片
	description: { type: String, default: '' }, // 地址描述
	imgList: [{ type: String }], // 图片列表
	phoneList: [PhoneSchema],
	enterGateList: [GateSchema],
	// 新增字段（按前端合同）
	ownerQueryUrl: { type: String, default: '' }, // 户主查询URL
	fireUnitDeploymentMap: [{
		key: { type: String, required: true },
		value: { type: String, default: '' },
		data: { type: String, default: '' }
	}],
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
	safetyLevelId: { type: Number, required: true, enum: [1, 2, 3] }, // 安全等级ID 1-优秀 2-一般 3-较差
	safetyLevelName: { type: String, required: true }, // 安全等级名称
	safetyColor: { type: String, required: true }, // 安全颜色
	safetyCssClass: { type: String, required: true }, // CSS类名
	safetyCssColor: { type: String, required: true }, // CSS颜色值
	
	// 评分配置版本 - 用于追踪评分规则版本
	configVersion: { type: String, default: '1.0.0' },
	
	// 时间戳
	createTime: { type: Date, default: Date.now },
	updateTime: { type: Date, default: Date.now }
});

// 数据指挥功能配置表Schema
const CommandConfigSchema = new mongoose.Schema({
	configId: { type: String, required: true, unique: true }, // 配置唯一标识
	title: { type: String, required: true }, // 功能标题
	desc: { type: String, required: true }, // 功能描述
	url: { type: String, required: true }, // 访问地址
	status: { type: String, default: 'active', enum: ['active', 'inactive'] }, // 状态：active-活跃，inactive-非活跃
	order: { type: Number, default: 0 }, // 排序权重
	createTime: { type: Date, default: Date.now }, // 创建时间
	updateTime: { type: Date, default: Date.now } // 更新时间
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

CommandConfigSchema.pre('save', function(next) {
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
const FireSafetyScore = db.model('FireSafetyScore', FireSafetyScoreSchema, 'fireSafetyScore');
const StaticData = db.model('StaticData', StaticDataSchema, 'staticData');
const CommandConfig = db.model('CommandConfig', CommandConfigSchema, 'commandConfig');

// 统一导出模型
module.exports = {
	model: function(modelName) {
		const models = {
			'User': User,
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
	Message,
	Group,
	GroupUser,
	GroupMessage,
	Location,
	FireSafetyScore,
	StaticData,
	CommandConfig
};
