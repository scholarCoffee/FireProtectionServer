const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const FireSituation = dbmodel.FireSituation;
const FireUnitStatus = dbmodel.FireUnitStatus;
const TaskAssign = dbmodel.TaskAssign;
const StaticData = dbmodel.StaticData;
const Location = dbmodel.Location;

// ========== 辅助函数 ==========

/**
 * 获取单位的车辆列表（从 StaticData 读取）
 * @param {String} unitId - 单位ID
 * @returns {Array} 车辆ID列表
 */
async function getUnitCarList(unitId) {
    try {
        // 从 StaticData 读取车辆列表
        // 根据数据结构：type='fireUnits', key='carList'
        // data1 存储车辆名称，data2 存储车辆ID
        // 如果车辆数据中没有单位ID关联，则返回所有车辆
        // 如果有单位ID关联（通过 extraParam.unitId 或 config.unitId），则过滤
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

/**
 * 释放单位车辆（支持部分释放）
 * @param {String} unitId - 单位ID
 * @param {Array} releaseCarIds - 要释放的车辆ID列表（如果为空数组，则全部释放）
 * @param {String} situationId - 火情ID（可选，用于验证）
 * @returns {Object} 释放结果
 */
async function releaseUnitCars(unitId, releaseCarIds = [], situationId = '') {
    const unitStatus = await FireUnitStatus.findOne({ unitId });
    if (!unitStatus) {
        return { success: false, msg: '未找到该单位状态记录' };
    }
    
    if (unitStatus.status === 'idle') {
        return { success: false, msg: '该单位当前为空闲状态，无需释放' };
    }
    
    // 如果指定了 situationId，验证是否匹配
    if (situationId && unitStatus.currentSituationId !== situationId) {
        return { success: false, msg: '该单位不属于指定的火情任务' };
    }
    
    let remainingCars = [...(unitStatus.usingCars || [])];
    
    if (releaseCarIds.length === 0) {
        // 全部释放
        remainingCars = [];
    } else {
        // 部分释放
        remainingCars = remainingCars.filter(carId => !releaseCarIds.includes(carId));
    }
    
    // 计算新状态
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
    
    return { 
        success: true, 
        status: newStatus, 
        remainingCars,
        releasedCount: (unitStatus.usingCars || []).length - remainingCars.length
    };
}

/**
 * 检查单位是否可用（非full状态）
 * @param {Array} unitIds - 单位ID列表
 * @returns {Object} { success: boolean, fullUnits: Array, fullUnitNames: Array }
 */
async function checkUnitsAvailability(unitIds) {
    if (!unitIds || unitIds.length === 0) {
        return { success: true, fullUnits: [], fullUnitNames: [] };
    }
    
    const fullUnits = await FireUnitStatus.find({ 
        unitId: { $in: unitIds }, 
        status: 'full'
    }).lean();
    
    if (fullUnits.length > 0) {
        const fullUnitNames = fullUnits.map(unit => unit.unitName);
        return { 
            success: false, 
            fullUnits, 
            fullUnitNames 
        };
    }
    
    return { success: true, fullUnits: [], fullUnitNames: [] };
}

/**
 * 检查火灾情况是否存在
 * @param {String} situationId - 火灾情况ID
 * @returns {Object} { success: boolean, situation: Object|null }
 */
async function checkSituationExists(situationId) {
    if (!situationId) {
        return { success: false, situation: null };
    }
    
    const situation = await FireSituation.findOne({ situationId });
    return { 
        success: !!situation, 
        situation 
    };
}

/**
 * 同步更新单位车辆使用情况（当更新 assignedUnits 时）
 * @param {String} situationId - 火灾情况ID
 * @param {Object} oldSituation - 更新前的火灾情况数据
 * @param {Array} newAssignedUnits - 新的分配单位列表（完全替换旧数据）
 */
async function syncAssignedUnitsCars(situationId, oldSituation, newAssignedUnits) {
    if (!newAssignedUnits || !Array.isArray(newAssignedUnits)) {
        return;
    }
    
    // 按单位分组统计新分配的车辆
    const unitNewCarsMap = {};
    const newUnitIds = new Set();
    for (const unit of newAssignedUnits) {
        const unitId = unit.unitId;
        newUnitIds.add(unitId);
        if (!unitNewCarsMap[unitId]) {
            unitNewCarsMap[unitId] = [];
        }
        const unitCars = extractUsingCars([unit]);
        unitNewCarsMap[unitId] = [...new Set([...unitNewCarsMap[unitId], ...unitCars])];
    }
    
    // 处理旧数据中的单位（包括被删除的单位）
    if (oldSituation && oldSituation.assignedUnits) {
        for (const oldUnit of oldSituation.assignedUnits) {
            const unitId = oldUnit.unitId;
            const oldUnitCars = extractUsingCars([oldUnit]);
            const newUnitCars = unitNewCarsMap[unitId] || [];
            const isUnitRemoved = !newUnitIds.has(unitId); // 单位是否被删除
            
            if (isUnitRemoved) {
                // 单位被完全删除，释放该单位在该火情中使用的所有车辆
                if (oldUnitCars.length > 0) {
                    await releaseUnitCars(unitId, oldUnitCars, situationId);
                    console.log(`单位 ${unitId} 已被移除，释放了所有车辆: ${oldUnitCars.join(', ')}`);
                }
            } else {
                // 单位仍然存在，但车辆可能有变化
                // 找出该单位不再使用的车辆（在旧数据中但不在新数据中）
                const unitReleasedCars = oldUnitCars.filter(carId => !newUnitCars.includes(carId));
                
                // 找出该单位新增的车辆（在新数据中但不在旧数据中）
                const unitNewAddedCars = newUnitCars.filter(carId => !oldUnitCars.includes(carId));
                
                // 先释放不再使用的车辆
                if (unitReleasedCars.length > 0) {
                    await releaseUnitCars(unitId, unitReleasedCars, situationId);
                    console.log(`单位 ${unitId} 释放了车辆: ${unitReleasedCars.join(', ')}`);
                }
                
                // 然后累加新增的车辆（只累加新增的，已存在的车辆已经在释放后保留）
                if (unitNewAddedCars.length > 0) {
                    // 获取释放后的当前状态
                    const currentStatus = await FireUnitStatus.findOne({ unitId });
                    const currentCars = currentStatus ? (currentStatus.usingCars || []) : [];
                    
                    // 合并当前车辆和新增车辆
                    const allCars = [...new Set([...currentCars, ...unitNewAddedCars])];
                    const status = await calculateUnitStatus(unitId, allCars);
                    const now = new Date();
                    
                    await FireUnitStatus.updateOne(
                        { unitId },
                        {
                            $set: {
                                unitName: oldUnit.unitName || newAssignedUnits.find(u => u.unitId === unitId)?.unitName || '',
                                status,
                                usingCars: allCars,
                                currentSituationId: situationId || '',
                                currentTaskId: currentStatus ? currentStatus.currentTaskId : '',
                                occupyTime: status !== 'idle' ? (now) : undefined,
                                releaseTime: status === 'idle' ? (now) : undefined,
                                updateTime: now
                            }
                        },
                        { upsert: true }
                    );
                    console.log(`单位 ${unitId} 新增了车辆: ${unitNewAddedCars.join(', ')}`);
                } else if (newUnitCars.length === 0 && oldUnitCars.length > 0) {
                    // 如果新数据中该单位没有车辆，但旧数据有，需要释放所有车辆
                    await releaseUnitCars(unitId, oldUnitCars, situationId);
                    console.log(`单位 ${unitId} 所有车辆已被移除`);
                }
            }
        }
    }
    
    // 处理新增的单位（在旧数据中不存在的单位）
    for (const newUnit of newAssignedUnits) {
        const unitId = newUnit.unitId;
        const isNewUnit = !oldSituation || !oldSituation.assignedUnits.some(u => u.unitId === unitId);
        
        if (isNewUnit) {
            // 检查单位占用状态（只有 full 状态无法分配）
            const availability = await checkUnitsAvailability([unitId]);
            if (!availability.success) {
                throw new Error(`单位 ${newUnit.unitName} 已占满，无法分配`);
            }
            
            const newUnitCars = extractUsingCars([newUnit]);
            if (newUnitCars.length > 0) {
                await updateUnitStatus(unitId, newUnit.unitName, newUnitCars, situationId);
            }
        }
    }
}

/**
 * 释放火情相关的所有车辆（当taskStatus === 1时）
 * @param {String} situationId - 火灾情况ID
 * @param {Object} situation - 火灾情况对象
 */
async function releaseSituationAllCars(situationId, situation) {
    if (!situation || !situation.assignedUnits) {
        return;
    }
    
    const unitIds = situation.assignedUnits.map(unit => unit.unitId);
    
    console.log(`准备释放单位车辆，situationId: ${situationId}, unitIds:`, unitIds);
    
    // 释放所有关联的单位车辆
    for (const unitId of unitIds) {
        const unitStatus = await FireUnitStatus.findOne({ unitId });
        if (unitStatus && unitStatus.usingCars && unitStatus.usingCars.length > 0) {
            // 获取该单位在该火情中使用的车辆
            const unit = situation.assignedUnits.find(u => u.unitId === unitId);
            if (unit) {
                const unitCars = extractUsingCars([unit]);
                // 释放该火情相关的车辆（从 usingCars 中移除这些车辆）
                if (unitCars.length > 0) {
                    // 直接更新，移除这些车辆
                    const remainingCars = (unitStatus.usingCars || []).filter(carId => !unitCars.includes(carId));
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
                    console.log(`单位 ${unitId} 释放了车辆: ${unitCars.join(', ')}, 剩余车辆: ${remainingCars.join(', ')}`);
                }
            }
        }
    }
    
    console.log(`火灾情况 ${situationId} 已完成，已释放所有单位车辆`);
}

// 上传火灾情况数据（新版：支持 assignedUnits 结构，支持更新）
router.post('/upload', async (req, res) => {
    try {
        let {
            // 新增：situationId（非必填，用于更新）
            situationId,
            // 新增：taskType（非必填，'change' 表示更新火灾信息，其他值或空表示添加支援任务）
            taskType,
            // 新版必填
            addressId,
            addressName,
            locationType,
            assignedUnits = [],
            remark,
            taskStatus,
            supportContent,
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
        
        // 验证 supportContent 字数限制（500字以内）
        if (supportContent !== undefined && supportContent !== null) {
            if (typeof supportContent !== 'string') {
                return res.send({ code: 400, msg: 'supportContent 必须是字符串类型' });
            }
            if (supportContent.length > 500) {
                return res.send({ code: 400, msg: 'supportContent 不能超过500字' });
            }
        }

        // 如果 taskType === 'change'，则更新当前火灾信息，必须要有 situationId
        if (taskType === 'change') {
            if (!situationId) {
                return res.send({ code: 400, msg: '变更任务时必须提供缺少火灾情况' });
            }
            
            // 检查火灾情况是否存在
            const { success: exists, situation: existingSituation } = await checkSituationExists(situationId);
            if (!exists) {
                return res.send({ code: 404, msg: '未找到指定的火灾情况' });
            }
            
            // 构建更新数据
            const updateData = {
                addressId,
                addressName,
                locationType,
                assignedUnits,
                remark: remark || '',
                supportContent: supportContent !== undefined && supportContent !== null ? supportContent : (existingSituation.supportContent || ''),
                taskStatus: typeof taskStatus === 'number' ? taskStatus : existingSituation.taskStatus,
                issuePersonId,
                issuePersonName,
                issueTime: new Date(issueTime),
                updateTime: updateTime ? new Date(updateTime) : new Date()
            };
            
            // 获取更新前的数据（用于对比车辆变化）
            const oldSituation = await FireSituation.findOne({ situationId }).lean();
            
            // 更新火灾情况（使用 $set 确保完全替换，而不是追加）
            const situation = await FireSituation.findOneAndUpdate(
                { situationId },
                { $set: updateData },
                { new: true, runValidators: true }
            );
            
            if (!situation) {
                return res.send({ code: 404, msg: '更新失败，未找到相关记录' });
            }
            
            // 如果更新了 assignedUnits，同步更新单位车辆使用情况
            try {
                await syncAssignedUnitsCars(situationId, oldSituation, updateData.assignedUnits);
            } catch (err) {
                return res.send({ 
                    code: 409, 
                    msg: err.message || '同步单位车辆使用情况失败' 
                });
            }
            
            // 如果状态更新为已完成(1)，释放所有关联的救援单位车辆
            if (updateData.taskStatus === 1) {
                await releaseSituationAllCars(situationId, situation);
            }
            
            return res.send({ 
                code: 200, 
                msg: '更新成功', 
                data: {
                    situationId: situationId
                }
            });
        }

         // 逻辑整理：判断是新建火灾情况还是支援任务
         if (!situationId) {
             // 生成新的唯一情况ID
             const currentSituationId = 'SITUATION_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
             
             // 检查单位占用状态（只有 full 状态无法分配）
             const unitIds = assignedUnits.map(unit => unit.unitId);
             const availability = await checkUnitsAvailability(unitIds);
 
             if (!availability.success) {
                 return res.send({ 
                     code: 409, 
                     msg: `以下单位已占满，无法分配: ${availability.fullUnitNames.join(', ')}` 
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
                 supportContent: supportContent || '',
                 assignedUnits: processedAssignedUnits,
                 issuePersonId,
                 issuePersonName,
                 issueTime: new Date(issueTime),
                 updateTime: updateTime ? new Date(updateTime) : new Date()
             });
 
             await fireSituation.save();
 
             // 更新单位占用状态
             for (const unit of processedAssignedUnits) {
                 const usingCars = extractUsingCars([unit]);
                 await updateUnitStatus(unit.unitId, unit.unitName, usingCars, currentSituationId);
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
             const { success: exists } = await checkSituationExists(situationId);
             if (!exists) {
                 return res.send({ code: 404, msg: '未找到指定的火灾情况' });
             }
             
             // 检查单位占用状态（只有 full 状态无法分配）
             const unitIds = assignedUnits.map(unit => unit.unitId);
             const availability = await checkUnitsAvailability(unitIds);
 
             if (!availability.success) {
                 return res.send({ 
                     code: 409, 
                     msg: `以下单位已占满，无法分配: ${availability.fullUnitNames.join(', ')}` 
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
             
             // 更新单位占用状态（自动合并车辆，不覆盖）
             for (const unit of updatedAssignedUnits) {
                 const newCars = extractUsingCars([unit]);
                 await updateUnitStatus(unit.unitId, unit.unitName, newCars, situationId);
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

        // 检查单位占用状态（只有 full 状态无法分配）
        const unitStatus = await FireUnitStatus.findOne({ unitId, status: 'full' });
        if (unitStatus) {
            return res.send({ 
                code: 409, 
                msg: `单位 ${unitName} 已占满，无法分配` 
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

        // 更新单位占用状态（自动合并车辆，不覆盖）
        const newCars = extractUsingCars([{ carInfo, taskGroups: [] }]);
        await updateUnitStatus(unitId, unitName, newCars, situationId);

        res.send({ code: 200, msg: '支援单位添加成功', data: { unitId, unitName } });
    } catch (err) {
        res.send({ code: 500, msg: '添加支援单位失败', error: err.message });
    }
});

// 释放单位占用状态（支持部分释放）
router.post('/releaseUnit', async (req, res) => {
    try {
        const { unitId, situationId, releaseCarIds = [] } = req.body || {};

        if (!unitId) {
            return res.send({ code: 400, msg: '缺少必填字段（unitId）' });
        }

        // 释放单位车辆（支持部分释放）
        const result = await releaseUnitCars(unitId, releaseCarIds, situationId);
        
        if (!result.success) {
            return res.send({ code: 400, msg: result.msg });
        }

        res.send({ 
            code: 200, 
            msg: releaseCarIds.length === 0 ? '单位全部释放成功' : `单位部分释放成功，已释放 ${result.releasedCount} 辆车`,
            data: { 
                unitId, 
                status: result.status,
                remainingCars: result.remainingCars,
                releasedCount: result.releasedCount
            } 
        });
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
        // taskType 模糊查询（在 assignedUnits.taskGroups.taskType 中）
        if (taskType) {
            query['assignedUnits.taskGroups.taskType'] = { $regex: taskType, $options: 'i' };
        }
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
        
        // 分页查询（按任务状态优先级排序：需要支援 > 正在支援 > 救援中 > 已完成）
        const pageNum = parseInt(page);
        const pageSizeNum = parseInt(pageSize);
        const skip = (pageNum - 1) * pageSizeNum;

        const situations = await FireSituation.aggregate([
            { $match: query },
            {
                $addFields: {
                    taskStatusOrder: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$taskStatus', 3] }, then: 0 }, // 需要支援
                                { case: { $eq: ['$taskStatus', 4] }, then: 1 }, // 正在支援
                                { case: { $in: ['$taskStatus', [2, 5]] }, then: 2 }, // 救援中（全部/局部）
                                { case: { $eq: ['$taskStatus', 1] }, then: 3 }, // 已完成
                            ],
                            default: 99
                        }
                    }
                }
            },
            { $sort: { taskStatusOrder: 1, issueTime: -1 } },
            { $skip: skip },
            { $limit: pageSizeNum }
        ]);
        
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
        
        // 验证 supportContent 字数限制（500字以内）
        if (updateData.supportContent !== undefined && updateData.supportContent !== null) {
            if (typeof updateData.supportContent !== 'string') {
                return res.send({ code: 400, msg: 'supportContent 必须是字符串类型' });
            }
            if (updateData.supportContent.length > 500) {
                return res.send({ code: 400, msg: 'supportContent 不能超过500字' });
            }
        }
        
        // 获取更新前的数据（用于对比车辆变化）
        const oldSituation = await FireSituation.findOne({ situationId: id }).lean();
        
        // 使用 situationId 字段查找和更新（使用 $set 确保所有字段都能正确更新）
        const situation = await FireSituation.findOneAndUpdate(
            { situationId: id }, 
            { $set: updateData }, 
            { new: true, runValidators: true }
        );
        
        if (!situation) {
            return res.send({ code: 404, msg: '未找到相关记录' });
        }
        
        // 如果更新了 assignedUnits，同步更新单位车辆使用情况
        if (updateData.assignedUnits && Array.isArray(updateData.assignedUnits)) {
            try {
                await syncAssignedUnitsCars(id, oldSituation, updateData.assignedUnits);
            } catch (err) {
                return res.send({ 
                    code: 409, 
                    msg: err.message || '同步单位车辆使用情况失败' 
                });
            }
        }
        
        // 如果状态更新为已完成(1)，释放所有关联的救援单位车辆
        if (updateData.taskStatus === 1) {
            await releaseSituationAllCars(id, situation);
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

        // 查询地址经纬度信息
        const location = situation.addressId
            ? await Location.findOne({ addressId: situation.addressId })
                .select('latitude longitude -_id')
                .lean()
            : null;

        // 返回详情数据
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                situationId: situation.situationId,
                addressId: situation.addressId,
                addressName: situation.addressName,
                latitude: location && location.latitude !== undefined ? location.latitude : null,
                longitude: location && location.longitude !== undefined ? location.longitude : null,
                locationType: situation.locationType,
                taskStatus: situation.taskStatus,
                remark: situation.remark || '',
                supportContent: (situation.supportContent !== undefined && situation.supportContent !== null) ? situation.supportContent : '',
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

// 更新火灾情况任务状态
router.put('/updateTaskStatus', async (req, res) => {
    try {
        const { situationId, taskStatus, supportContent } = req.body || {};
        
        // 参数校验
        if (!situationId) {
            return res.send({ code: 400, msg: '缺少必填字段（situationId）' });
        }
        
        if (taskStatus === undefined || taskStatus === null || taskStatus === '') {
            return res.send({ code: 400, msg: '缺少必填字段（taskStatus）' });
        }
        
        // 验证 taskStatus 是否有效（1-5）
        const statusNum = parseInt(taskStatus);
        if (isNaN(statusNum) || ![1, 2, 3, 4, 5].includes(statusNum)) {
            return res.send({ code: 400, msg: 'taskStatus 值无效，必须是 1-5 之间的数字（1-已完成，2-救援中（全部），3-需要支援，4-正在支援，5-救援中（局部））' });
        }
        
        // 验证 supportContent 字数限制（500字以内）
        if (supportContent !== undefined && supportContent !== null) {
            if (typeof supportContent !== 'string') {
                return res.send({ code: 400, msg: 'supportContent 必须是字符串类型' });
            }
            if (supportContent.length > 500) {
                return res.send({ code: 400, msg: 'supportContent 不能超过500字' });
            }
        }
        
        // 检查火灾情况是否存在
        const { success: exists, situation: existingSituation } = await checkSituationExists(situationId);
        if (!exists) {
            return res.send({ code: 404, msg: '未找到指定的火灾情况' });
        }
        
        // 如果状态没有变化且没有 supportContent 更新，直接返回
        if (existingSituation.taskStatus === statusNum && (supportContent === undefined || supportContent === null || supportContent === existingSituation.supportContent)) {
            return res.send({ 
                code: 200, 
                msg: '任务状态未发生变化', 
                data: {
                    situationId,
                    taskStatus: statusNum,
                    previousStatus: existingSituation.taskStatus
                }
            });
        }
        
        // 判断是否是撤销支援场景（3→2 或 4→2）
        const isRevokeSupport = (existingSituation.taskStatus === 3 || existingSituation.taskStatus === 4) && statusNum === 2;
        
        // 构建更新数据
        const updateData = {
            taskStatus: statusNum,
            updateTime: new Date()
        };
        
        // 如果是撤销支援场景（3→2 或 4→2），强制清空 supportContent
        if (isRevokeSupport) {
            updateData.supportContent = '';
        } else if (supportContent !== undefined && supportContent !== null) {
            // 如果提供了 supportContent，则更新
            updateData.supportContent = supportContent;
        }
        
        // 更新任务状态
        const situation = await FireSituation.findOneAndUpdate(
            { situationId },
            { $set: updateData },
            { new: true, runValidators: true }
        );
        
        if (!situation) {
            return res.send({ code: 404, msg: '更新失败，未找到相关记录' });
        }
        
        // 如果状态更新为已完成(1)，释放所有关联的救援单位车辆
        if (statusNum === 1) {
            await releaseSituationAllCars(situationId, situation);
        }
        
        // 构建返回消息
        let msg = '任务状态更新成功';
        if (isRevokeSupport) {
            msg = '任务状态更新成功，已清空支援内容';
        }
        
        res.send({ 
            code: 200, 
            msg: msg, 
            data: {
                situationId,
                taskStatus: statusNum,
                previousStatus: existingSituation.taskStatus,
                supportContent: situation.supportContent || '',
                updateTime: situation.updateTime
            }
        });
    } catch (err) {
        console.error('更新任务状态失败:', err);
        res.send({ code: 500, msg: '更新任务状态失败', error: err.message });
    }
});

// 单位和车辆状态查询接口（简化版，直接从 FireUnitStatus 读取）
router.get('/unitAndCarStatus', async (req, res) => {
    try {
        // 直接从 FireUnitStatus 获取所有单位状态
        const allUnitStatuses = await FireUnitStatus.find({}).lean();
        
        // 收集所有正在使用的车辆ID
        const usingCarIds = new Set();
        const unitCarMap = {}; // 单位-车辆映射关系
        
        for (const unitStatus of allUnitStatuses) {
            const unitId = unitStatus.unitId;
            const usingCars = unitStatus.usingCars || [];
            
            // 构建单位-车辆映射
            unitCarMap[unitId] = usingCars;
            
            // 收集所有使用的车辆ID
            for (const carId of usingCars) {
                if (carId) {
                    usingCarIds.add(carId);
                }
            }
        }
    
        res.send({
            code: 200,
            msg: '获取成功',
            data: {
                unitCarMap: unitCarMap
            }
        });
    } catch (err) {
        console.error('查询单位和车辆状态失败:', err);
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

module.exports = router;