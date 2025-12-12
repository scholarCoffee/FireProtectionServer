const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const FireSituation = dbmodel.FireSituation;
const FireUnitStatus = dbmodel.FireUnitStatus;
const TaskAssign = dbmodel.TaskAssign;

// 上传火灾情况数据（新版：支持 assignedUnits 结构，支持更新）
router.post('/upload', async (req, res) => {
    try {
        let {
            // 新增：situationId（非必填，用于更新）
            situationId,
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
        if (!addressId || !addressName || (locationType === undefined || locationType === null || locationType === '') || !Array.isArray(assignedUnits) || assignedUnits.length === 0 || !issuePersonId || !issuePersonName || !issueTime) {
            return res.send({ code: 400, msg: '缺少必填字段（addressId/addressName/locationType/assignedUnits/issuePersonId/issuePersonName/issueTime）' });
        }
        
        // 转换 locationType 为 Number（如果传入的是 String）
        if (typeof locationType === 'string') {
            const parsedType = parseInt(locationType);
            if (!isNaN(parsedType)) {
                locationType = parsedType;
            }
        }

        // 细项校验 assignedUnits
        for (const unit of assignedUnits) {
            if (!unit.unitId || !unit.unitName) {
                return res.send({ code: 400, msg: 'assignedUnits 中存在缺少 unitId 或 unitName 的记录' });
            }
            if (!Array.isArray(unit.carInfo)) {
                return res.send({ code: 400, msg: 'assignedUnits.carInfo 必须为数组' });
            }
            // 验证 carInfo 结构（新格式：carId, carName）
            for (const car of unit.carInfo) {
                if (!car.carId || !car.carName) {
                    // 兼容旧格式（label, value）
                    if (car.label && car.value) {
                        car.carId = car.value;
                        car.carName = car.label;
                        delete car.label;
                        delete car.value;
                        delete car.index;
                    } else {
                        return res.send({ code: 400, msg: 'assignedUnits.carInfo 中车辆信息缺少 carId 或 carName' });
                    }
                }
            }
            // 验证 taskGroups（如果存在）
            if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
                for (const taskGroup of unit.taskGroups) {
                    if (!taskGroup.taskType) {
                        return res.send({ code: 400, msg: 'assignedUnits.taskGroups 中任务组缺少 taskType' });
                    }
                    if (!Array.isArray(taskGroup.carIds) || !Array.isArray(taskGroup.carNames)) {
                        return res.send({ code: 400, msg: 'assignedUnits.taskGroups 中任务组缺少 carIds 或 carNames 数组' });
                    }
                    // 验证备注长度
                    if (taskGroup.description && taskGroup.description.length > 200) {
                        return res.send({ code: 400, msg: 'assignedUnits.taskGroups 中任务组的 description 不能超过200字' });
                    }
                }
            }
        }
        
        // 验证备注长度
        if (remark && remark.length > 500) {
            return res.send({ code: 400, msg: '备注信息不能超过500字' });
        }

         // 逻辑整理：判断是新建火灾情况还是支援任务
         if (!situationId) {
             // 生成新的唯一情况ID
             const currentSituationId = 'SITUATION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
             
             // 检查单位占用状态
             const unitIds = assignedUnits.map(unit => unit.unitId);
             const occupiedUnits = await FireUnitStatus.find({ 
                 unitId: { $in: unitIds }, 
                 status: 'occupied'
             }).lean();
 
             if (occupiedUnits.length > 0) {
                 const occupiedUnitNames = occupiedUnits.map(unit => unit.unitName);
                 return res.send({ 
                     code: 409, 
                     msg: `以下单位已被占用，无法分配: ${occupiedUnitNames.join(', ')}` 
                 });
             }
 
             // 确保 assignedUnits 中每个单位都有 unitStatus 和 rescueTime
             const processedAssignedUnits = assignedUnits.map(unit => ({
                 ...unit,
                 unitStatus: unit.unitStatus || 'rescue', // 默认首次救援单位
                 rescueTime: unit.rescueTime || new Date() // 默认当前时间
             }));
 
             // 创建新的火灾情况记录
             const fireSituation = new FireSituation({
                 situationId: currentSituationId,
                 addressId,
                 addressName,
                 locationType,
                 taskStatus: typeof taskStatus === 'number' ? taskStatus : 2, // 默认救援中
                 remark: remark || '',
                 assignedUnits: processedAssignedUnits,
                 issuePersonId,
                 issuePersonName,
                 issueTime: new Date(issueTime),
                 updateTime: updateTime ? new Date(updateTime) : new Date()
             });
 
             await fireSituation.save();
 
             // 更新单位占用状态
             const now = new Date();
             for (const unit of processedAssignedUnits) {
                 await FireUnitStatus.updateOne(
                     { unitId: unit.unitId },
                     {
                         $set: {
                             unitName: unit.unitName,
                             status: 'occupied',
                             currentSituationId: currentSituationId,
                             occupyTime: now,
                             updateTime: now
                         }
                     },
                     { upsert: true }
                 );
             }
 
            return res.send({ 
                code: 200, 
                msg: '提交成功', 
                data: {
                    situationId: currentSituationId
                }
            });
         } else {
             // 情况2：有situationId，说明是火灾需要支援，新增TaskAssign任务
             console.log(`为火灾情况 ${situationId} 添加支援任务`);
             
             // 检查火灾情况是否存在
             const existingSituation = await FireSituation.findOne({ situationId });
             if (!existingSituation) {
                 return res.send({ code: 404, msg: '未找到指定的火灾情况' });
             }
             
             // 检查单位占用状态
             const unitIds = assignedUnits.map(unit => unit.unitId);
             const occupiedUnits = await FireUnitStatus.find({ 
                 unitId: { $in: unitIds }, 
                 status: 'occupied'
             }).lean();

             if (occupiedUnits.length > 0) {
                 const occupiedUnitNames = occupiedUnits.map(unit => unit.unitName);
                 return res.send({ 
                     code: 409, 
                     msg: `以下单位已被占用，无法分配: ${occupiedUnitNames.join(', ')}` 
                 });
             }
             
             // 创建一个TaskAssign任务
             const taskId = 'TASK_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
             
             // 创建TaskAssign记录
             const taskAssign = new TaskAssign({
                 taskId,
                 situationId, // 关联的火灾情况ID
                 status: 1, // 默认未接收
                 remark: remark || '',
                 feedbackPersonId: issuePersonId,
                 feedbackPersonName: issuePersonName,
                 feedbackTime: new Date(issueTime),
                 updateTime: new Date()
             });
             
             await taskAssign.save();
             
             // 为所有assignedUnits添加相同的taskId
             const updatedAssignedUnits = assignedUnits.map(unit => ({
                 ...unit,
                 taskId: taskId // 关联同一个taskId
             }));
             
             // 更新FireSituation中的assignedUnits，添加新的支援单位，并更新remark
             await FireSituation.updateOne(
                 { situationId },
                 { 
                     $push: { assignedUnits: { $each: updatedAssignedUnits } },
                     $set: { 
                         remark: remark || '', // 覆盖原来的remark
                         updateTime: new Date() 
                     }
                 }
             );
             
             // 更新单位占用状态
             const now = new Date();
             for (const unit of updatedAssignedUnits) {
                 await FireUnitStatus.updateOne(
                     { unitId: unit.unitId },
                     {
                         $set: {
                             unitName: unit.unitName,
                             status: 'occupied',
                             currentSituationId: situationId,
                             occupyTime: now,
                             updateTime: now
                         }
                     },
                     { upsert: true }
                 );
             }
             
            return res.send({ 
                code: 200, 
                msg: '提交成功', 
                data: {
                    situationId: situationId
                }
            });
         }

    } catch (err) {
        res.send({ code: 500, msg: '上传失败', error: err.message });
    }
 });

