const express = require('express');
const router = express.Router();
const dbmodel = require('../model/index.js');
const FireSituation = dbmodel.FireSituation;
const Location = dbmodel.Location;

/**
 * 获取地图作战信息列表
 * 按 addressId 和 addressName 分组，关联 fire 内的信息，以及作战地图信息（taskLocation）
 */
router.get('/list', async (req, res) => {
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            situationId,
            addressId,
            addressName,
            keyword,
            taskStatus,
            startTime,
            endTime
        } = req.query;
        
        // 构建查询条件
        const query = {};

        // 当传入 situationId 时，仅加载该 situationId 对应地址的数据
        if (situationId) {
            const targetSituation = await FireSituation.findOne({ situationId })
                .select('addressId -_id')
                .lean();

            if (!targetSituation || !targetSituation.addressId) {
                return res.send({
                    code: 200,
                    msg: '查询成功',
                    data: [],
                    pagination: {
                        page: parseInt(page),
                        pageSize: parseInt(pageSize),
                        total: 0,
                        pages: 0
                    }
                });
            }

            query.addressId = targetSituation.addressId;
        }
        
        // 基础查询条件
        if (addressId && !query.addressId) query.addressId = addressId;
        if (addressName && !situationId) query.addressName = { $regex: addressName, $options: 'i' };
        if (taskStatus) query.taskStatus = parseInt(taskStatus);
        
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
        if (keyword && !situationId) {
            query.$or = [
                { addressName: { $regex: keyword, $options: 'i' } },
                { addressId: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        // 查询所有符合条件的火灾情况
        const situations = await FireSituation.find(query)
            .sort({ issueTime: -1 })
            .lean();
        
        // 按 situationId 分开返回，不再按 address 合并
        let resultList = situations.map((situation) => {
            const fireInfo = {
                situationId: situation.situationId,
                taskStatus: situation.taskStatus,
                remark: situation.remark || '',
                supportContent: situation.supportContent || '',
                assignedUnits: situation.assignedUnits || [],
                issuePersonId: situation.issuePersonId,
                issuePersonName: situation.issuePersonName,
                issueTime: situation.issueTime,
                updateTime: situation.updateTime,
                taskLocations: []
            };

            const taskLocations = [];
            if (situation.assignedUnits && Array.isArray(situation.assignedUnits)) {
                for (const unit of situation.assignedUnits) {
                    if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
                        for (const taskGroup of unit.taskGroups) {
                            if (taskGroup.taskLocation) {
                                taskLocations.push({
                                    situationId: situation.situationId,
                                    unitId: unit.unitId,
                                    unitName: unit.unitName,
                                    taskType: taskGroup.taskType,
                                    taskLocation: taskGroup.taskLocation,
                                    carIds: taskGroup.carIds || [],
                                    carNames: taskGroup.carNames || [],
                                    floor: taskGroup.floor || '',
                                    direction: taskGroup.direction,
                                    description: taskGroup.description || '',
                                    taskExtra: taskGroup.taskExtra || {}
                                });
                            }
                        }
                    }
                }
            }

            fireInfo.taskLocations = taskLocations;

            return {
                situationId: situation.situationId,
                addressId: situation.addressId,
                addressName: situation.addressName,
                locationType: situation.locationType,
                fireSituations: [fireInfo]
            };
        }).filter(item => item.fireSituations[0].taskLocations && item.fireSituations[0].taskLocations.length > 0);
        
        // 分页处理
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const total = resultList.length;
        resultList = resultList.slice(skip, skip + parseInt(pageSize));
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: resultList,
            pagination: {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                total,
                pages: Math.ceil(total / parseInt(pageSize))
            }
        });
    } catch (err) {
        console.error('查询地图作战信息失败:', err);
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

/**
 * 根据 addressId 获取地图作战详情
 * 返回该地址的所有 fire 信息和 taskLocation 信息
 */
router.get('/detail', async (req, res) => {
    try {
        const { addressId } = req.query;
        
        if (!addressId) {
            return res.send({ code: 400, msg: '缺少必填参数：addressId' });
        }
        
        // 查询该地址的所有火灾情况
        const situations = await FireSituation.find({ addressId })
            .sort({ issueTime: -1 })
            .lean();
        
        if (!situations || situations.length === 0) {
            return res.send({
                code: 200,
                msg: '查询成功',
                data: {
                    addressId,
                    addressName: '',
                    locationType: null,
                    fireSituations: [],
                    taskLocations: []
                }
            });
        }
        
        // 获取地址基本信息（从第一个记录中获取）
        const firstSituation = situations[0];
        
        // 收集所有 fire 信息和 taskLocation
        const fireSituations = [];
        const taskLocations = [];
        
        for (const situation of situations) {
            // 收集 fire 信息
            const fireInfo = {
                situationId: situation.situationId,
                taskStatus: situation.taskStatus,
                remark: situation.remark || '',
                supportContent: situation.supportContent || '',
                assignedUnits: situation.assignedUnits || [],
                issuePersonId: situation.issuePersonId,
                issuePersonName: situation.issuePersonName,
                issueTime: situation.issueTime,
                updateTime: situation.updateTime
            };
            
            fireSituations.push(fireInfo);
            
            // 从 assignedUnits 的 taskGroups 中提取所有 taskLocation
            if (situation.assignedUnits && Array.isArray(situation.assignedUnits)) {
                for (const unit of situation.assignedUnits) {
                    if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
                        for (const taskGroup of unit.taskGroups) {
                            if (taskGroup.taskLocation) {
                                taskLocations.push({
                                    situationId: situation.situationId,
                                    unitId: unit.unitId,
                                    unitName: unit.unitName,
                                    taskType: taskGroup.taskType,
                                    taskLocation: taskGroup.taskLocation,
                                    carIds: taskGroup.carIds || [],
                                    carNames: taskGroup.carNames || [],
                                    floor: taskGroup.floor || '',
                                    direction: taskGroup.direction,
                                    description: taskGroup.description || '',
                                    taskExtra: taskGroup.taskExtra || {}
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // 尝试从 Location 表获取地址的详细信息（如经纬度等）
        let locationInfo = null;
        try {
            locationInfo = await Location.findOne({ addressId }).lean();
        } catch (err) {
            console.error('查询地址详细信息失败:', err);
        }
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                addressId: firstSituation.addressId,
                addressName: firstSituation.addressName,
                locationType: firstSituation.locationType,
                locationInfo: locationInfo ? {
                    latitude: locationInfo.latitude,
                    longitude: locationInfo.longitude,
                    addressExt: locationInfo.addressExt,
                    allSenceLink: locationInfo.allSenceLink,
                    defaultImg: locationInfo.defaultImg,
                    imgList: locationInfo.imgList || []
                } : null,
                fireSituations,
                taskLocations
            }
        });
    } catch (err) {
        console.error('查询地图作战详情失败:', err);
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

/**
 * 获取所有有 taskLocation 的地址列表（用于地图展示）
 */
router.get('/mapPoints', async (req, res) => {
    try {
        // 查询所有有 taskLocation 的火灾情况
        const situations = await FireSituation.find({
            'assignedUnits.taskGroups.taskLocation': { $exists: true, $ne: null }
        }).lean();
        
        // 收集所有 taskLocation 信息
        const mapPoints = [];
        const addressMap = new Map();
        
        for (const situation of situations) {
            if (situation.assignedUnits && Array.isArray(situation.assignedUnits)) {
                for (const unit of situation.assignedUnits) {
                    if (unit.taskGroups && Array.isArray(unit.taskGroups)) {
                        for (const taskGroup of unit.taskGroups) {
                            if (taskGroup.taskLocation) {
                                const taskLocation = taskGroup.taskLocation;
                                
                                // 如果 taskLocation 有经纬度信息，添加到地图点列表
                                if (taskLocation.latitude && taskLocation.longitude) {
                                    mapPoints.push({
                                        addressId: situation.addressId,
                                        addressName: situation.addressName,
                                        situationId: situation.situationId,
                                        unitId: unit.unitId,
                                        unitName: unit.unitName,
                                        taskType: taskGroup.taskType,
                                        latitude: taskLocation.latitude,
                                        longitude: taskLocation.longitude,
                                        taskLocationAddressName: taskLocation.addressName || '',
                                        taskLocationAddress: taskLocation.address || '',
                                        carIds: taskGroup.carIds || [],
                                        carNames: taskGroup.carNames || [],
                                        floor: taskGroup.floor || '',
                                        description: taskGroup.description || ''
                                    });
                                }
                                
                                // 按地址分组统计
                                const key = `${situation.addressId}_${situation.addressName}`;
                                if (!addressMap.has(key)) {
                                    addressMap.set(key, {
                                        addressId: situation.addressId,
                                        addressName: situation.addressName,
                                        locationType: situation.locationType,
                                        count: 0
                                    });
                                }
                                addressMap.get(key).count++;
                            }
                        }
                    }
                }
            }
        }
        
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                mapPoints,
                addressSummary: Array.from(addressMap.values())
            }
        });
    } catch (err) {
        console.error('查询地图点位失败:', err);
        res.send({ code: 500, msg: '查询失败', error: err.message });
    }
});

module.exports = router;

