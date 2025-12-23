const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const TaskAssign = dbmodel.TaskAssign;
const FireSituation = dbmodel.FireSituation;
const FireUnitStatus = dbmodel.FireUnitStatus;
const StaticData = dbmodel.StaticData;

// 辅助函数：获取单位的车辆列表
async function getUnitCarList(unitId) {
    try {
        // 从 StaticData 读取车辆列表
        // 根据数据结构：type='fireUnits', key='carList'
        // data1 存储车辆名称，data2 存储车辆ID
        const carList = await StaticData.find({ 
            type: 'fireUnits', 
            key: 'carList'
        }).lean();
        
        // 提取车辆ID
        let unitCars = carList
            .filter(car => {
                // 如果车辆数据中有单位ID关联，则过滤；否则返回所有车辆
                if (car.extraParam && car.extraParam.unitId) {
                    return car.extraParam.unitId === unitId;
                }
                if (car.config && car.config.unitId) {
                    return car.config.unitId === unitId;
                }
                // 如果没有单位ID关联，返回所有车辆（假设所有单位共享所有车辆）
                return true;
            })
            .map(car => car.data2 || car.value || '')
            .filter(Boolean);
        
        return unitCars;
    } catch (err) {
        console.error(`获取单位 ${unitId} 的车辆列表失败:`, err);
        return [];
    }
}

/**
 * 从 assignedUnits 中提取所有使用的车辆ID
 * @param {Array} assignedUnits - 分配的单位列表
 * @returns {Array} 车辆ID列表
 */
function extractUsingCars(assignedUnits) {
    const carIds = new Set();
    
    for (const unit of assignedUnits) {
        // 从 carInfo 中提取
        if (unit.carInfo && Array.isArray(unit.carInfo)) {
            for (const car of unit.carInfo) {
                const carId = car.carId || car.value;
                if (carId) {
                    carIds.add(carId);
                }
            }
        }
        
        // 从 taskGroups 中提取
        if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
            for (const taskGroup of unit.taskGroups) {
                if (taskGroup.carIds && Array.isArray(taskGroup.carIds)) {
                    for (const carId of taskGroup.carIds) {
                        if (carId) {
                            carIds.add(carId);
                        }
                    }
                }
            }
        }
    }
    
    return Array.from(carIds);
}

/**
 * 计算单位状态（idle/occupied/full）
 * @param {String} unitId - 单位ID
 * @param {Array} usingCars - 当前使用的车辆ID列表
 * @returns {String} 状态：idle/occupied/full
 */
async function calculateUnitStatus(unitId, usingCars) {
    if (!usingCars || usingCars.length === 0) {
        return 'idle';
    }
    
    const totalCars = await getUnitCarList(unitId);
    if (totalCars.length === 0) {
        // 如果无法获取车辆列表，默认返回 occupied
        return 'occupied';
    }
    
    // 检查使用的车辆是否都在总车辆列表中
    const validUsingCars = usingCars.filter(carId => totalCars.includes(carId));
    
    if (validUsingCars.length >= totalCars.length) {
        return 'full'; // 占满中
    } else if (validUsingCars.length > 0) {
        return 'occupied'; // 占用中（有空余）
    } else {
        return 'idle'; // 空闲
    }
}

/**
 * 更新单位占用状态（车辆累加更新，不覆盖）
 * @param {String} unitId - 单位ID
 * @param {String} unitName - 单位名称
 * @param {Array} newCars - 新分配的车辆ID列表（会与现有车辆合并）
 * @param {String} situationId - 火情ID
 * @param {String} taskId - 任务ID（可选）
 */
async function updateUnitStatus(unitId, unitName, newCars, situationId, taskId = '') {
    // 获取现有单位状态
    const existingStatus = await FireUnitStatus.findOne({ unitId });
    const existingCars = existingStatus ? (existingStatus.usingCars || []) : [];
    
    // 合并现有车辆和新分配的车辆（去重）
    const allCars = [...new Set([...existingCars, ...(newCars || [])])];
    
    // 计算新状态
    const status = await calculateUnitStatus(unitId, allCars);
    const now = new Date();
    
    await FireUnitStatus.updateOne(
        { unitId },
        {
            $set: {
                unitName,
                status,
                usingCars: allCars,
                currentSituationId: situationId || '',
                currentTaskId: taskId,
                occupyTime: status !== 'idle' ? (now) : undefined,
                releaseTime: status === 'idle' ? (now) : undefined,
                updateTime: now
            }
        },
        { upsert: true }
    );
}

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

