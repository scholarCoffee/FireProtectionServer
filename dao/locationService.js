const dbmodel = require('../model/index.js');
const Location = dbmodel.Location;
const { getFireSafetyScoreByAddressId, createDefaultFireSafetyScore, deleteFireSafetyScoreByAddressId } = require('./fireSafetyScoreService.js');
const axios = require('axios');

// 关键字类型映射表
const KEYWORD_TYPE_MAP = {
    'yushanForestPanorama': 'panorama',
    'yushanCityPanorama': 'panorama',
    'yushanForestHydrant': 'hydrant',
    'yushanCityHydrant': 'hydrant'
};

// 根据 keywordType 获取 category
const getCategoryByKeywordType = (keywordType) => {
    return KEYWORD_TYPE_MAP[keywordType] || null;
};

// 验证队站辖区（type=3）的字段
const validateLocationData = (locationData, isUpdate = false) => {
    const errors = [];
    
    // 如果是队站辖区（type=3）
    if (locationData.type === 3) {
        const category = getCategoryByKeywordType(locationData.keywordType);
        if (!category) {
            errors.push(`无效的关键字类型：${locationData.keywordType}`);
            return { valid: false, errors };
        }
        
        // 全景云模式验证
        if (category === 'panorama') {
            if (!locationData.addressName || !locationData.addressName.trim()) {
                errors.push('地址名称为必填项');
            }
            if (!locationData.addressId || !locationData.addressId.trim()) {
                errors.push('全景云编号为必填项');
            }
            if (!locationData.allSenceLink || !locationData.allSenceLink.trim()) {
                errors.push('全景云地址为必填项');
            }
            // 全景云模式下，addressExt 不验证，如果为空则设置为空字符串
            if (!locationData.addressExt) {
                locationData.addressExt = '';
            }
        }
        
        // 消火栓模式验证
        if (category === 'hydrant') {
            if (!locationData.addressName || !locationData.addressName.trim()) {
                errors.push('地址名称为必填项');
            }
            if (!locationData.addressId || !locationData.addressId.trim()) {
                errors.push('消火栓编号为必填项');
            }
            if (!locationData.addressExt || !locationData.addressExt.trim()) {
                errors.push('详细地址为必填项');
            }
            if (!locationData.hydrantPressure || !locationData.hydrantPressure.trim()) {
                errors.push('消火栓压力为必填项');
            }
            if (!locationData.hydrantFlow || !locationData.hydrantFlow.trim()) {
                errors.push('消火栓流量为必填项');
            }
            
            // 验证压力和流量格式（应为数字字符串）
            if (locationData.hydrantPressure && isNaN(parseFloat(locationData.hydrantPressure))) {
                errors.push('消火栓压力必须是数字');
            }
            if (locationData.hydrantFlow && isNaN(parseFloat(locationData.hydrantFlow))) {
                errors.push('消火栓流量必须是数字');
            }
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
};

// 新增：处理消防安全评分数据的辅助函数
const createFireSafetyScoreFromData = async (fireSafetyScoreData, addressId, addressName, safeId) => {
    try {
        const FireSafetyScore = dbmodel.FireSafetyScore;
        
        // 检查是否已存在
        const existingScore = await FireSafetyScore.findOne({ addressId });
        if (existingScore) {
            return existingScore;
        }

        // 计算总分和最高可能分数
        let totalScore = 0;
        let maxPossibleScore = 0;
        
        if (fireSafetyScoreData.scoreItems) {
            // 计算实际得分
            for (const [itemId, itemData] of Object.entries(fireSafetyScoreData.scoreItems)) {
                totalScore += itemData.score || 0;
            }
            
            // 估算最高可能分数（假设每个项目最高10分）
            maxPossibleScore = Object.keys(fireSafetyScoreData.scoreItems).length * 10;
        }
        
        const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
        
        // 构建消防安全评分数据
        const newScoreData = {
            safeId,
            addressId,
            addressName,
            scoreItems: fireSafetyScoreData.scoreItems || {},
            totalScore,
            maxPossibleScore,
            scorePercentage,
            safeLevelId: fireSafetyScoreData.safeLevelId || 1,
            safeLevelName: fireSafetyScoreData.safeLevelName || '一般',
            isLocal: fireSafetyScoreData.isLocal || false,
            createTime: new Date(),
            updateTime: new Date()
        };

        const newScore = new FireSafetyScore(newScoreData);
        const result = await newScore.save();
        console.log(`为地址 ${addressId} 创建了消防安全评分记录`);
        return result;
    } catch (err) {
        console.error(`创建消防安全评分记录失败(${addressId}):`, err);
        throw err;
    }
};

// 地址列表查询（支持分页和模糊搜索）
exports.getLocationList = async (req, res) => {
    console.log('地址列表查询:', req.query);
    try {
        const { 
            page = 1, 
            pageSize = 10, 
            keyword = '', 
            type = ''
        } = req.query

        // 构建查询条件
        let query = {};
        
        // 关键词模糊搜索（地址名称、详细地址）
        if (keyword) {
            query.$or = [
                { addressId: { $regex: keyword, $options: 'i' } },
                { addressName: { $regex: keyword, $options: 'i' } },
                { addressExt: { $regex: keyword, $options: 'i' } }
            ];
        }
        
        // 单位类型筛选
        if (type && type !== '') {
            query.type = parseInt(type);
        }
        // 计算分页参数
        const skip = (parseInt(page) - 1) * parseInt(pageSize);
        const limit = parseInt(pageSize);

        // 执行查询
        const [list, total] = await Promise.all([
            Location.find(query, { _id: 0, __v: 0 })
                .sort({ createTime: -1 })
                .skip(skip)
                .limit(limit),
            Location.countDocuments(query)
        ]);

        // 为每个地址查询关联的消防安全评分信息，并确保新增字段存在
        const listWithSafetyInfo = await Promise.all(
            list.map(async (location) => {
                try {
                    const fireSafetyScore = await getFireSafetyScoreByAddressId(location.addressId);
                    const locationObj = location.toObject();
                    return {
                        ...locationObj,
                        // 确保新增字段存在（向后兼容）
                        fireUnitDeploymentMap: Array.isArray(locationObj.fireUnitDeploymentMap) ? locationObj.fireUnitDeploymentMap : [],
                        keywordType: locationObj.keywordType || null,
                        hydrantPressure: locationObj.hydrantPressure || null,
                        hydrantFlow: locationObj.hydrantFlow || null,
                        fireSafetyScore: fireSafetyScore || null
                    };
                } catch (err) {
                    console.error(`查询地址 ${location.addressId} 的安全信息失败:`, err);
                    const locationObj = location.toObject();
                    return {
                        ...locationObj,
                        // 确保新增字段存在（向后兼容）
                        fireUnitDeploymentMap: Array.isArray(locationObj.fireUnitDeploymentMap) ? locationObj.fireUnitDeploymentMap : [],
                        keywordType: locationObj.keywordType || null,
                        hydrantPressure: locationObj.hydrantPressure || null,
                        hydrantFlow: locationObj.hydrantFlow || null,
                        fireSafetyScore: null
                    };
                }
            })
        );

        // 计算分页信息
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        res.send({
            code: 200,
            msg: 'ok',
            data: {
                list: listWithSafetyInfo,
                pagination: {
                    current: parseInt(page),
                    pageSize: limit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev
                }
            }
        });
    } catch (err) {
        console.error('地址列表查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 地址明细查询
exports.getLocationDetail = async (req, res) => {
    try {
        const { addressId } = req.query
        if (!addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少addressId参数' 
            });
        }

        const detail = await Location.findOne(
            { addressId },
            { _id: 0, __v: 0 }
        ).lean();

        if (!detail) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        // 查询关联的户主信息统计
        const OwnerInfo = dbmodel.OwnerInfo;
        const ownerStats = await OwnerInfo.aggregate([
            { $match: { addressId: addressId } },
            { $group: { 
                _id: null, 
                total: { $sum: 1 },
                count: { $sum: 1 }
            }}
        ]);

        // 过滤和重组返回数据，符合API文档格式
        const filteredDetail = {
            addressId: detail.addressId,
            addressName: detail.addressName,
            addressExt: detail.addressExt,
            allSenceLink: detail.allSenceLink,
            type: detail.type,
            safeId: detail.safeId,
            defaultImg: detail.defaultImg,
            description: detail.description,
            imgList: detail.imgList || [],
            phoneList: detail.phoneList || [],
            enterGateList: detail.enterGateList || [],
            fireUnitDeploymentMap: Array.isArray(detail.fireUnitDeploymentMap) ? detail.fireUnitDeploymentMap : [],
            // 经纬度信息
            latitude: detail.latitude || null,
            longitude: detail.longitude || null,
            // 队站辖区关键字类型字段
            keywordType: detail.keywordType || null,
            // 消火栓性能参数（仅消火栓模式返回）
            hydrantPressure: detail.hydrantPressure || null,
            hydrantFlow: detail.hydrantFlow || null,
            ownerInfo: {
                total: ownerStats.length > 0 ? ownerStats[0].total : 0,
                count: ownerStats.length > 0 ? ownerStats[0].count : 0
            },
            createTime: detail.createTime,
            updateTime: detail.updateTime
        };

        // 查询关联的消防安全评分信息
        let fireSafetyScore = null;
        try {
            fireSafetyScore = await getFireSafetyScoreByAddressId(addressId)
        } catch (err) {
            console.error('查询消防安全评分失败:', err);
        }
        
        console.log('filteredDetail', filteredDetail);
        console.log('fireSafetyScore', fireSafetyScore);
        
        res.send({ 
            code: 200, 
            msg: 'success', 
            data: { ...filteredDetail, fireSafetyScore } 
        });
    } catch (err) {
        console.error('地址明细查询失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
};

// 根据ID查询地址信息
exports.getLocationById = async (addressId) => {
    try {
        const location = await Location.findOne({ addressId }, { _id: 0, __v: 0 });
        if (!location) return null;
        
        // 确保新增字段存在（向后兼容）
        const locationObj = location.toObject();
        return {
            ...locationObj,
            fireUnitDeploymentMap: Array.isArray(locationObj.fireUnitDeploymentMap) ? locationObj.fireUnitDeploymentMap : [],
            latitude: locationObj.latitude || null,
            longitude: locationObj.longitude || null,
            keywordType: locationObj.keywordType || null,
            hydrantPressure: locationObj.hydrantPressure || null,
            hydrantFlow: locationObj.hydrantFlow || null
        };
    } catch (err) {
        console.error('根据ID查询地址失败:', err);
        throw err;
    }
};

// 新增地址信息
exports.addLocation = async (req, res) => {
    try {
        const locationData = req.body;
        // 统一收敛：字段清理与默认值
        if (!Array.isArray(locationData.fireUnitDeploymentMap)) {
            locationData.fireUnitDeploymentMap = [];
        }
        
        // 处理队站辖区的 keywordType 字段（type=3）
        if (locationData.type === 3) {
            // 如果没有提供 keywordType，设置默认值
            if (!locationData.keywordType) {
                locationData.keywordType = 'yushanForestPanorama';
            }
            
            // 验证队站辖区数据
            const validation = validateLocationData(locationData);
            if (!validation.valid) {
                return res.send({
                    code: 400,
                    msg: validation.errors.join('; '),
                    data: null
                });
            }
        }
        
        // 检查addressId是否已存在
        const existingLocation = await Location.findOne({ 
            addressId: locationData.addressId 
        });
        
        if (existingLocation) {
            return res.send({ 
                code: 400, 
                msg: '地址ID已存在' 
            });
        }

        // 如果没有提供safeId，自动生成一个
        if (!locationData.safeId) {
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 1000);
            locationData.safeId = `SAFE${timestamp}${randomNum}`;
        }

        // 如果没有提供defaultImg，根据类型自动设置
        if (!locationData.defaultImg) {
            const type = locationData.type || 1;
            switch (type) {
                case 1: // 高层小区
                    locationData.defaultImg = '/static/icons/location/showLocation.png';
                    break;
                case 2: // 重点单位
                    locationData.defaultImg = '/static/icons/location/factory.png';
                    break;
                case 3: // 队站辖区
                    locationData.defaultImg = '/static/icons/location/showShop.png';
                    break;
                default:
                    locationData.defaultImg = '/static/icons/location/showLocation.png';
            }
        }

        const newLocation = new Location(locationData);
        const result = await newLocation.save();

        // 自动创建消防安全评分记录
        try {
            await createDefaultFireSafetyScore(
                locationData.addressId,
                locationData.addressName,
                locationData.safeId
            );
            console.log(`为地址 ${locationData.addressId} 自动创建了安全评分记录`);
        } catch (safetyErr) {
            console.warn(`为地址 ${locationData.addressId} 创建安全评分记录失败:`, safetyErr.message);
            // 不阻止地址创建，只记录警告
        }

        res.send({ code: 200, msg: 'ok', data: { addressId: result.addressId } });
    } catch (err) {
        console.error('添加地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '添加失败', 
            error: err.message 
        });
    }
};

// 更新地址信息
exports.updateLocation = async (req, res) => {
    try {
        const updateData = req.body;
        updateData.updateTime = new Date();
        // 字段清理与默认值
        if (!Array.isArray(updateData.fireUnitDeploymentMap)) {
            updateData.fireUnitDeploymentMap = [];
        }

        // 检查地址是否存在
        const existingLocation = await Location.findOne({ addressId: updateData.addressId });
        if (!existingLocation) {
            // 如果地址不存在，则创建一个新的地址
            console.log(`地址 ${updateData.addressId} 不存在，开始创建新地址`);
            
            // 设置创建时间
            updateData.createTime = new Date();
            
            // 如果没有提供safeId，自动生成一个
            if (!updateData.safeId) {
                const timestamp = Date.now();
                const randomNum = Math.floor(Math.random() * 1000);
                updateData.safeId = `SAFE${timestamp}${randomNum}`;
            }

            // 如果没有提供defaultImg，根据类型自动设置
            if (!updateData.defaultImg) {
                const type = updateData.type || 1;
                switch (type) {
                    case 1: // 高层小区
                        updateData.defaultImg = '/static/icons/location/showLocation.png';
                        break;
                    case 2: // 重点单位
                        updateData.defaultImg = '/static/icons/location/factory.png';
                        break;
                    case 3: // 队站辖区
                        updateData.defaultImg = '/static/icons/location/showShop.png';
                        break;
                    default:
                        updateData.defaultImg = '/static/icons/location/showLocation.png';
                }
            }

            // 处理队站辖区的 keywordType 字段（type=3）
            if (updateData.type === 3) {
                // 如果没有提供 keywordType，设置默认值
                if (!updateData.keywordType) {
                    updateData.keywordType = 'yushanForestPanorama';
                }
                
                // 验证队站辖区数据
                const validation = validateLocationData(updateData);
                if (!validation.valid) {
                    return res.send({
                        code: 400,
                        msg: validation.errors.join('; '),
                        data: null
                    });
                }
            }

            // 创建新地址
            const newLocation = new Location(updateData);
            const result = await newLocation.save();
            console.log(`成功创建地址 ${updateData.addressId}`);

            // 处理消防安全评分数据
            if (updateData.fireSafetyScore) {
                try {
                    await createFireSafetyScoreFromData(
                        updateData.fireSafetyScore,
                        updateData.addressId,
                        updateData.addressName,
                        updateData.safeId
                    );
                } catch (safetyErr) {
                    console.warn(`创建消防安全评分记录失败:`, safetyErr.message);
                    // 不阻止地址创建，只记录警告
                }
            } else {
                // 如果没有提供消防安全评分数据，创建默认记录
                try {
                    await createDefaultFireSafetyScore(
                        updateData.addressId,
                        updateData.addressName,
                        updateData.safeId
                    );
                    console.log(`为地址 ${updateData.addressId} 自动创建了默认安全评分记录`);
                } catch (safetyErr) {
                    console.warn(`创建默认安全评分记录失败:`, safetyErr.message);
                }
            }

            return res.send({
                code: 200,
                msg: '地址不存在，已创建',
                data: result
            });
        }

        // 如果地址存在，继续更新逻辑
        // 如果没有safeId，自动生成一个
        if (!updateData.safeId && !existingLocation.safeId) {
            const timestamp = Date.now();
            const randomNum = Math.floor(Math.random() * 1000);
            updateData.safeId = `SAFE${timestamp}${randomNum}`;
        }

        // 处理队站辖区的 keywordType 字段（type=3）
        const targetType = updateData.type !== undefined ? updateData.type : existingLocation.type;
        if (targetType === 3) {
            // 队站辖区类型，如果传入 keywordType，保存到数据库
            if (updateData.keywordType !== undefined) {
                updateData.keywordType = updateData.keywordType;
            } else if (!existingLocation.keywordType) {
                // 如果现有数据没有 keywordType，设置默认值
                updateData.keywordType = 'yushanForestPanorama';
            }
            
            // 合并现有数据用于验证（如果某些字段未更新）
            const dataForValidation = {
                ...existingLocation.toObject(),
                ...updateData
            };
            
            // 验证队站辖区数据
            const validation = validateLocationData(dataForValidation);
            if (!validation.valid) {
                return res.send({
                    code: 400,
                    msg: validation.errors.join('; '),
                    data: null
                });
            }
        } else {
            // 非队站辖区类型，清除相关字段（设置为 null 以便 MongoDB 可以更新）
            if (updateData.type !== undefined) {
                updateData.keywordType = null;
                updateData.hydrantPressure = null;
                updateData.hydrantFlow = null;
            }
        }

        // 如果类型发生变化且没有提供defaultImg，自动更新defaultImg
        if (updateData.type && updateData.type !== existingLocation.type && !updateData.defaultImg) {
            switch (updateData.type) {
                case 1: // 高层小区
                    updateData.defaultImg = '/static/icons/location/showLocation.png';
                    break;
                case 2: // 重点单位
                    updateData.defaultImg = '/static/icons/location/factory.png';
                    break;
                case 3: // 队站辖区
                    updateData.defaultImg = '/static/icons/location/showShop.png';
                    break;
                default:
                    updateData.defaultImg = '/static/icons/location/showLocation.png';
            }
        }

        const result = await Location.findOneAndUpdate(
            { addressId: updateData.addressId },
            updateData,
            { new: true, runValidators: true }
        );

        // 若请求体带有 fireSafetyScore，则同步写入或创建评分记录
        if (updateData.fireSafetyScore && updateData.fireSafetyScore.scoreItems) {
            try {
                const FireSafetyScore = dbmodel.FireSafetyScore;
                const existingSafety = await FireSafetyScore.findOne({ addressId: updateData.addressId });

                // 粗略计算（与前端一致）：合计得分与百分比
                const scoreItemsObj = updateData.fireSafetyScore.scoreItems || {};
                let totalScore = 0;
                let itemCount = 0;
                Object.values(scoreItemsObj).forEach((item) => {
                    if (item && typeof item.score === 'number') {
                        totalScore += item.score;
                        itemCount += 1;
                    }
                });
                const maxPossibleScore = itemCount * 10;
                const scorePercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

                const safetyDoc = {
                    safeId: result?.safeId || existingLocation.safeId,
                    addressId: updateData.addressId,
                    addressName: updateData.addressName || existingLocation.addressName,
                    scoreItems: new Map(Object.entries(scoreItemsObj)),
                    totalScore,
                    maxPossibleScore,
                    scorePercentage,
                    safeLevelId: updateData.fireSafetyScore.safeLevelId,
                    safeLevelName: updateData.fireSafetyScore.safeLevelName,
                    updateTime: new Date()
                };

                if (existingSafety) {
                    await FireSafetyScore.updateOne({ _id: existingSafety._id }, safetyDoc);
                } else {
                    safetyDoc.createTime = new Date();
                    await new FireSafetyScore(safetyDoc).save();
                }
            } catch (syncErr) {
                console.warn('同步消防安全评分失败:', syncErr.message);
            }
        }

        // 若该地址还未有安全评分记录，则自动创建一条默认记录
        try {
            const safety = await getFireSafetyScoreByAddressId(updateData.addressId);
            const finalSafeId = result?.safeId || updateData.safeId || existingLocation.safeId;
            if (!safety && finalSafeId) {
                await createDefaultFireSafetyScore(
                    updateData.addressId,
                    updateData.addressName || existingLocation.addressName,
                    finalSafeId
                );
                console.log(`为地址 ${updateData.addressId} 自动创建了缺失的安全评分记录`);
            }
        } catch (autoCreateErr) {
            console.warn(`自动创建安全评分记录失败(${updateData.addressId}):`, autoCreateErr.message);
        }

        // 如果地址名称发生变化，更新对应的安全评分记录
        if (updateData.addressName && updateData.addressName !== existingLocation.addressName) {
            try {
                const fireSafetyScore = await getFireSafetyScoreByAddressId(updateData.addressId);
                if (fireSafetyScore) {
                    // 更新现有记录
                    await fireSafetyScore.updateOne({
                        addressName: updateData.addressName,
                        updateTime: new Date()
                    });
                    console.log(`更新了地址 ${updateData.addressId} 的安全评分记录中的地址名称`);
                }
            } catch (safetyErr) {
                console.warn(`更新地址 ${updateData.addressId} 的安全评分记录失败:`, safetyErr.message);
            }
        }

        res.send({ code: 200, msg: 'ok', data: { addressId: result.addressId } });
    } catch (err) {
        console.error('更新地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '更新失败', 
            error: err.message 
        });
    }
};

// 删除地址信息
exports.deleteLocation = async (req, res) => {
    try {
        const { addressId } = req.body

        if (!addressId) {
            return res.send({ 
                code: 400, 
                msg: '缺少addressId参数' 
            });
        }

        // 先删除对应的消防安全评分记录
        try {
            await deleteFireSafetyScoreByAddressId(addressId);
            console.log(`已删除地址 ${addressId} 的消防安全评分记录`);
        } catch (safetyErr) {
            console.warn(`删除地址 ${addressId} 的消防安全评分记录失败:`, safetyErr.message);
            // 不阻止地址删除，只记录警告
        }

        // 删除地址信息
        const result = await Location.findOneAndDelete({ addressId });

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        console.log(`成功删除地址 ${addressId} 及其相关信息`);

        res.send({ code: 200, msg: 'ok', data: { addressId } });
    } catch (err) {
        console.error('删除地址失败:', err);
        res.send({ 
            code: 500, 
            msg: '删除失败', 
            error: err.message 
        });
    }
};

// 获取地址统计信息
exports.getLocationStats = async (req, res) => {
    try {
        const [totalCount, typeStats] = await Promise.all([
            Location.countDocuments(),
            Location.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ])
        ]);

        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                totalCount,
                typeStats
            }
        });
    } catch (err) {
        console.error('获取统计信息失败:', err);
        res.send({ 
            code: 500, 
            msg: '查询失败', 
            error: err.message 
        });
    }
}; 

