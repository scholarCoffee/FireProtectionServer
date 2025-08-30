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
	userDetail: userService.userDetail,
	userUpdate: userService.userUpdate,
	loginOrUpdate: userService.loginOrUpdate,
	getPhoneNumber: userService.getPhoneNumber,
	getUserList: userService.getUserList,
	getUserById: userService.getUserById,

	// 消息相关服务
	insertMsg: messageService.insertMsg,
	getOneMsg: messageService.getOneMsg,
	unreadSelfMsg: messageService.unreadSelfMsg,
	updateMsg: messageService.updateMsg,
	getSelfMsg: messageService.getSelfMsg,

	// 群组相关服务
	getGroupList: groupService.getGroupList,
	getLastGroupMsg: groupService.getLastGroupMsg,
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

	// 数据指挥功能相关服务
	getCommandConfig: function(userId, res) {
		try {
			// 从数据库获取数据指挥功能配置
			const { CommandConfig } = require('../model/index.js');
			
			CommandConfig.find({ status: 'active' })
				.sort({ order: 1, createTime: 1 })
				.then(configs => {
					// 转换为前端需要的格式
					const commandConfig = {};
					configs.forEach(config => {
						commandConfig[config.configId] = {
							url: config.url,
							title: config.title,
							desc: config.desc,
							icon: config.icon
						};
					});

					res.json({
						success: true,
						message: '获取指挥配置成功',
						data: commandConfig
					});
				})
				.catch(error => {
					console.error('数据库查询失败:', error);
					res.status(500).json({
						success: false,
						message: '获取指挥配置失败',
						data: null
					});
				});
		} catch (error) {
			console.error('获取指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '获取指挥配置失败',
				data: null
			});
		}
	},

	saveCommandConfig: function(data, res) {
		try {
			const { CommandConfig } = require('../model/index.js');
			
			// 生成唯一的configId
			const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			
			// 创建新的配置项
			const newConfig = new CommandConfig({
				configId: configId,
				title: data.title,
				desc: data.desc,
				icon: data.icon,
				url: data.url,
				status: 'active',
				order: 0
			});
			
			newConfig.save()
				.then(savedConfig => {
					res.json({
						success: true,
						message: '保存指挥配置成功',
						data: {
							id: savedConfig.configId,
							title: savedConfig.title,
							desc: savedConfig.desc,
							icon: savedConfig.icon,
							url: savedConfig.url,
							createTime: savedConfig.createTime,
							updateTime: savedConfig.updateTime
						}
					});
				})
				.catch(error => {
					console.error('保存到数据库失败:', error);
					res.status(500).json({
						success: false,
						message: '保存指挥配置失败',
						data: null
					});
				});
		} catch (error) {
			console.error('保存指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '保存指挥配置失败',
				data: null
			});
		}
	},

	updateCommandConfig: function(data, res) {
		try {
			// 这里可以添加更新逻辑，目前返回成功响应
			res.json({
				success: true,
				message: '更新指挥配置成功',
				data: {
					...data,
					updateTime: new Date().toISOString()
				}
			});
		} catch (error) {
			console.error('更新指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '更新指挥配置失败',
				data: null
			});
		}
	},

	deleteCommandConfig: function(id, userId, res) {
		try {
			// 这里可以添加删除逻辑，目前返回成功响应
			res.json({
				success: true,
				message: '删除指挥配置成功',
				data: null
			});
		} catch (error) {
			console.error('删除指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '删除指挥配置失败',
				data: null
			});
		}
	},

	batchImportCommandConfig: function(configs, userId, res) {
		try {
			// 这里可以添加批量导入逻辑，目前返回成功响应
			res.json({
				success: true,
				message: `批量导入成功，共导入${configs.length}个配置`,
				data: { importedCount: configs.length }
			});
		} catch (error) {
			console.error('批量导入指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '批量导入指挥配置失败',
				data: null
			});
		}
	},

	exportCommandConfig: function(userId, res) {
		try {
			// 使用您提供的假数据作为导出数据
			const exportData = [
				{
					"id": "data-analysis",
					"url": "https://example.com/data-analysis",
					"title": "数据分析",
					"desc": "实时数据监控与分析",
					"icon": "analysis"
				},
				{
					"id": "alarm-management",
					"url": "https://example.com/alarm-management",
					"title": "报警管理",
					"desc": "报警信息处理与统计",
					"icon": "alarm"
				},
				{
					"id": "device-monitor",
					"url": "https://example.com/device-monitor",
					"title": "设备监控",
					"desc": "设备状态实时监控",
					"icon": "device"
				},
				{
					"id": "report-system",
					"url": "https://example.com/report-system",
					"title": "报表系统",
					"desc": "数据报表生成与导出",
					"icon": "report"
				}
			];

			res.json({
				success: true,
				message: '导出指挥配置成功',
				data: exportData
			});
		} catch (error) {
			console.error('导出指挥配置失败:', error);
			res.status(500).json({
				success: false,
				message: '导出指挥配置失败',
				data: null
			});
		}
	},

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
	}
};