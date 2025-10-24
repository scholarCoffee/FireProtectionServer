const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const TaskAssign = dbmodel.TaskAssign;
const FireSituation = dbmodel.FireSituation;
const FireUnitStatus = dbmodel.FireUnitStatus;

// 创建作战任务（基于火情情况）
router.post('/create', async (req, res) => {
    try {
        const {
            situationId,
            addressId,
            addressName,
            locationType,
            assignedUnits = [],
            remark,
            taskStatus,
            issuePersonId,
            issuePersonName,
            issueTime
        } = req.body;

        // 验证必填字段
        if (!situationId || !addressId || !addressName || typeof locationType === 'undefined' || !Array.isArray(assignedUnits) || assignedUnits.length === 0 || !issuePersonId || !issuePersonName || !issueTime) {
            return res.send({ code: 400, msg: '缺少必填字段（situationId/addressId/addressName/locationType/assignedUnits/issuePersonId/issuePersonName/issueTime）' });
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

        // 生成唯一任务ID
        const taskId = 'TASK_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 确保 assignedUnits 中每个单位都有 unitStatus 和 rescueTime
        const processedAssignedUnits = assignedUnits.map(unit => ({
            ...unit,
            unitStatus: unit.unitStatus || 'rescue', // 默认首次救援单位
            rescueTime: unit.rescueTime || new Date() // 默认当前时间
        }));

        // 创建新的作战任务
        const taskAssign = new TaskAssign({
            taskId,
            situationId,
            addressId,
            addressName,
            locationType,
            taskStatus: typeof taskStatus === 'number' ? taskStatus : 2, // 默认救援中(2)
            remark: remark || '',
            assignedUnits: processedAssignedUnits,
            issuePersonId,
            issuePersonName,
            issueTime: new Date(issueTime),
            feedbackStatus: 'unreceived',
            updateTime: new Date()
        });

        await taskAssign.save();
        res.send({ code: 200, msg: '任务创建成功', data: taskAssign });
    } catch (err) {
        res.send({ code: 500, msg: '任务创建失败', error: err.message });
    }
});

// 查询作战任务列表
router.get('/list', async (req, res) => {
    try {
        const { 
            page = 1, limit = 10, pageSize = 10, 
            addressId, taskStatus, unitStatus, unitId,
            unit, status, startTime, endTime, feedbackPersonName, keyword
        } = req.query;
        
        // 使用pageSize或limit作为分页大小
        const pageSizeNum = parseInt(pageSize) || parseInt(limit) || 10;
        
        // 构建查询条件
        const query = {};
        if (addressId) query.addressId = addressId;
        if (taskStatus) query.taskStatus = taskStatus;
        if (unitStatus) query['assignedUnits.unitStatus'] = unitStatus;
        if (unitId) query['assignedUnits.unitId'] = unitId;
        
        // 消防单位查询（支持按ID或名称查询）
        if (unit) {
            // 如果unit是纯数字，按unitId查询；否则按unitName模糊查询
            if (/^\d+$/.test(unit)) {
                query['assignedUnits.unitId'] = unit;
            } else {
                query['assignedUnits.unitName'] = { $regex: unit, $options: 'i' };
            }
        }
        if (status) {
            // 任务状态查询
            query.status = parseInt(status);
        }
        if (feedbackPersonName) {
            // 反馈人姓名查询
            query.feedbackPersonName = { $regex: feedbackPersonName, $options: 'i' };
        }
        if (keyword) {
            // 关键词查询：addressName或addressId
            query.$or = [
                { addressName: { $regex: keyword, $options: 'i' } },
                { addressId: { $regex: keyword, $options: 'i' } }
            ];
        }
        if (startTime || endTime) {
            // 时间范围查询
            query.issueTime = {};
            if (startTime) query.issueTime.$gte = new Date(startTime);
            if (endTime) query.issueTime.$lte = new Date(endTime);
        }
        
        // 分页查询
        const skip = (parseInt(page) - 1) * pageSizeNum;
        const tasks = await TaskAssign.find(query)
            .sort({ issueTime: -1 })
            .skip(skip)
            .limit(pageSizeNum)
            .lean();
        
        // 为每个任务查询关联的火灾情况
        const tasksWithSituation = await Promise.all(
            tasks.map(async (task) => {
                try {
                    // 根据taskId查询到的situationId查询当前火灾情况
                    const situation = await FireSituation.findOne({ 
                        situationId: task.situationId 
                    }).lean();
                    
                    return {
                        ...task,
                        fireSituation: situation || null // 如果找不到火灾情况，返回null
                    };
                } catch (err) {
                    console.error(`查询火灾情况失败，taskId: ${task.taskId}, situationId: ${task.situationId}`, err);
                    return {
                        ...task,
                        fireSituation: null
                    };
                }
            })
        );
        
        const total = await TaskAssign.countDocuments(query);
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: tasksWithSituation,
            pagination: {
                page: parseInt(page),
                limit: pageSizeNum,
                total,
                pages: Math.ceil(total / pageSizeNum)
            }
        });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

// 任务反馈（接收任务）
router.put('/feedback/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        // 默认直接更新为已接收状态
        const updateData = {
            status: 2, // 已接收
            feedbackTime: new Date(),
            updateTime: new Date()
        };
        
        const task = await TaskAssign.findOneAndUpdate(
            { taskId }, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务' });
        }
        
        // 任务被接收，同时更新关联的火灾情况状态为正在支援中
        try {
            await FireSituation.findOneAndUpdate(
                { situationId: task.situationId },
                { 
                    taskStatus: 4, // 正在支援中
                    updateTime: new Date()
                },
                { new: true, runValidators: true }
            );
        } catch (err) {
            console.error(`更新火灾情况状态失败，situationId: ${task.situationId}`, err);
            // 这里不中断主流程，只记录错误
        }
        
        res.send({ code: 200, msg: '反馈成功', data: task });
    } catch (err) {
        res.send({ code: 500, msg: '反馈失败', error: err.message });
    }
});