// 任务反馈（接收任务/完成任务）
router.put('/feedback/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, commitType } = req.body || {};
        
        // 参数校验
        if (status === undefined || status === null || status === '') {
            return res.send({ code: 400, msg: '缺少必填字段（status）' });
        }
        
        if (!commitType) {
            return res.send({ code: 400, msg: '缺少必填字段（commitType）' });
        }
        
        const statusNum = parseInt(status);
        
        // 验证参数组合
        if (statusNum === 1 && commitType === 'receive') {
            // 场景1：status=1, commitType=receive -> 任务状态更新为已接收(2)，火灾情况状态更新为正在支援中(4)
            const updateData = {
                status: 2, // 已接收
                feedbackTime: new Date(),
                updateTime: new Date()
            };
            
            const task = await TaskAssign.findOneAndUpdate(
                { taskId }, 
                { $set: updateData }, 
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
                        $set: {
                            taskStatus: 4, // 正在支援中
                            updateTime: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
            } catch (err) {
                console.error(`更新火灾情况状态失败，situationId: ${task.situationId}`, err);
                // 这里不中断主流程，只记录错误
            }
            
            // 更新当前救援单位的状态和车辆占用情况
            try {
                // 从关联的 FireSituation 中获取与该任务相关的单位
                const situation = await FireSituation.findOne({ situationId: task.situationId }).lean();
                
                if (situation && situation.assignedUnits && Array.isArray(situation.assignedUnits)) {
                    // 找到与当前任务相关的单位（通过 taskId 匹配）
                    const relatedUnits = situation.assignedUnits.filter(unit => unit.taskId === taskId);
                    
                    // 更新每个单位的占用状态
                    for (const unit of relatedUnits) {
                        const unitCars = extractUsingCars([unit]);
                        if (unitCars.length > 0) {
                            await updateUnitStatus(unit.unitId, unit.unitName, unitCars, task.situationId, taskId);
                            console.log(`单位 ${unit.unitId} (${unit.unitName}) 接收任务，占用车辆: ${unitCars.join(', ')}`);
                        }
                    }
                }
            } catch (err) {
                console.error(`更新单位占用状态失败，taskId: ${taskId}`, err);
                // 这里不中断主流程，只记录错误
            }
            
            return res.send({ code: 200, msg: '任务接收成功', data: task });
            
        } else if (statusNum === 2 && commitType === 'finish') {
            // 场景2：status=2, commitType=finish -> 任务状态更新为已执行(3)，火灾情况状态更新为救援中(2)
            const updateData = {
                status: 3, // 已执行
                updateTime: new Date()
            };
            
            const task = await TaskAssign.findOneAndUpdate(
                { taskId }, 
                { $set: updateData }, 
                { new: true, runValidators: true }
            );
            
            if (!task) {
                return res.send({ code: 404, msg: '未找到相关任务' });
            }
            
            // 任务被执行，同时更新关联的火灾情况状态为救援中
            try {
                await FireSituation.findOneAndUpdate(
                    { situationId: task.situationId },
                    { 
                        $set: {
                            taskStatus: 2, // 救援中（全部）
                            updateTime: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
            } catch (err) {
                console.error(`更新火灾情况状态失败，situationId: ${task.situationId}`, err);
                // 这里不中断主流程，只记录错误
            }
            
            return res.send({ code: 200, msg: '任务执行成功', data: task });
            
        } else {
            return res.send({ code: 400, msg: '参数组合无效。支持：status=1&commitType=receive（接收任务）或 status=2&commitType=finish（完成任务）' });
        }
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

// 删除/拒绝作战任务
router.delete('/delete/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.query || req.body || {};
        
        // 参数校验：status 必须提供
        if (status === undefined || status === null || status === '') {
            return res.send({ code: 400, msg: '缺少必填参数（status）。status=2表示拒绝任务，status=3表示删除任务' });
        }
        
        const statusNum = parseInt(status);
        if (statusNum !== 2 && statusNum !== 3) {
            return res.send({ code: 400, msg: 'status 值无效，必须是 2（拒绝任务）或 3（删除任务）' });
        }
        
        // 先查询任务，不要立即删除
        const task = await TaskAssign.findOne({ taskId });
        
        if (!task) {
            return res.send({ code: 404, msg: '未找到相关任务' });
        }
        
        // 验证任务当前状态是否匹配
        if (task.status !== statusNum) {
            return res.send({ code: 400, msg: `任务当前状态为 ${task.status}，与传入的 status ${statusNum} 不匹配` });
        }
        
        // 从关联的 FireSituation 中获取 assignedUnits
        const situation = await FireSituation.findOne({ situationId: task.situationId }).lean();
        
        if (!situation || !situation.assignedUnits || !Array.isArray(situation.assignedUnits)) {
            return res.send({ code: 404, msg: '未找到关联的火灾情况或没有分配单位' });
        }
        
        // 找到与当前任务相关的单位（通过 taskId 匹配）
        const relatedUnits = situation.assignedUnits.filter(unit => unit.taskId === taskId);
        
        if (relatedUnits.length === 0) {
            return res.send({ code: 404, msg: '未找到与该任务关联的消防单位' });
        }
        
        // 释放关联的消防单位占用状态（只释放该任务使用的参战车辆）
        try {
            for (const unit of relatedUnits) {
                const unitId = unit.unitId;
                const unitStatus = await FireUnitStatus.findOne({ unitId });
                
                if (unitStatus && unitStatus.usingCars && unitStatus.usingCars.length > 0) {
                    // 提取该单位在该任务中使用的车辆
                    const taskUnitCars = extractUsingCars([unit]);
                    
                    if (taskUnitCars.length > 0) {
                        // 从 usingCars 中移除这些车辆（部分释放）
                        const remainingCars = unitStatus.usingCars.filter(carId => !taskUnitCars.includes(carId));
                        const newStatus = await calculateUnitStatus(unitId, remainingCars);
                        const now = new Date();
                        
                        await FireUnitStatus.updateOne(
                            { unitId },
                            {
                                $set: {
                                    status: newStatus,
                                    usingCars: remainingCars,
                                    currentSituationId: newStatus === 'idle' ? '' : unitStatus.currentSituationId,
                                    currentTaskId: newStatus === 'idle' ? '' : unitStatus.currentTaskId,
                                    releaseTime: newStatus === 'idle' ? now : undefined,
                                    updateTime: now
                                }
                            }
                        );
                        
                        console.log(`单位 ${unitId} 释放了车辆: ${taskUnitCars.join(', ')}, 剩余车辆: ${remainingCars.join(', ')}`);
                    }
                }
            }
        } catch (err) {
            console.error(`释放消防单位状态失败，taskId: ${taskId}`, err);
            return res.send({ code: 500, msg: '释放消防单位状态失败', error: err.message });
        }
        
        // 根据 status 执行不同操作
        if (statusNum === 2) {
            // 拒绝任务：更新任务状态为未接收(1)，更新火灾情况状态为需要支援(3)
            try {
                // 更新任务状态为未接收
                await TaskAssign.findOneAndUpdate(
                    { taskId },
                    { 
                        $set: {
                            status: 1, // 未接收
                            updateTime: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
                
                // 更新火灾情况状态为需要支援
                await FireSituation.findOneAndUpdate(
                    { situationId: task.situationId },
                    { 
                        $set: {
                            taskStatus: 3, // 需要支援
                            updateTime: new Date()
                        }
                    },
                    { new: true, runValidators: true }
                );
                return res.send({ code: 200, msg: '任务拒绝成功' });
            } catch (err) {
                return res.send({ code: 500, msg: '拒绝任务失败', error: err.message });
            }
        } else if (statusNum === 3) {
            // 删除任务：直接删除任务
            await TaskAssign.findOneAndDelete({ taskId });
            return res.send({ code: 200, msg: '任务删除成功' });
        }
    } catch (err) {
        console.error('删除/拒绝任务失败:', err);
        res.send({ code: 500, msg: '操作失败', error: err.message });
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