// 校验地址编号是否唯一且格式正确（仅允许填写一个）
exports.checkAddressId = async (req, res) => {
    try {
        const addressId = (req.query.addressId || req.body?.addressId || '').trim();

        if (!addressId) {
            return res.send({ code: 400, msg: '缺少addressId参数' });
        }

        // 规则：地址编号只能填写一个，简单检测逗号/空白分隔的复数输入
        const splitByComma = addressId.split(',').map(s => s.trim()).filter(Boolean);
        const splitBySpace = addressId.split(/\s+/).map(s => s.trim()).filter(Boolean);
        if (splitByComma.length > 1 || splitBySpace.length > 1) {
            return res.send({ code: 400, msg: '地址编号只能填写一个' });
        }

        const exists = await Location.findOne({ addressId }, { _id: 1 }).lean();
        if (exists) {
            return res.send({ code: 200, msg: '地址编号已存在', data: { exists: true } });
        }
        return res.send({ code: 200, msg: '地址编号可用', data: { exists: false } });
    } catch (err) {
        console.error('检查地址编号失败:', err);
        res.send({ code: 500, msg: '检查失败', error: err.message });
    }
};

// 腾讯地图API配置（建议通过环境变量配置）
const TENCENT_MAP_CONFIG = {
    key: process.env.TENCENT_MAP_KEY || 'OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77' // 默认key，建议使用环境变量
};

