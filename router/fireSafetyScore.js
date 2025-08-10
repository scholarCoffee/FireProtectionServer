const express = require('express');
const router = express.Router();
const fireSafetyScoreService = require('../dao/fireSafetyScoreService.js');

// 获取消防安全评分列表
router.get('/list', fireSafetyScoreService.getFireSafetyScoreList);

// 获取消防安全评分详情
router.get('/detail', fireSafetyScoreService.getFireSafetyScoreDetail);

// 获取评分配置
router.get('/config', fireSafetyScoreService.getScoreConfig);

// 获取统计信息
router.get('/stats', fireSafetyScoreService.getFireSafetyScoreStats);

// 新增消防安全评分
router.post('/add', fireSafetyScoreService.addFireSafetyScore);

// 根据addressId新增消防安全评分
router.post('/add-by-address', fireSafetyScoreService.addFireSafetyScoreByAddressId);

// 更新消防安全评分
router.post('/update', fireSafetyScoreService.updateFireSafetyScore);

// 删除消防安全评分
router.delete('/delete/:safeId', fireSafetyScoreService.deleteFireSafetyScore);

// 批量导入评分数据
router.post('/batch-import', fireSafetyScoreService.batchImportScores);

module.exports = router; 