const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const TaskAssign = dbmodel.TaskAssign;

// 创建作战任务
router.post('/create', async (req, res) => {
    try {
        const {
            fireUnit,
            addressId,
            addressName,
            locationType,
            rescueFloor,
            direction,
            taskType,
            taskExtra,
            remark,
            issuePersonId,
            issuePersonName,
            issueTime
        } = req.body;

        // 验证必填字段
        if (!fireUnit || !addressId || !addressName || !locationType || !taskType || !issuePersonId || !issuePersonName || !issueTime) {
            return res.send({ code: 400, msg: '缺少必填字段' });
        }

        // 生成唯一任务ID
        const taskId = 'TASK_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // 创建新的作战任务
        const taskAssign = new TaskAssign({
            taskId,
            fireUnit,
            addressId,
            addressName,
            locationType,
            rescueFloor: rescueFloor || '',
            direction: direction || '',
            taskType,
            taskExtra: taskExtra || {},
            remark: remark || '',
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
        const { page = 1, limit = 10, addressId, taskType, feedbackStatus } = req.query;
        
        // 构建查询条件
        const query = {};
        if (addressId) query.addressId = addressId;
        if (taskType) query.taskType = taskType;
        if (feedbackStatus) query.feedbackStatus = feedbackStatus;
        
        // 分页查询
        const skip = (page - 1) * limit;
        const tasks = await TaskAssign.find(query)
            .sort({ issueTime: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();
        
        const total = await TaskAssign.countDocuments(query);
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: tasks,
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

// 任务反馈（接收任务）
router.put('/feedback/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { feedbackStatus } = req.body;
        
        if (!feedbackStatus || !['received', 'unreceived'].includes(feedbackStatus)) {
            return res.send({ code: 400, msg: '反馈状态参数错误' });
        }
        
        const updateData = {
            feedbackStatus,
            updateTime: new Date()
        };
        
        if (feedbackStatus === 'received') {
            updateData.feedbackTime = new Date();
        }
        
        const task = await TaskAssign.findOneAndUpdate(
            { taskId }, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务' });
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
        
        res.send({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.send({ code: 500, msg: '删除失败', error: err.message });
    }
});

module.exports = router;