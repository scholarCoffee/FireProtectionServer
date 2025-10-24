const express = require('express');
const router = express.Router();
const dbServer = require('../dao/dbserver.js');

// 获取户主列表
router.get('/list', function (req, res) {
    dbServer.getOwnerList(req, res);
});

// 获取户主详情
router.get('/detail', function (req, res) {
    dbServer.getOwnerDetail(req, res);
});

// 创建户主信息
router.post('/save', function (req, res) {
    dbServer.createOwner(req, res);
});

// 更新户主信息
router.post('/update', function (req, res) {
    dbServer.updateOwner(req, res);
});

// 删除户主信息
router.post('/delete', function (req, res) {
    dbServer.deleteOwner(req, res);
});

module.exports = router;