// 反向地理编码（根据经纬度获取地址信息）
exports.reverseGeocode = async (req, res) => {
    try {
        // 从查询参数获取经纬度
        const latitude = parseFloat(req.query.latitude);
        const longitude = parseFloat(req.query.longitude);

        // 参数验证
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            return res.send({
                code: 400,
                msg: '缺少必要的参数：latitude 和 longitude',
                data: {
                    name: null,
                    address: null,
                    fullAddress: null
                }
            });
        }

        // 验证经纬度范围
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.send({
                code: 400,
                msg: '经纬度范围无效',
                data: {
                    name: null,
                    address: null,
                    fullAddress: null
                }
            });
        }

        // 调用腾讯地图反向地理编码API
        const apiUrl = 'https://apis.map.qq.com/ws/geocoder/v1/';
        const params = {
            location: `${latitude},${longitude}`,
            key: TENCENT_MAP_CONFIG.key,
            get_poi: 0 // 不返回周边POI
        };

        try {
            const response = await axios.get(apiUrl, { params });
            const result = response.data;

            // 检查API返回状态
            if (result.status !== 0) {
                console.error('腾讯地图API错误:', result.message);
                // API调用失败时，返回经纬度信息
                return res.send({
                    code: 200,
                    msg: '获取地址信息失败，返回经纬度',
                    data: {
                        name: null,
                        address: null,
                        fullAddress: null,
                        latitude: latitude,
                        longitude: longitude
                    }
                });
            }

            // 解析腾讯地图返回的数据
            const addressComponent = result.result?.address_component || {};
            const formattedAddress = result.result?.formatted_addresses?.recommend || result.result?.address || '';
            const address = result.result?.address || '';

            // 构建返回数据
            const responseData = {
                name: addressComponent.street || addressComponent.street_number || addressComponent.district || '',
                address: address || formattedAddress,
                fullAddress: formattedAddress || address,
                // 腾讯地图返回的详细地址组件
                province: addressComponent.province || '',
                city: addressComponent.city || '',
                district: addressComponent.district || '',
                street: addressComponent.street || '',
                streetNumber: addressComponent.street_number || '',
                // 原始经纬度
                latitude: latitude,
                longitude: longitude
            };

            return res.send({
                code: 200,
                msg: 'success',
                data: responseData
            });

        } catch (apiError) {
            console.error('调用腾讯地图API失败:', apiError.message);
            // API调用异常时，返回经纬度信息
            return res.send({
                code: 200,
                msg: '获取地址信息失败，返回经纬度',
                data: {
                    name: null,
                    address: null,
                    fullAddress: null,
                    latitude: latitude,
                    longitude: longitude
                }
            });
        }

    } catch (err) {
        console.error('反向地理编码失败:', err);
        res.send({
            code: 500,
            msg: '处理失败',
            error: err.message,
            data: {
                name: null,
                address: null,
                fullAddress: null
            }
        });
    }
};