// 添加支援单位到现有火情
router.post('/addSupport', async (req, res) => {
    try {
        const {
            situationId,
            unitId,
            unitName,
            rescueFloor = '',
            direction = 0,
            taskType = '',
            taskExtra = {},
            carInfo = [],
            remark = ''
        } = req.body || {};

        if (!situationId || !unitId || !unitName) {
            return res.send({ code: 400, msg: '缺少必填字段（situationId/unitId/unitName）' });
        }

        // 查找现有火情
        const existingSituation = await FireSituation.findOne({ situationId });
        if (!existingSituation) {
            return res.send({ code: 404, msg: '未找到相关火灾情况记录' });
        }

        // 检查单位是否已存在
        const unitExists = existingSituation.assignedUnits.some(unit => unit.unitId === unitId);
        if (unitExists) {
            return res.send({ code: 409, msg: '该单位已存在于当前火情中' });
        }

        // 检查单位占用状态
        const unitStatus = await FireUnitStatus.findOne({ unitId, status: 'occupied' });
        if (unitStatus) {
            return res.send({ 
                code: 409, 
                msg: `单位 ${unitName} 已被其他任务占用，无法分配` 
            });
        }

        // 添加支援单位
        const supportUnit = {
            unitId,
            unitName,
            rescueFloor,
            direction,
            taskType,
            taskExtra,
            unitStatus: 'support', // 标记为支援单位
            rescueTime: new Date(), // 支援时间
            carInfo
        };

        await FireSituation.updateOne(
            { situationId },
            { 
                $push: { assignedUnits: supportUnit },
                $set: { updateTime: new Date() }
            }
        );

        // 更新单位占用状态
        const now = new Date();
        await FireUnitStatus.updateOne(
            { unitId },
            {
                $set: {
                    unitName,
                    status: 'occupied',
                    currentSituationId: situationId,
                    occupyTime: now,
                    updateTime: now
                }
            },
            { upsert: true }
        );

        res.send({ code: 200, msg: '支援单位添加成功', data: { unitId, unitName } });
    } catch (err) {
        res.send({ code: 500, msg: '添加支援单位失败', error: err.message });
    }
});

