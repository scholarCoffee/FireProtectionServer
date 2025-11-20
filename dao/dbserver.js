// 数据库服务主文件 - 整合所有模块化服务
// 引入各个服务模块
const userService = require('./userService.js');
const messageService = require('./messageService.js');
const groupService = require('./groupService.js');
const locationService = require('./locationService.js');
const ownerService = require('./ownerService.js');
const aiService = require('./aiService.js');

// 导出所有服务方法
module.exports = {
	// 用户相关服务
	userDetail: userService.userDetail,
	userUpdate: userService.userUpdate,
	deleteUser: userService.deleteUser,
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
	addGroupMember: groupService.addGroupMember,
	removeGroupMember: groupService.removeGroupMember,
	updateGroup: groupService.updateGroup,

	// 地址相关服务
	getLocationList: locationService.getLocationList,
	getLocationDetail: locationService.getLocationDetail,
	getLocationById: locationService.getLocationById,
	addLocation: locationService.addLocation,
	updateLocation: locationService.updateLocation,
	deleteLocation: locationService.deleteLocation,
	getLocationStats: locationService.getLocationStats,
	checkAddressId: locationService.checkAddressId,
	reverseGeocode: locationService.reverseGeocode,

	// 户主信息相关服务
	getOwnerList: ownerService.getOwnerList,
	getOwnerDetail: ownerService.getOwnerDetail,
	createOwner: ownerService.createOwner,
	updateOwner: ownerService.updateOwner,
	deleteOwner: ownerService.deleteOwner,

	// AI 相关服务
	chat: aiService.chat,

};