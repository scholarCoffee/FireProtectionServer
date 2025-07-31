const express = require('express');
const router = express.Router();
const whitelistUserService = require('../dao/whitelistUserService.js');

// 获取手机号（微信小程序解密）
router.post('/getPhoneNumber', whitelistUserService.getPhoneNumber);

// 创建白名单用户
router.post('/create', whitelistUserService.createWhitelistUser);

// 获取用户列表
router.get('/list', whitelistUserService.getUserList);

// 获取用户详情
router.get('/detail/:userId', whitelistUserService.getUserDetail);

// 更新用户信息
router.put('/update/:userId', whitelistUserService.updateUserInfo);

// 删除用户
router.delete('/delete/:userId', whitelistUserService.deleteUser);

// 获取用户统计信息
router.get('/stats', whitelistUserService.getUserStats);

module.exports = router; 