const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const FireSituation = dbmodel.FireSituation;

// 上传火灾情况数据（新版：支持 assignedUnits 结构）
router.post('/upload', async (req, res) => {
    try {
        const {
            // 新版必填
            addressId,
            addressName,
            locationType,
            assignedUnits = [],
            remark,
            taskStatus,
            issuePersonId,
            issuePersonName,
            issueTime,
            updateTime
        } = req.body || {};

        // 基础必填校验（新版）
        if (!addressId || !addressName || typeof locationType === 'undefined' || !Array.isArray(assignedUnits) || assignedUnits.length === 0 || !issuePersonId || !issuePersonName || !issueTime) {
            return res.send({ code: 400, msg: '缺少必填字段（addressId/addressName/locationType/assignedUnits/issuePersonId/issuePersonName/issueTime）' });
        }

        // 细项校验 assignedUnits
        for (const unit of assignedUnits) {
            if (!unit.unitId || !unit.unitName) {
                return res.send({ code: 400, msg: 'assignedUnits 中存在缺少 unitId 或 unitName 的记录' });
            }
            if (!Array.isArray(unit.carInfo)) {
                return res.send({ code: 400, msg: 'assignedUnits.carInfo 必须为数组' });
            }
        }

        // 生成唯一情况ID
        const situationId = 'SITUATION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 创建新的火灾情况记录（核心以新版结构为准）
        const fireSituation = new FireSituation({
            situationId,
            addressId,
            addressName,
            locationType,
            taskStatus: typeof taskStatus === 'number' ? taskStatus : 2, // 默认救援中(2)
            remark: remark || '',
            assignedUnits, // 完整保存单位/车辆/任务配置
            issuePersonId,
            issuePersonName,
            issueTime: new Date(issueTime),
            updateTime: updateTime ? new Date(updateTime) : new Date()
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