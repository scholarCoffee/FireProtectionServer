const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const StaticData = dbmodel.StaticData;

// 获取静态配置：根据 type + key，返回多条 [{ description, data1..data4, extraParam, config }]
router.get('/data', async (req, res) => {
    try {
        const { type, key } = req.query || {};
        if (!type || !key) {
            return res.send({ code: 400, msg: '缺少type或key参数' });
        }
        const records = await StaticData.find({ type, key }).lean();
        if (!records || records.length === 0) {
            return res.send({ code: 200, msg: 'ok', data: [] });
        }
        return res.send({ code: 200, msg: 'ok', data: records });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});
module.exports = router;


