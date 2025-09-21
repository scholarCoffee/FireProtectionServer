const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const FireSituation = dbmodel.FireSituation;

// 上传火灾情况数据
router.post('/upload', async (req, res) => {
    try {
        const {
            fireUnit,
            fireCar,
            addressId,
            addressName,
            locationType,
            rescueFloor,
            direction,
            taskType,
            taskStatus,
            taskExtra,
            remark,
            issuePersonId,
            issuePersonName,
            issueTime
        } = req.body;

        // 验证必填字段
        if (!fireUnit || !fireCar || !addressId || !addressName || !locationType || !taskType || !taskStatus || !issuePersonId || !issuePersonName || !issueTime) {
            return res.send({ code: 400, msg: '缺少必填字段' });
        }

        // 生成唯一情况ID
        const situationId = 'SITUATION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 创建新的火灾情况记录
        const fireSituation = new FireSituation({
            situationId,
            fireUnit,
            fireCar,
            addressId,
            addressName,
            locationType,
            rescueFloor: rescueFloor || '',
            direction: direction || '',
            taskType,
            taskStatus,
            taskExtra: taskExtra || {},
            remark: remark || '',
            issuePersonId,
            issuePersonName,
            issueTime: new Date(issueTime),
            updateTime: new Date()
        });

        await fireSituation.save();
        res.send({ code: 200, msg: '上传成功', data: fireSituation });
    } catch (err) {
        res.send({ code: 500, msg: '上传失败', error: err.message });
    }
});

// 查询火灾情况数据
router.get('/list', async (req, res) => {
    try {
        const { page = 1, limit = 10, addressId, taskType, taskStatus } = req.query;
        
        // 构建查询条件
        const query = {};
        if (addressId) query.addressId = addressId;
        if (taskType) query.taskType = taskType;
        if (taskStatus) query.taskStatus = taskStatus;
        
        // 分页查询
        const skip = (page - 1) * limit;
        const situations = await FireSituation.find(query)
            .sort({ issueTime: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const total = await FireSituation.countDocuments(query);
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: situations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

// 更新火灾情况数据
router.put('/situations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        // 移除不允许更新的字段
        delete updateData._id;
        delete updateData.situationId;
        delete updateData.createTime;
        updateData.updateTime = new Date();
        
        const situation = await FireSituation.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关记录' });
        }
        
        res.send({ code: 200, msg: '更新成功', data: situation });
    } catch (err) {
        res.send({ code: 500, msg: '更新失败', error: err.message });
    }
});

// 删除火灾情况数据
router.delete('/situations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const situation = await FireSituation.findByIdAndDelete(id);
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关记录' });
        }
        
        res.send({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.send({ code: 500, msg: '删除失败', error: err.message });
    }
});

module.exports = router;