// 释放单位占用状态
router.post('/releaseUnit', async (req, res) => {
    try {
        const { unitId, situationId } = req.body || {};

        if (!unitId) {
            return res.send({ code: 400, msg: '缺少必填字段（unitId）' });
        }

        // 查找单位状态
        const unitStatus = await FireUnitStatus.findOne({ unitId });
        if (!unitStatus) {
            return res.send({ code: 404, msg: '未找到该单位状态记录' });
        }

        if (unitStatus.status === 'idle') {
            return res.send({ code: 400, msg: '该单位当前为空闲状态，无需释放' });
        }

        // 如果指定了 situationId，验证是否匹配
        if (situationId && unitStatus.currentSituationId !== situationId) {
            return res.send({ code: 400, msg: '该单位不属于指定的火情任务' });
        }

        // 释放单位
        const now = new Date();
        await FireUnitStatus.updateOne(
            { unitId },
            {
                $set: {
                    status: 'idle',
                    currentSituationId: '',
                    releaseTime: now,
                    updateTime: now
                }
            }
        );

        res.send({ code: 200, msg: '单位释放成功', data: { unitId, unitName: unitStatus.unitName } });
    } catch (err) {
        res.send({ code: 500, msg: '释放单位失败', error: err.message });
    }
});

// 查询火灾情况数据
router.get('/list', async (req, res) => {
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            unit, 
            taskStatus, 
            feedbackPersonName, 
            startTime, 
            endTime, 
            issuePersonName, 
            keyword,
            addressId,
            taskType,
            unitStatus,
            unitId
        } = req.query;
        
        // 构建查询条件
        const query = {};
        
        // 基础查询条件
        if (addressId) query.addressId = addressId;
        if (taskType) query.taskType = taskType;
        if (taskStatus) query.taskStatus = parseInt(taskStatus);
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
        
        // 反馈人姓名查询
        if (feedbackPersonName) {
            query.feedbackPersonName = { $regex: feedbackPersonName, $options: 'i' };
        }
        
        // 下达人姓名查询
        if (issuePersonName) {
            query.issuePersonName = { $regex: issuePersonName, $options: 'i' };
        }
        
        // 时间范围查询
        if (startTime || endTime) {
            query.issueTime = {};
            if (startTime) {
                query.issueTime.$gte = new Date(startTime);
            }
            if (endTime) {
                query.issueTime.$lte = new Date(endTime);
            }
        }
        
        // 关键词搜索（地址名称、地址ID等）
        if (keyword) {
            query.$or = [
                { addressName: { $regex: keyword, $options: 'i' } },
                { addressId: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        // 分页查询
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const situations = await FireSituation.find(query)
            .sort({ issueTime: -1 })
            .skip(skip)
            .limit(parseInt(pageSize))
            .lean();
        
        const total = await FireSituation.countDocuments(query);
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: situations,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
                pages: Math.ceil(total / parseInt(pageSize))
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
        
        // 使用 situationId 字段查找和更新
        const situation = await FireSituation.findOneAndUpdate(
            { situationId: id }, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关记录' });
        }
        
        // 如果状态更新为已完成(1)，删除所有关联的救援单位状态记录
        if (updateData.taskStatus === 1) {
            const unitIds = situation.assignedUnits.map(unit => unit.unitId);
            
            console.log(`准备删除单位状态记录，situationId: ${id}, unitIds:`, unitIds);
            
            // 删除所有关联的单位状态记录
            const deleteResult = await FireUnitStatus.deleteMany({
                unitId: { $in: unitIds },
                currentSituationId: id
            });
            
            console.log(`火灾情况 ${id} 已完成，删除了 ${deleteResult.deletedCount} 个单位状态记录`);
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
        
        // 使用 situationId 字段查找和删除
        const situation = await FireSituation.findOneAndDelete({ situationId: id });
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关记录' });
        }
        
        res.send({ code: 200, msg: '删除成功' });
    } catch (err) {
        res.send({ code: 500, msg: '删除失败', error: err.message });
    }
});

// 根据situationId查询火灾情况详情
router.get('/detail', async (req, res) => {
    try {
        const { situationId } = req.query;
        
        if (!situationId) {
            return res.send({ code: 400, msg: '缺少situationId参数' });
        }

        // 根据situationId查询火灾情况详情
        const situation = await FireSituation.findOne({ situationId }).lean();
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关火灾情况记录' });
        }

        // 返回详情数据
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                situationId: situation.situationId,
                addressId: situation.addressId,
                addressName: situation.addressName,
                locationType: situation.locationType,
                taskStatus: situation.taskStatus,
                remark: situation.remark,
                assignedUnits: situation.assignedUnits || [],
                issuePersonId: situation.issuePersonId,
                issuePersonName: situation.issuePersonName,
                issueTime: situation.issueTime,
                updateTime: situation.updateTime,
                createTime: situation._id.getTimestamp() // 从ObjectId获取创建时间
            }
        });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

