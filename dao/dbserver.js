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
	updateUserPermission: userService.updateUserPermission,
	updateUserRole: userService.updateUserRole,

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
	getGroupDetail: groupService.getGroupDetail,

	// 地址相关服务
	getLocationList: locationService.getLocationList,
	getLocationDetail: locationService.getLocationDetail,
	getLocationById: locationService.getLocationById,
	addLocation: locationService.addLocation,
	updateLocation: locationService.updateLocation,
	deleteLocation: locationService.deleteLocation,
	getLocationStats: locationService.getLocationStats,

	// 数据指挥功能相关服务
	getCommandConfig: function(res) {
		try {
			// 从数据库获取数据指挥功能配置
			const { CommandConfig } = require('../model/index.js');
			
			CommandConfig.find({ status: 'active' })
				.sort({ order: 1, createTime: 1 })
				.then(configs => {
					res.send({
						code: 200,
						msg: '获取指挥配置成功',
						data: configs
					});
				})
				.catch(error => {
					console.error('数据库查询失败:', error);
					res.send({
						code: 500,
						msg: '获取指挥配置失败',
						data: null
					});
				});
		} catch (error) {
			console.error('获取指挥配置失败:', error);
			res.send({
				code: 500,
				msg: '获取指挥配置失败',
				data: null
			});
		}
	},

	saveCommandConfig: function(data, res) {
		try {
			const { CommandConfig } = require('../model/index.js');
			
			// 如果传递了configId，则进行修改操作
			if (data.configId) {
				// 修改现有配置
				CommandConfig.findOneAndUpdate(
					{ configId: data.configId },
					{
						title: data.title,
						desc: data.desc,
						url: data.url,
						updateTime: new Date()
					},
					{ new: true }
				)
				.then(updatedConfig => {
					if (!updatedConfig) {
						return res.send({
							code: 404,
							msg: '配置不存在',
							data: null
						});
					}
					
					res.send({
						code: 200,
						msg: '修改指挥配置成功',
						data: {
							id: updatedConfig.configId,
							title: updatedConfig.title,
							desc: updatedConfig.desc,
							url: updatedConfig.url,
							createTime: updatedConfig.createTime,
							updateTime: updatedConfig.updateTime
						}
					});
				})
				.catch(error => {
					console.error('修改数据库失败:', error);
					res.send({
						code: 500,
						msg: '修改指挥配置失败',
						data: null
					});
				});
			} else {
				// 生成唯一的configId并创建新配置
				const configId = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
				
				// 创建新的配置项
				const newConfig = new CommandConfig({
					configId: configId,
					title: data.title,
					desc: data.desc,
					url: data.url,
					status: 'active',
					order: 0
				});
				
				newConfig.save()
					.then(savedConfig => {
						res.send({
							code: 200,
							msg: '保存指挥配置成功',
							data: {
								id: savedConfig.configId,
								title: savedConfig.title,
								desc: savedConfig.desc,
								url: savedConfig.url,
								createTime: savedConfig.createTime,
								updateTime: savedConfig.updateTime
							}
						});
					})
					.catch(error => {
						console.error('保存到数据库失败:', error);
						res.send({
							code: 500,
							msg: '保存指挥配置失败',
							data: null
						});
					});
			}
		} catch (error) {
			console.error('保存指挥配置失败:', error);
			res.send({
				code: 500,
				msg: '保存指挥配置失败',
				data: null
			});
		}
	},

	updateCommandConfig: function(data, res) {
		try {
			const { CommandConfig } = require('../model/index.js');
			
			CommandConfig.findOneAndUpdate(
				{ configId: data.id },
				{
					title: data.title,
					desc: data.desc,
					url: data.url,
					updateTime: new Date()
				},
				{ new: true }
			)
			.then(updatedConfig => {
				if (!updatedConfig) {
					return res.send({
						code: 404,
						msg: '配置不存在',
						data: null
					});
				}
				
				res.send({
					code: 200,
					msg: '更新指挥配置成功',
					data: {
						id: updatedConfig.configId,
						title: updatedConfig.title,
						desc: updatedConfig.desc,
						url: updatedConfig.url,
						updateTime: updatedConfig.updateTime
					}
				});
			})
			.catch(error => {
				console.error('数据库更新失败:', error);
				res.send({
					code: 500,
					msg: '更新指挥配置失败',
					data: null
				});
			});
		} catch (error) {
			console.error('更新指挥配置失败:', error);
			res.send({
				code: 500,
				msg: '更新指挥配置失败',
				data: null
			});
		}
	},

	deleteCommandConfig: function(configId, res) {
		try {
			const { CommandConfig } = require('../model/index.js');
			
			CommandConfig.deleteOne({ configId: configId })
			.then(deletedConfig => {
				if (!deletedConfig) {
					return res.send({
						code: 404,
						msg: '配置不存在',
						data: null
					});
				}
				
				res.send({
					code: 200,
					msg: '删除指挥配置成功',
					data: null
				});
			})
			.catch(error => {
				console.error('数据库删除失败:', error);
				res.send({
					code: 500,
					msg: '删除指挥配置失败',
					data: null
				});
			});
		} catch (error) {
			console.error('删除指挥配置失败:', error);
			res.send({
				code: 500,
				msg: '删除指挥配置失败',
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