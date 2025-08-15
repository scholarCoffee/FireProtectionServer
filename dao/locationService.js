const dbmodel = require('../model/index.js');
const Location = dbmodel.Location;
const { getFireSafetyScoreByAddressId, createDefaultFireSafetyScore } = require('./fireSafetyScoreService.js');

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

        // 为每个地址查询关联的消防安全评分信息
        const listWithSafetyInfo = await Promise.all(
            list.map(async (location) => {
                try {
                    const fireSafetyScore = await getFireSafetyScoreByAddressId(location.addressId);
                    return {
                        ...location.toObject(),
                        fireSafetyScore: fireSafetyScore || null
                    };
                } catch (err) {
                    console.error(`查询地址 ${location.addressId} 的安全信息失败:`, err);
                    return {
                        ...location.toObject(),
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
            msg: '查询成功',
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
            { addressId }
        ).lean();

        if (!detail) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        // 查询关联的消防安全评分信息
        try {
            fireSafetyScore = await getFireSafetyScoreByAddressId(addressId)
        } catch (err) {
            console.error('查询消防安全评分失败:', err);
        }
        console.log('detail', detail);
        console.log('fireSafetyScore', fireSafetyScore);
        res.send({
            code: 200,
            msg: '查询成功',
            data: {
                ...detail,
                fireSafetyScore
            }
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
        return await Location.findOne({ addressId }, { _id: 0, __v: 0 });
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

        res.send({
            code: 200,
            msg: '添加成功',
            data: result
        });
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

        // 检查是否需要创建或更新安全信息
        const existingLocation = await Location.findOne({ addressId: updateData.addressId });
        if (!existingLocation) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

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

        res.send({
            code: 200,
            msg: '更新成功',
            data: result
        });
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
        const { addressId } = req.params;

        const result = await Location.findOneAndDelete({ addressId });

        if (!result) {
            return res.send({ 
                code: 404, 
                msg: '未找到该地址信息' 
            });
        }

        res.send({
            code: 200,
            msg: '删除成功'
        });
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