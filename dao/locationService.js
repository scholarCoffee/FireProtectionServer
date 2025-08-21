const dbmodel = require('../model/index.js');
const Location = dbmodel.Location;
const { getFireSafetyScoreByAddressId, createDefaultFireSafetyScore, deleteFireSafetyScoreByAddressId } = require('./fireSafetyScoreService.js');

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
            safetyLevelId: fireSafetyScoreData.safetyLevelId || 1,
            safetyLevelName: fireSafetyScoreData.safetyLevelName || '一般',
            safetyColor: fireSafetyScoreData.safetyColor || '灰色',
            safetyCssClass: fireSafetyScoreData.safetyCssClass || 'safety-unknown',
            safetyCssColor: fireSafetyScoreData.safetyCssColor || '#999999',
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
                        battleDeploymentMaterials: locationObj.battleDeploymentMaterials || [],
                        householdOwnerName: locationObj.householdOwnerName || '',
                        householdOwnerPhone: locationObj.householdOwnerPhone || '',
                        householdFeedback: locationObj.householdFeedback || '',
                        rescueRemark: locationObj.rescueRemark || '',
                        fireSafetyScore: fireSafetyScore || null
                    };
                } catch (err) {
                    console.error(`查询地址 ${location.addressId} 的安全信息失败:`, err);
                    const locationObj = location.toObject();
                    return {
                        ...locationObj,
                        // 确保新增字段存在（向后兼容）
                        battleDeploymentMaterials: locationObj.battleDeploymentMaterials || [],
                        householdOwnerName: locationObj.householdOwnerName || '',
                        householdOwnerPhone: locationObj.householdOwnerPhone || '',
                        householdFeedback: locationObj.householdFeedback || '',
                        rescueRemark: locationObj.rescueRemark || '',
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

        // 确保新增字段存在（向后兼容）
        const enhancedDetail = {
            ...detail,
            battleDeploymentMaterials: detail.battleDeploymentMaterials || [],
            householdOwnerName: detail.householdOwnerName || '',
            householdOwnerPhone: detail.householdOwnerPhone || '',
            householdFeedback: detail.householdFeedback || '',
            rescueRemark: detail.rescueRemark || ''
        };

        // 查询关联的消防安全评分信息
        let fireSafetyScore = null;
        try {
            fireSafetyScore = await getFireSafetyScoreByAddressId(addressId)
        } catch (err) {
            console.error('查询消防安全评分失败:', err);
        }
        console.log('detail', detail);
        console.log('fireSafetyScore', fireSafetyScore);
        res.send({ code: 200, msg: 'ok', data: { ...enhancedDetail, fireSafetyScore } });
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
        return {
            ...location.toObject(),
            battleDeploymentMaterials: location.battleDeploymentMaterials || [],
            householdOwnerName: location.householdOwnerName || '',
            householdOwnerPhone: location.householdOwnerPhone || '',
            householdFeedback: location.householdFeedback || '',
            rescueRemark: location.rescueRemark || ''
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
                case 3: // 沿街商铺
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
                    case 3: // 沿街商铺
                        updateData.defaultImg = '/static/icons/location/showShop.png';
                        break;
                    default:
                        updateData.defaultImg = '/static/icons/location/showLocation.png';
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

        // 如果类型发生变化且没有提供defaultImg，自动更新defaultImg
        if (updateData.type && updateData.type !== existingLocation.type && !updateData.defaultImg) {
            switch (updateData.type) {
                case 1: // 高层小区
                    updateData.defaultImg = '/static/icons/location/showLocation.png';
                    break;
                case 2: // 重点单位
                    updateData.defaultImg = '/static/icons/location/factory.png';
                    break;
                case 3: // 沿街商铺
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
                    safetyLevelId: 1,
                    safetyLevelName: '一般',
                    safetyColor: '黄色',
                    safetyCssClass: 'safety-normal',
                    safetyCssColor: '#faad14',
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