// 查询单位占用状态
// 查询单位占用状态（已废弃，请使用 /fire/unitAndCarStatus）
router.get('/unitStatus', async (req, res) => {
    try {
        const { unitId, status } = req.query;

        const query = {};
        if (unitId) query.unitId = unitId;
        if (status) query.status = status;

        const units = await FireUnitStatus.find(query).lean();

        res.send({ code: 200, msg: '查询成功', data: units });
    } catch (err) {
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

// 查询上一次记录接口
router.get('/lastRecord', async (req, res) => {
    try {
        const { issuePersonId } = req.query;
        
        if (!issuePersonId) {
            return res.send({ 
                code: 400, 
                msg: '缺少必填参数：issuePersonId' 
            });
        }
        
        // 查询该用户最近一次提交的火灾情况记录
        const lastSituation = await FireSituation.findOne({ 
            issuePersonId: issuePersonId 
        })
        .sort({ issueTime: -1 }) // 按发布时间倒序，获取最新的一条
        .lean();
        
        if (!lastSituation) {
            return res.send({
                code: 200,
                msg: '获取成功',
                data: null
            });
        }
        
        // 提取救援楼层（从 taskGroups 中获取第一个任务的 floor）
        let rescueFloor = '';
        if (lastSituation.assignedUnits && lastSituation.assignedUnits.length > 0) {
            const firstUnit = lastSituation.assignedUnits[0];
            if (firstUnit.taskGroups && firstUnit.taskGroups.length > 0) {
                const firstTaskGroup = firstUnit.taskGroups[0];
                rescueFloor = firstTaskGroup.floor || '';
            }
        }
        
        // 转换 locationType 为 String（如果模型中是 Number）
        let locationType = lastSituation.locationType;
        if (typeof locationType === 'number') {
            // 可以根据需要映射数字到字符串，这里直接转换为字符串
            locationType = locationType.toString();
        }
        
        return res.send({
            code: 200,
            msg: '获取成功',
            data: {
                addressId: lastSituation.addressId,
                addressName: lastSituation.addressName,
                rescueFloor: rescueFloor,
                locationType: locationType
            }
        });
        
    } catch (err) {
        console.error('查询上一次记录失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
});

// 单位和车辆状态查询接口（合并接口）
router.get('/unitAndCarStatus', async (req, res) => {
    try {
        const StaticData = dbmodel.StaticData;
        
        // 获取所有正在使用的车辆（从 FireSituation 中提取）
        // 状态说明：
        // 2 - 救援中（全部）：所有车辆都在使用，无法选择救援单位
        // 3 - 需要支援
        // 4 - 正在支援
        // 5 - 救援中（局部）：部分车辆空闲，可以选择救援单位
        const allSituations = await FireSituation.find({
            taskStatus: { $in: [2, 3, 4, 5] }
        }).lean();
        
        // 收集所有正在使用的车辆ID
        const usingCarIds = new Set();
        const unitCarMap = {}; // 单位-车辆映射关系
        
        for (const situation of allSituations) {
            if (situation.assignedUnits && Array.isArray(situation.assignedUnits)) {
                for (const unit of situation.assignedUnits) {
                    const unitId = unit.unitId;
                    
                    // 初始化单位车辆列表
                    if (!unitCarMap[unitId]) {
                        unitCarMap[unitId] = [];
                    }
                    
                    // 从 carInfo 中提取车辆ID
                    if (unit.carInfo && Array.isArray(unit.carInfo)) {
                        for (const car of unit.carInfo) {
                            const carId = car.carId || car.value; // 兼容新旧格式
                            if (carId) {
                                usingCarIds.add(carId);
                                if (!unitCarMap[unitId].includes(carId)) {
                                    unitCarMap[unitId].push(carId);
                                }
                            }
                        }
                    }
                    
                    // 从 taskGroups 中提取车辆ID
                    if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
                        for (const taskGroup of unit.taskGroups) {
                            if (taskGroup.carIds && Array.isArray(taskGroup.carIds)) {
                                for (const carId of taskGroup.carIds) {
                                    if (carId) {
                                        usingCarIds.add(carId);
                                        if (!unitCarMap[unitId].includes(carId)) {
                                            unitCarMap[unitId].push(carId);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 构建 usingCars 数组
        const usingCars = Array.from(usingCarIds).map(carId => ({
            carId: carId,
            id: carId // 兼容字段
        }));
        
        // 如果静态资源中有单位-车辆映射关系，也添加到 unitCarMap
        try {
            const fireUnits = await StaticData.find({ type: 'fireUnits', key: 'unitList' }).lean();
            const fireCars = await StaticData.find({ type: 'fireUnits', key: 'carList' }).lean();
            
            // 尝试从静态资源构建映射关系（如果数据中有 unitId 或 unitCode 字段）
            // 这里假设车辆通过 data2 或其他字段关联到单位
            // 如果静态资源中没有明确的关联字段，则使用上面从 FireSituation 中提取的映射关系
            for (const car of fireCars) {
                // 如果车辆数据中有 unitId 或 unitCode 字段，添加到映射
                const carId = car.data2 || car.value;
                const unitId = car.unitId || car.unitCode;
                
                if (carId && unitId) {
                    if (!unitCarMap[unitId]) {
                        unitCarMap[unitId] = [];
                    }
                    if (!unitCarMap[unitId].includes(carId)) {
                        unitCarMap[unitId].push(carId);
                    }
                }
            }
        } catch (staticErr) {
            console.warn('从静态资源构建单位-车辆映射关系失败:', staticErr.message);
            // 继续使用从 FireSituation 中提取的映射关系
        }
        
        res.send({
            code: 200,
            msg: '获取成功',
            data: {
                usingCars: usingCars,
                unitCarMap: unitCarMap
            }
        });
    } catch (err) {
        console.error('查询单位和车辆状态失败:', err);
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

module.exports = router;