// 更新作战任务
router.put('/update/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const updateData = req.body;
        
        // 移除不允许更新的字段
        delete updateData._id;
        delete updateData.taskId;
        delete updateData.createTime;
        updateData.updateTime = new Date();
        
        const task = await TaskAssign.findOneAndUpdate(
            { taskId }, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务' });
        }
        
        res.send({ code: 200, msg: '更新成功', data: task });
    } catch (err) {
        res.send({ code: 500, msg: '更新失败', error: err.message });
    }
});

// 删除作战任务
router.delete('/delete/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        const task = await TaskAssign.findOneAndDelete({ taskId });
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务' });
        }
        
        // 释放关联的消防单位占用状态
        try {
            // 检查assignedUnits是否存在且为数组
            if (task.assignedUnits && Array.isArray(task.assignedUnits) && task.assignedUnits.length > 0) {
                const unitIds = task.assignedUnits.map(unit => unit.unitId);
                
                const now = new Date();
                await FireUnitStatus.updateMany(
                    { 
                        unitId: { $in: unitIds },
                        currentSituationId: task.situationId
                    },
                    {
                        $set: {
                            status: 'idle',
                            currentSituationId: '',
                            releaseTime: now,
                            updateTime: now
                        }
                    }
                );
                
                console.log(`任务 ${taskId} 删除成功，释放了 ${unitIds.length} 个消防单位`);
            } else {
                console.log(`任务 ${taskId} 没有关联的消防单位或assignedUnits为空`);
            }
        } catch (err) {
            console.error(`释放消防单位状态失败，taskId: ${taskId}`, err);
            // 这里不中断主流程，只记录错误
        }
        
        res.send({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.send({ code: 500, msg: '删除失败', error: err.message });
    }
});

// 根据taskId查询任务详情
router.get('/detail', async (req, res) => {
    try {
        const { taskId } = req.query;
        
        if (!taskId) {
            return res.send({ code: 400, msg: '缺少taskId参数' });
        }

        // 根据taskId查询任务详情
        const task = await TaskAssign.findOne({ taskId }).lean();
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务记录' });
        }

        // 返回详情数据
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                taskId: task.taskId,
                situationId: task.situationId,
                addressId: task.addressId,
                addressName: task.addressName,
                locationType: task.locationType,
                taskStatus: task.taskStatus,
                remark: task.remark,
                assignedUnits: task.assignedUnits || [],
                issuePersonId: task.issuePersonId,
                issuePersonName: task.issuePersonName,
                issueTime: task.issueTime,
                feedbackStatus: task.feedbackStatus,
                feedbackTime: task.feedbackTime,
                updateTime: task.updateTime,
                createTime: task._id.getTimestamp() // 从ObjectId获取创建时间
            }
        });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

module.exports = router;